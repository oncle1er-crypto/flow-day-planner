import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/push-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Lightweight auth: require the Supabase anon apikey header to match
        // (cron uses `apikey:` header as documented for /api/public hooks).
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/web-push.server");

        const now = new Date();
        // window: from (now - 30s) to (now + 90s) so a per-minute cron never misses
        // the boundary minute regardless of slight drift.
        const winStart = new Date(now.getTime() - 30 * 1000);
        const winEnd = new Date(now.getTime() + 90 * 1000);

        // ---- 1) TASK REMINDERS ----
        // Pull user_settings + reminder offsets per user, then iterate candidate tasks.
        const { data: settings, error: sErr } = await supabaseAdmin
          .from("user_settings")
          .select("user_id, notifications_enabled, daily_reminder_enabled, daily_reminder_time, default_reminder_minutes, timezone");
        if (sErr) {
          console.error("[push-reminders] settings", sErr);
          return new Response(JSON.stringify({ error: sErr.message }), { status: 500 });
        }
        const settingsByUser = new Map<string, typeof settings[number]>();
        for (const s of settings ?? []) settingsByUser.set(s.user_id, s);

        // Today's date (UTC range broad enough; we filter per-user below)
        const todayStr = now.toISOString().slice(0, 10);
        const yesterdayStr = new Date(now.getTime() - 86400_000).toISOString().slice(0, 10);
        const tomorrowStr = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);

        const { data: tasks, error: tErr } = await supabaseAdmin
          .from("tasks")
          .select("id,user_id,title,due_date,due_time,reminder_enabled,status,is_archived")
          .in("due_date", [yesterdayStr, todayStr, tomorrowStr])
          .eq("reminder_enabled", true)
          .eq("is_archived", false)
          .neq("status", "done")
          .neq("status", "cancelled");
        if (tErr) {
          console.error("[push-reminders] tasks", tErr);
          return new Response(JSON.stringify({ error: tErr.message }), { status: 500 });
        }

        type Dispatch = {
          user_id: string;
          kind: "task" | "daily";
          ref_id: string;
          scheduled_for: string;
          title: string;
          body: string;
          url: string;
        };
        const due: Dispatch[] = [];

        for (const t of tasks ?? []) {
          const s = settingsByUser.get(t.user_id);
          if (!s || !s.notifications_enabled) continue;
          if (!t.due_date) continue;
          const time = t.due_time ?? "09:00:00";
          const tz = s.timezone || "UTC";
          // Compute the UTC instant corresponding to (due_date, time) in user tz
          const utcMs = wallTimeToUTC(t.due_date, time, tz);
          if (utcMs == null) continue;
          const lead = (s.default_reminder_minutes ?? 15) * 60_000;
          const fireAt = utcMs - lead;
          if (fireAt >= winStart.getTime() && fireAt < winEnd.getTime()) {
            due.push({
              user_id: t.user_id,
              kind: "task",
              ref_id: t.id,
              scheduled_for: new Date(fireAt).toISOString(),
              title: "⏰ Rappel : " + t.title,
              body: `Prévu à ${time.slice(0, 5)}`,
              url: "/today",
            });
          }
        }

        // ---- 2) DAILY SUMMARY REMINDERS ----
        for (const s of settings ?? []) {
          if (!s.notifications_enabled || !s.daily_reminder_enabled || !s.daily_reminder_time) continue;
          const tz = s.timezone || "UTC";
          // Try today and yesterday to handle UTC-day boundary
          for (const day of [yesterdayStr, todayStr, tomorrowStr]) {
            const utcMs = wallTimeToUTC(day, String(s.daily_reminder_time), tz);
            if (utcMs == null) continue;
            if (utcMs >= winStart.getTime() && utcMs < winEnd.getTime()) {
              due.push({
                user_id: s.user_id,
                kind: "daily",
                ref_id: "daily",
                scheduled_for: new Date(utcMs).toISOString(),
                title: "🌅 Bonjour !",
                body: "Voici votre plan du jour. Allez-y, c'est parti !",
                url: "/today",
              });
            }
          }
        }

        if (due.length === 0) {
          return Response.json({ ok: true, sent: 0, candidates: 0 });
        }

        // Anti-doublon via reminder_dispatch_log unique constraint
        const logRows = due.map((d) => ({
          user_id: d.user_id,
          kind: d.kind,
          ref_id: d.ref_id,
          scheduled_for: d.scheduled_for,
        }));
        const { data: inserted, error: lErr } = await supabaseAdmin
          .from("reminder_dispatch_log")
          .insert(logRows)
          .select("user_id, kind, ref_id, scheduled_for");
        // If batch insert fails on conflict, fall back to per-row
        let toSend: Dispatch[] = [];
        if (lErr) {
          for (const d of due) {
            const { error: e } = await supabaseAdmin.from("reminder_dispatch_log").insert({
              user_id: d.user_id,
              kind: d.kind,
              ref_id: d.ref_id,
              scheduled_for: d.scheduled_for,
            });
            if (!e) toSend.push(d);
          }
        } else {
          const keys = new Set(
            (inserted ?? []).map((r) => `${r.user_id}|${r.kind}|${r.ref_id}|${r.scheduled_for}`),
          );
          toSend = due.filter((d) => keys.has(`${d.user_id}|${d.kind}|${d.ref_id}|${d.scheduled_for}`));
        }

        if (toSend.length === 0) {
          return Response.json({ ok: true, sent: 0, candidates: due.length });
        }

        // Load subscriptions for involved users
        const userIds = [...new Set(toSend.map((d) => d.user_id))];
        const { data: subs, error: subErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", userIds);
        if (subErr) {
          console.error("[push-reminders] subs", subErr);
          return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });
        }
        const subsByUser = new Map<string, typeof subs>();
        for (const sub of subs ?? []) {
          const arr = subsByUser.get(sub.user_id) ?? [];
          arr.push(sub);
          subsByUser.set(sub.user_id, arr);
        }

        let sent = 0;
        const expiredIds: string[] = [];
        for (const d of toSend) {
          const userSubs = subsByUser.get(d.user_id) ?? [];
          for (const sub of userSubs) {
            try {
              const r = await sendWebPush(sub, {
                title: d.title,
                body: d.body,
                url: d.url,
                tag: `${d.kind}:${d.ref_id}`,
              });
              if (r.ok) sent++;
              if (r.expired) expiredIds.push(sub.id);
              else if (!r.ok) console.warn("[push-reminders] send", r.status, sub.endpoint);
            } catch (e) {
              console.error("[push-reminders] sendWebPush", e);
            }
          }
        }

        if (expiredIds.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
        }

        return Response.json({ ok: true, sent, candidates: due.length, dispatched: toSend.length });
      },
    },
  },
});

/**
 * Convert a wall-clock date+time in a given IANA timezone to UTC ms.
 * Returns null if the timezone is invalid.
 */
function wallTimeToUTC(dateStr: string, timeStr: string, tz: string): number | null {
  try {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, m, s] = timeStr.split(":").map(Number);
    // Build a UTC instant for the wall time, then compute the tz offset at that instant
    const utcGuess = Date.UTC(Y, (M ?? 1) - 1, D ?? 1, h ?? 0, m ?? 0, s ?? 0);
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(utcGuess));
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asUTCifTzWereUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour === "24" ? 0 : map.hour),
      Number(map.minute),
      Number(map.second),
    );
    const offset = asUTCifTzWereUTC - utcGuess;
    return utcGuess - offset;
  } catch {
    return null;
  }
}
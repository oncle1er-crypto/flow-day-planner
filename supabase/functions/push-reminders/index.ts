// Cron-triggered edge function: scans tasks + daily reminders and sends Web Push.
// Invoked every minute by pg_cron via net.http_post.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ----- VAPID + Web Push (aes128gcm, RFC 8291/8292) using WebCrypto -----
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
async function importVapidPrivateKey(privB64u: string, pubB64u: string): Promise<CryptoKey> {
  const pub = b64urlDecode(pubB64u);
  const jwk = {
    kty: "EC", crv: "P-256", d: privB64u,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  };
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
async function signVapidJwt(audience: string, subject: string, pubKey: string, privKey: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = { aud: audience, exp, sub: subject };
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${h}.${p}`;
  const key = await importVapidPrivateKey(privKey, pubKey);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  return `${signingInput}.${b64urlEncode(sig)}`;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}
async function encryptPayload(payload: Uint8Array, uaPub64: string, uaAuth64: string): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(uaPub64);
  const uaAuth = b64urlDecode(uaAuth64);
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const asPublic = concat(new Uint8Array([0x04]), b64urlDecode(jwk.x as string), b64urlDecode(jwk.y as string));
  const uaJwk = { kty: "EC", crv: "P-256", x: b64urlEncode(uaPublic.slice(1, 33)), y: b64urlEncode(uaPublic.slice(33, 65)), ext: true };
  const uaKey = await crypto.subtle.importKey("jwk", uaJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, kp.privateKey, 256));
  const enc = new TextEncoder();
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(uaAuth, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const plaintext = concat(payload, new Uint8Array([0x02]));
  const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plaintext));
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  const idlen = new Uint8Array([asPublic.length]);
  return concat(salt, rs, idlen, asPublic, ct);
}
async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience, subject, pub, priv);
  const body = await encryptPayload(
    new TextEncoder().encode(typeof payload === "string" ? payload : JSON.stringify(payload ?? {})),
    sub.p256dh, sub.auth,
  );
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
      "Authorization": `vapid t=${jwt}, k=${pub}`,
    },
    body,
  });
  return { status: res.status, ok: res.ok, expired: res.status === 404 || res.status === 410 };
}

// ----- timezone helper -----
function wallTimeToUTC(dateStr: string, timeStr: string, tz: string): number | null {
  try {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, m, s] = timeStr.split(":").map(Number);
    const utcGuess = Date.UTC(Y, (M ?? 1) - 1, D ?? 1, h ?? 0, m ?? 0, s ?? 0);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcGuess));
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, (map.hour === "24" ? 0 : +map.hour), +map.minute, +map.second);
    return utcGuess - (asUTC - utcGuess);
  } catch { return null; }
}

// ----- main handler -----
Deno.serve(async (req) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const winStart = now.getTime() - 30_000;
  const winEnd = now.getTime() + 90_000;
  const todayStr = now.toISOString().slice(0, 10);
  const yStr = new Date(now.getTime() - 86400_000).toISOString().slice(0, 10);
  const tStr = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);

  const { data: settings, error: sErr } = await sb.from("user_settings")
    .select("user_id, notifications_enabled, daily_reminder_enabled, daily_reminder_time, default_reminder_minutes, timezone");
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 });
  const byUser = new Map<string, any>();
  for (const s of settings ?? []) byUser.set(s.user_id, s);

  const { data: tasks, error: tErr } = await sb.from("tasks")
    .select("id,user_id,title,due_date,due_time,reminder_enabled,status,is_archived")
    .in("due_date", [yStr, todayStr, tStr])
    .eq("reminder_enabled", true)
    .eq("is_archived", false)
    .neq("status", "done")
    .neq("status", "cancelled");
  if (tErr) return new Response(JSON.stringify({ error: tErr.message }), { status: 500 });

  type D = { user_id: string; kind: "task" | "daily"; ref_id: string; scheduled_for: string; title: string; body: string; url: string };
  const due: D[] = [];
  for (const t of tasks ?? []) {
    const s = byUser.get(t.user_id);
    if (!s?.notifications_enabled || !t.due_date) continue;
    const time = t.due_time ?? "09:00:00";
    const ms = wallTimeToUTC(t.due_date, time, s.timezone || "UTC");
    if (ms == null) continue;
    const lead = (s.default_reminder_minutes ?? 15) * 60_000;
    const fireAt = ms - lead;
    if (fireAt >= winStart && fireAt < winEnd) {
      due.push({
        user_id: t.user_id, kind: "task", ref_id: t.id,
        scheduled_for: new Date(fireAt).toISOString(),
        title: "⏰ Rappel : " + t.title,
        body: `Prévu à ${String(time).slice(0, 5)}`,
        url: "/today",
      });
    }
  }

  for (const s of settings ?? []) {
    if (!s.notifications_enabled || !s.daily_reminder_enabled || !s.daily_reminder_time) continue;
    for (const day of [yStr, todayStr, tStr]) {
      const ms = wallTimeToUTC(day, String(s.daily_reminder_time), s.timezone || "UTC");
      if (ms == null) continue;
      if (ms >= winStart && ms < winEnd) {
        due.push({
          user_id: s.user_id, kind: "daily", ref_id: "daily",
          scheduled_for: new Date(ms).toISOString(),
          title: "🌅 Bonjour !",
          body: "Voici votre plan du jour. Allez-y, c'est parti !",
          url: "/today",
        });
      }
    }
  }

  if (due.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { "content-type": "application/json" } });
  }

  // Anti-doublon
  const toSend: D[] = [];
  for (const d of due) {
    const { error } = await sb.from("reminder_dispatch_log").insert({
      user_id: d.user_id, kind: d.kind, ref_id: d.ref_id, scheduled_for: d.scheduled_for,
    });
    if (!error) toSend.push(d);
  }
  if (toSend.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, candidates: due.length }), { headers: { "content-type": "application/json" } });
  }

  const userIds = [...new Set(toSend.map((d) => d.user_id))];
  const { data: subs } = await sb.from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  const subsByUser = new Map<string, any[]>();
  for (const sub of subs ?? []) {
    const arr = subsByUser.get(sub.user_id) ?? [];
    arr.push(sub);
    subsByUser.set(sub.user_id, arr);
  }

  let sent = 0;
  const expired: string[] = [];
  for (const d of toSend) {
    for (const sub of subsByUser.get(d.user_id) ?? []) {
      try {
        const r = await sendWebPush(sub, { title: d.title, body: d.body, url: d.url, tag: `${d.kind}:${d.ref_id}` });
        if (r.ok) sent++;
        if (r.expired) expired.push(sub.id);
        else if (!r.ok) console.warn("push failed", r.status, sub.endpoint);
      } catch (e) {
        console.error("sendWebPush", e);
      }
    }
  }
  if (expired.length) await sb.from("push_subscriptions").delete().in("id", expired);

  return new Response(JSON.stringify({ ok: true, sent, dispatched: toSend.length, candidates: due.length }), {
    headers: { "content-type": "application/json" },
  });
});
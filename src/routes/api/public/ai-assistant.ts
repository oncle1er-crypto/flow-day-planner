// AI assistant proxy hosted on the Lovable runtime.
// It is the only place that reads LOVABLE_API_KEY, so any frontend host
// (Lovable or Vercel) can use Lovable AI without duplicating the secret.
// Auth is enforced inside the handler: /api/public/* bypasses site auth.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MODEL = "google/gemini-3-flash-preview";

const InputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  mode: z.enum(["parse_tasks", "plan_day", "summary"]).default("parse_tasks"),
});

type ParsedTask = {
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  due_date?: string | null;
  due_time?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/ai-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return json({ error: "Non authentifié" }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Corps JSON invalide" }, 400);
        }
        const parsedInput = InputSchema.safeParse(raw);
        if (!parsedInput.success) {
          return json({ error: "Requête invalide" }, 400);
        }
        const { prompt, mode } = parsedInput.data;

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          console.error("[ai-assistant] missing Supabase configuration");
          return json({ error: "Service indisponible" }, 500);
        }

        // User-scoped client: the caller's JWT is forwarded, so RLS applies.
        // No service_role, and no client-supplied user_id is ever trusted.
        const supabase = createClient<Database>(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", publishableKey);
              h.set("Authorization", authHeader);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          return json({ error: "Non authentifié" }, 401);
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          console.error("[ai-assistant] AI key not configured");
          return json({ error: "Assistant IA non configuré" }, 500);
        }

        let tasks: unknown[] = [];
        if (mode !== "parse_tasks") {
          const { data } = await supabase
            .from("tasks")
            .select("title, status, priority, due_date, due_time")
            .eq("is_archived", false)
            .order("due_date", { ascending: true })
            .limit(40);
          tasks = data ?? [];
        }

        const today = new Date().toISOString().slice(0, 10);
        const sys =
          mode === "parse_tasks"
            ? `Tu es un assistant qui extrait des tâches d'un texte en français. Renvoie STRICTEMENT un JSON {"tasks":[{"title":"...","description":"...","priority":"low|normal|high|urgent","due_date":"YYYY-MM-DD"|null,"due_time":"HH:MM"|null}]}. Date du jour: ${today}. Pas de markdown, pas d'explication, juste le JSON.`
            : mode === "plan_day"
              ? `Tu es un coach de productivité bienveillant. Donne en français un plan concis pour la journée basé sur les tâches existantes. Maximum 5 puces courtes. Pas de JSON.`
              : `Tu es un coach de productivité. Fais un court bilan motivant en français basé sur les tâches. Maximum 4 phrases.`;

        const userMsg =
          mode === "parse_tasks"
            ? prompt
            : `Tâches actuelles (JSON): ${JSON.stringify(tasks)}\n\nQuestion utilisateur: ${prompt}`;

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: userMsg },
              ],
            }),
          });
        } catch (e) {
          console.error("[ai-assistant] gateway network error", String(e));
          return json(
            { error: "Le service AI est temporairement indisponible. Veuillez réessayer." },
            502,
          );
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[ai-assistant] gateway error", res.status, text.slice(0, 300));
          if (res.status === 429) {
            return json({ error: "Trop de requêtes IA. Réessayez dans quelques instants." }, 429);
          }
          if (res.status === 402 || res.status === 403) {
            return json({ error: "Le quota IA du projet est épuisé ou bloqué." }, 402);
          }
          return json(
            { error: "Le service AI est temporairement indisponible. Veuillez réessayer." },
            502,
          );
        }

        const body = (await res.json().catch(() => null)) as
          | { choices?: Array<{ message?: { content?: string } }> }
          | null;
        const content = body?.choices?.[0]?.message?.content ?? "";

        if (mode === "parse_tasks") {
          const match = content.match(/\{[\s\S]*\}/);
          let parsed: { tasks?: ParsedTask[] } = {};
          if (match) {
            try {
              parsed = JSON.parse(match[0]);
            } catch {
              parsed = {};
            }
          }
          return json({ mode: "parse_tasks", tasks: parsed.tasks ?? [], raw: content });
        }

        return json({ mode, message: content });
      },
    },
  },
});

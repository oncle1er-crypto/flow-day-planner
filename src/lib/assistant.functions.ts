import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  mode: z.enum(["parse_tasks", "plan_day", "summary"]).default("parse_tasks"),
});

type ParsedTask = {
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  due_date?: string | null;
  due_time?: string | null;
};

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI non configurée");

    const today = new Date().toISOString().slice(0, 10);
    // Pull a brief context of today's tasks
    const { data: tasks } = await context.supabase
      .from("tasks")
      .select("title, status, priority, due_date, due_time")
      .eq("is_archived", false)
      .order("due_date", { ascending: true })
      .limit(40);

    const sys =
      data.mode === "parse_tasks"
        ? `Tu es un assistant qui extrait des tâches d'un texte en français. Renvoie STRICTEMENT un JSON {"tasks":[{"title":"...","description":"...","priority":"low|normal|high|urgent","due_date":"YYYY-MM-DD"|null,"due_time":"HH:MM"|null}]}. Date du jour: ${today}. Pas de markdown, pas d'explication, juste le JSON.`
        : data.mode === "plan_day"
        ? `Tu es un coach de productivité bienveillant. Donne en français un plan concis pour la journée basé sur les tâches existantes. Maximum 5 puces courtes. Pas de JSON.`
        : `Tu es un coach de productivité. Fais un court bilan motivant en français basé sur les tâches. Maximum 4 phrases.`;

    const userMsg =
      data.mode === "parse_tasks"
        ? data.prompt
        : `Tâches actuelles (JSON): ${JSON.stringify(tasks ?? [])}\n\nQuestion utilisateur: ${data.prompt}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[assistant] AI gateway error", res.status, text);
      throw new Error("Le service AI est temporairement indisponible. Veuillez réessayer.");
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";

    if (data.mode === "parse_tasks") {
      // Try to extract JSON block
      const match = content.match(/\{[\s\S]*\}/);
      let parsed: { tasks: ParsedTask[] } = { tasks: [] };
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { tasks: [] };
        }
      }
      return { mode: "parse_tasks" as const, tasks: parsed.tasks ?? [], raw: content };
    }

    return { mode: data.mode, message: content };
  });

const CreateBatchSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional().nullable(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      due_date: z.string().nullable().optional(),
      due_time: z.string().nullable().optional(),
    }),
  ),
});

export const createTasksBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateBatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const rows = data.tasks.map((t) => ({
      user_id: context.userId,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority ?? "normal",
      due_date: t.due_date ?? null,
      due_time: t.due_time ?? null,
    }));
    const { data: inserted, error } = await context.supabase.from("tasks").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return { count: inserted?.length ?? 0 };
  });
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  mode: z.enum(["parse_tasks", "plan_day", "summary"]).default("parse_tasks"),
});

const ParsedTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  due_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
});

type ParsedTask = z.infer<typeof ParsedTaskSchema>;

// The Lovable runtime is the only host that holds LOVABLE_API_KEY.
// This server fn (which also runs on Vercel) proxies to it server-to-server,
// forwarding the caller's own bearer token so the proxy re-verifies identity.
const AI_PROXY_URL = "https://tache-daily.lovable.app/api/public/ai-assistant";

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader) throw new Error("Session expirée. Reconnectez-vous.");

    let res: Response;
    try {
      res = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ prompt: data.prompt, mode: data.mode }),
      });
    } catch (e) {
      console.error("[assistant] proxy network error", String(e));
      throw new Error("Le service AI est temporairement indisponible. Veuillez réessayer.");
    }

    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (!res.ok) {
      console.error("[assistant] proxy error", res.status);
      const msg =
        typeof payload?.["error"] === "string"
          ? (payload["error"] as string)
          : "Le service AI est temporairement indisponible. Veuillez réessayer.";
      throw new Error(msg);
    }

    if (data.mode === "parse_tasks") {
      const tasks = z.array(ParsedTaskSchema).max(25).safeParse(payload?.["tasks"]);
      const raw = typeof payload?.["raw"] === "string" ? (payload["raw"] as string) : "";
      return { mode: "parse_tasks" as const, tasks: tasks.success ? tasks.data : [], raw };
    }

    const message = typeof payload?.["message"] === "string" ? (payload["message"] as string) : "";
    if (!message) throw new Error("Réponse AI invalide. Veuillez réessayer.");
    return { mode: data.mode, message };
  });

const CreateBatchSchema = z.object({
  tasks: z.array(ParsedTaskSchema).min(1).max(25),
});

export const createTasksBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CreateBatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const rows = data.tasks.map((t) => ({
      user_id: context.userId,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority ?? "normal",
      due_date: t.due_date ?? null,
      due_time: t.due_time ?? null,
    }));
    const { data: inserted, error } = await context.supabase
      .from("tasks")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { count: inserted?.length ?? 0 };
  });

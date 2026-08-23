import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Lister les tâches",
  description:
    "Liste les tâches de l'utilisateur connecté, avec filtres optionnels par statut et par date d'échéance.",
  inputSchema: {
    status: z
      .enum(["todo", "in_progress", "done", "cancelled", "postponed"])
      .optional()
      .describe("Filtrer sur un statut de tâche."),
    due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Échéance exacte (YYYY-MM-DD)."),
    due_before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Échéance avant cette date."),
    limit: z.number().int().min(1).max(100).default(25).describe("Nombre maximum de tâches renvoyées."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, due_on, due_before, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id,title,description,status,priority,due_date,due_time,recurrence,completed_at")
      .eq("is_archived", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit ?? 25);
    if (status) query = query.eq("status", status);
    if (due_on) query = query.eq("due_date", due_on);
    if (due_before) query = query.lt("due_date", due_before);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});

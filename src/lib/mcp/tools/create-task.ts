import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Créer une tâche",
  description: "Crée une nouvelle tâche pour l'utilisateur connecté (titre, priorité, échéance, notes).",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Titre de la tâche."),
    description: z.string().trim().max(2000).optional().describe("Description détaillée."),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal").describe("Priorité."),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date d'échéance (YYYY-MM-DD)."),
    due_time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Heure d'échéance (HH:MM)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, priority, due_date, due_time }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: ctx.getUserId(),
        title,
        description: description ?? null,
        priority: priority ?? "normal",
        due_date: due_date ?? null,
        due_time: due_time ?? null,
      })
      .select("id,title,status,priority,due_date,due_time")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { task: data },
    };
  },
});

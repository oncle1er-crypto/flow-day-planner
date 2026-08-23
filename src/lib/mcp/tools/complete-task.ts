import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_task",
  title: "Terminer une tâche",
  description: "Marque une tâche de l'utilisateur connecté comme terminée (ou la remet à faire).",
  inputSchema: {
    task_id: z.string().uuid().describe("Identifiant de la tâche."),
    done: z.boolean().default(true).describe("true = terminée, false = à faire."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id, done }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const isDone = done ?? true;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: isDone ? "done" : "todo",
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq("id", task_id)
      .select("id,title,status,completed_at")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Tâche introuvable." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { task: data },
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "daily_summary",
  title: "Bilan du jour",
  description:
    "Renvoie un bilan des tâches de l'utilisateur pour une date donnée (par défaut aujourd'hui) : terminées, en retard, restantes.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Date du bilan (YYYY-MM-DD). Par défaut aujourd'hui (UTC)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const day = date ?? new Date().toISOString().slice(0, 10);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,status,priority,due_date")
      .eq("is_archived", false)
      .lte("due_date", day)
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const done = rows.filter((t) => t.status === "done" && t.due_date === day);
    const remaining = rows.filter((t) => t.status !== "done" && t.due_date === day);
    const overdue = rows.filter((t) => t.status !== "done" && (t.due_date ?? day) < day);
    const summary = {
      date: day,
      completed: done.length,
      remaining: remaining.length,
      overdue: overdue.length,
      remaining_titles: remaining.map((t) => t.title),
      overdue_titles: overdue.map((t) => t.title),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_habits",
  title: "Lister les habitudes",
  description: "Liste les habitudes de l'utilisateur connecté avec leurs journaux récents.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Nombre maximum d'habitudes renvoyées."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { habits: data ?? [] },
    };
  },
});

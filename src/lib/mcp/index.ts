import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import completeTaskTool from "./tools/complete-task";
import dailySummaryTool from "./tools/daily-summary";
import listHabitsTool from "./tools/list-habits";

// The OAuth issuer must be the direct Supabase host (the published proxy URL is rejected).
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "flow-day-planner",
  title: "Flow Day Planner",
  version: "0.1.0",
  instructions:
    "Outils de Flow Day Planner pour l'utilisateur connecté : lister/créer/terminer des tâches, obtenir le bilan du jour et lister les habitudes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTasksTool, createTaskTool, completeTaskTool, dailySummaryTool, listHabitsTool],
});

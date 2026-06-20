import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Calendar, ListPlus, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant, createTasksBatch } from "@/lib/assistant.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import type { Priority } from "@/lib/task-utils";

export const Route = createFileRoute("/_authenticated/assistant")({ component: AssistantPage });

type Parsed = { title: string; description?: string; priority?: Priority; due_date?: string | null; due_time?: string | null };

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const createBatch = useServerFn(createTasksBatch);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"parse_tasks" | "plan_day" | "summary">("parse_tasks");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (next: typeof mode = mode) => {
    if (next === "parse_tasks" && !text.trim()) return;
    setLoading(true);
    setParsed(null);
    setMessage(null);
    try {
      const res = await ask({ data: { prompt: text || "Aide-moi à organiser ma journée", mode: next } });
      if (res.mode === "parse_tasks") setParsed(res.tasks as Parsed[]);
      else setMessage(res.message ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!parsed || parsed.length === 0) return;
    setLoading(true);
    try {
      const res = await createBatch({ data: { tasks: parsed } });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${res.count} tâche${res.count > 1 ? "s" : ""} créée${res.count > 1 ? "s" : ""}`);
      setParsed(null);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Assistant" subtitle="IA productivité">
      <div className="pt-4 space-y-5">
        <div className="rounded-3xl bg-gradient-card border border-border p-5 shadow-card">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Décrivez votre journée</h2>
              <p className="text-sm text-muted-foreground">Je transforme votre texte en tâches structurées.</p>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex : Demain je dois appeler le client à 10h, payer la facture, faire 30 min de sport et préparer le rapport pour vendredi."
            rows={4}
          />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => { setMode("parse_tasks"); run("parse_tasks"); }} disabled={loading || !text.trim()}>
              <ListPlus className="h-4 w-4 mr-1.5" /> Extraire
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setMode("plan_day"); run("plan_day"); }} disabled={loading}>
              <Calendar className="h-4 w-4 mr-1.5" /> Plan du jour
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setMode("summary"); run("summary"); }} disabled={loading}>
              <Wand2 className="h-4 w-4 mr-1.5" /> Bilan
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> L'assistant réfléchit…
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-border bg-card/60 p-5 whitespace-pre-wrap text-sm leading-relaxed">
            {message}
          </div>
        )}

        {parsed && parsed.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-display font-semibold">Tâches proposées ({parsed.length})</h3>
            <div className="space-y-2">
              {parsed.map((t, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                        {t.due_date && <span>📅 {t.due_date}{t.due_time ? ` · ${t.due_time}` : ""}</span>}
                      </div>
                    </div>
                    {t.priority && <PriorityBadge priority={t.priority} />}
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full bg-gradient-primary shadow-glow" onClick={handleCreate} disabled={loading}>
              <ListPlus className="h-4 w-4 mr-2" /> Créer ces tâches
            </Button>
          </div>
        )}

        {parsed && parsed.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Aucune tâche détectée. Reformulez votre texte.</p>
        )}
      </div>
    </AppShell>
  );
}
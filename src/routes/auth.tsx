import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Smart Daily Tasks" },
      { name: "description", content: "Connectez-vous pour organiser vos tâches, habitudes et objectifs." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect(search.next ? { href: search.next } : { to: "/today" });
  },
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const returnTo = next ?? "/today";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(false);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setSent(true);
        toast.success("Email de réinitialisation envoyé");
        return;
      }
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/today`,
            data: { full_name: name },
          },
        });
        if (err) throw err;
        toast.success("Compte créé. Vérifiez votre email si confirmation requise.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate({ to: "/today" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow mb-4">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">Smart Daily Tasks</h1>
          <p className="text-muted-foreground mt-1">Votre journée, organisée intelligemment.</p>
        </div>

        <div className="rounded-3xl glass p-6 shadow-card">
          {mode !== "forgot" && (
            <div className="flex gap-1 p-1 bg-secondary/60 rounded-xl mb-6">
              <button
                onClick={() => switchMode("signin")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "signin" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"}`}
              >
                Connexion
              </button>
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "signup" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"}`}
              >
                Inscription
              </button>
            </div>
          )}

          {mode === "forgot" && sent ? (
            <div className="space-y-4 text-center">
              <MailCheck className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Si un compte existe pour <span className="font-medium text-foreground">{email}</span>, un lien de
                réinitialisation vient d'être envoyé. Vérifiez aussi vos spams.
              </p>
              <Button variant="ghost" className="w-full" onClick={() => switchMode("signin")}>
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-3">
              {mode === "forgot" && (
                <p className="text-sm text-muted-foreground">
                  Entrez votre email, nous vous enverrons un lien pour définir un nouveau mot de passe.
                </p>
              )}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary shadow-glow">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {mode === "forgot" ? "Envoyer le lien" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
              </Button>
              <button
                type="button"
                onClick={() => switchMode(mode === "forgot" ? "signin" : "forgot")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition"
              >
                {mode === "forgot" ? "Retour à la connexion" : "Mot de passe oublié ?"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          En continuant, vous acceptez les conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}
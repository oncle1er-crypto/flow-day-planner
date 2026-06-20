import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useProfile } from "@/hooks/use-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const toggleSetting = async (key: "notifications_enabled" | "sound_enabled", value: boolean) => {
    if (!profile) return;
    await supabase.from("user_settings").update({ [key]: value }).eq("user_id", profile.id);
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <AppShell title="Paramètres" subtitle="Personnalisation">
      <div className="pt-4 space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
          <h2 className="font-display font-semibold">Profil</h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone (optionnel)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full">Enregistrer</Button>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
          <h2 className="font-display font-semibold">Notifications</h2>
          <SettingRow
            label="Activer les notifications"
            description="Recevoir les rappels dans l'app"
            checked={!!settings?.notifications_enabled}
            onChange={(v) => toggleSetting("notifications_enabled", v)}
          />
          <SettingRow
            label="Son d'alerte"
            description="Jouer un son lors d'un rappel"
            checked={!!settings?.sound_enabled}
            onChange={(v) => toggleSetting("sound_enabled", v)}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="font-display font-semibold mb-2">Données</h2>
          <p className="text-sm text-muted-foreground">Vos données sont stockées en toute sécurité et ne sont visibles que par vous.</p>
        </section>
      </div>
    </AppShell>
  );
}

function SettingRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
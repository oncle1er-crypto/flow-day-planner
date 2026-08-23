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
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useBackgroundPush } from "@/hooks/use-background-push";
import { useNativeReminders } from "@/hooks/use-native-reminders";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { exportCurrentUserData } from "@/lib/export-user-data";
import {
  AlarmClock,
  Bell,
  BellOff,
  Check,
  Download,
  Loader2,
  Radio,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { permission, isSupported, isGranted, requestPermission } = usePushNotifications();
  const bg = useBackgroundPush();
  const native = useNativeReminders();

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
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, phone })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossible de mettre à jour le profil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async (patch: TablesUpdate<"user_settings">) => {
    if (!profile) return;
    const { error } = await supabase.from("user_settings").update(patch).eq("user_id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["tasks-for-reminders"] });
  };

  const exportData = async () => {
    setExporting(true);
    try {
      await exportCurrentUserData();
      toast.success("Export de vos données prêt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’exporter vos données.");
    } finally {
      setExporting(false);
    }
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
          <Button onClick={saveProfile} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
          <h2 className="font-display font-semibold">Notifications</h2>

          {!isSupported ? (
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <BellOff className="h-4 w-4" /> Notifications non supportées sur cet appareil.
            </div>
          ) : isGranted ? (
            <div className="rounded-xl bg-success/10 text-success p-3 text-xs flex items-center gap-2">
              <Check className="h-4 w-4" /> Notifications autorisées par le navigateur
            </div>
          ) : permission === "denied" ? (
            <div className="rounded-xl bg-destructive/10 text-destructive p-3 text-xs">
              Notifications bloquées. Autorisez-les dans les paramètres de votre navigateur.
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={requestPermission}>
              <Bell className="h-4 w-4 mr-2" /> Activer les notifications du navigateur
            </Button>
          )}

          <SettingRow
            label="Activer les notifications"
            description="Recevoir les rappels dans l'app"
            checked={!!settings?.notifications_enabled}
            onChange={(v) => updateSetting({ notifications_enabled: v })}
          />
          <SettingRow
            label="Son d'alerte"
            description="Jouer un son lors d'un rappel"
            checked={!!settings?.sound_enabled}
            onChange={(v) => updateSetting({ sound_enabled: v })}
          />
          <SettingRow
            label="Rappel quotidien"
            description="Une notification chaque matin avec votre plan du jour"
            checked={!!settings?.daily_reminder_enabled}
            onChange={(v) => updateSetting({ daily_reminder_enabled: v })}
          />
          {settings?.daily_reminder_enabled && (
            <div className="flex items-center justify-between gap-4 pl-1">
              <Label htmlFor="daily-time" className="text-sm">
                Heure du rappel
              </Label>
              <Input
                id="daily-time"
                type="time"
                value={String(settings.daily_reminder_time ?? "09:00").slice(0, 5)}
                onChange={(e) => updateSetting({ daily_reminder_time: e.target.value + ":00" })}
                className="w-32"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-sm">Rappel avant échéance</p>
              <p className="text-xs text-muted-foreground">Minutes avant l'heure d'une tâche</p>
            </div>
            <Input
              type="number"
              min={0}
              max={1440}
              value={settings?.default_reminder_minutes ?? 15}
              onChange={(e) =>
                updateSetting({ default_reminder_minutes: Number(e.target.value) || 0 })
              }
              className="w-24"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Notifications en arrière-plan</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Recevez vos rappels même quand l'application est fermée. Nécessite d'installer l'app (ou
            de l'ajouter à l'écran d'accueil) sur iOS.
          </p>

          {bg.status === "unsupported" ? (
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <BellOff className="h-4 w-4" /> Votre navigateur ne supporte pas les notifications
              push.
            </div>
          ) : bg.status === "subscribed" ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-success/10 text-success p-3 text-xs flex items-center gap-2">
                <Check className="h-4 w-4" /> Cet appareil recevra les rappels en arrière-plan.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => bg.unsubscribe()}
                disabled={bg.busy}
              >
                {bg.busy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BellOff className="h-4 w-4 mr-2" />
                )}
                Désactiver sur cet appareil
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={() => bg.subscribe()} disabled={bg.busy}>
              {bg.busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Activer sur cet appareil
            </Button>
          )}

          {bg.error && <p className="text-xs text-destructive">{bg.error}</p>}
        </section>

        {native.supported && (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Rappels locaux de l’application mobile</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Les rappels sont programmés directement par Android/iOS. Ils peuvent donc sonner même
              si Flow Day Planner est fermé et même sans Internet.
            </p>

            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-background/60 p-3">
                <span>Notifications système</span>
                <span className={native.permission === "granted" ? "text-success" : "text-warning"}>
                  {native.permission === "granted" ? "Autorisées" : "À autoriser"}
                </span>
              </div>
              {native.platform === "android" && (
                <div className="flex items-center justify-between rounded-xl bg-background/60 p-3">
                  <span>Alarmes exactes Android</span>
                  <span className={native.exactAlarm === "granted" ? "text-success" : "text-warning"}>
                    {native.exactAlarm === "granted" ? "Autorisées" : "À autoriser"}
                  </span>
                </div>
              )}
            </div>

            {native.permission !== "granted" && (
              <Button
                className="w-full"
                onClick={() => native.requestPermission()}
                disabled={native.busy}
              >
                {native.busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Autoriser les rappels locaux
              </Button>
            )}

            {native.platform === "android" && native.exactAlarm !== "granted" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => native.requestExactAlarm()}
                disabled={native.busy}
              >
                <AlarmClock className="h-4 w-4 mr-2" /> Autoriser les alarmes exactes
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              disabled={
                native.busy ||
                native.permission !== "granted" ||
                (native.platform === "android" && native.exactAlarm !== "granted")
              }
              onClick={async () => {
                const ok = await native.test();
                if (ok) toast.success("Test programmé : le rappel doit sonner dans 5 secondes");
              }}
            >
              <Bell className="h-4 w-4 mr-2" /> Tester le rappel sonore dans 5 secondes
            </Button>

            {native.error && <p className="text-xs text-destructive">{native.error}</p>}
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
          <div>
            <h2 className="font-display font-semibold mb-1">Données</h2>
            <p className="text-sm text-muted-foreground">
              Téléchargez une copie JSON de vos données Flow Day Planner. Les clés et abonnements
              push ne sont pas inclus.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={exportData} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter mes données
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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

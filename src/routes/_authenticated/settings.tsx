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
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportCurrentUserData } from "@/lib/export-user-data";
import { parseFlowDayImport, restoreCurrentUserData } from "@/lib/import-user-data";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/use-categories";
import {
  AlarmClock,
  Bell,
  BellOff,
  Check,
  Download,
  FolderPlus,
  Loader2,
  Radio,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
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

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const payload = parseFlowDayImport(await file.text());
      if (
        !window.confirm(
          "Restaurer cet export dans votre compte ? Les éléments ayant le même identifiant seront mis à jour.",
        )
      ) {
        return;
      }
      const restored = await restoreCurrentUserData(payload);
      await qc.invalidateQueries();
      const total = Object.values(restored).reduce((sum, count) => sum + count, 0);
      toast.success(`${total} élément${total > 1 ? "s" : ""} restauré${total > 1 ? "s" : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de restaurer les données.");
    } finally {
      setImporting(false);
    }
  };

  const deleteAccount = async () => {
    const confirmation = window.prompt(
      "Cette action supprime définitivement votre compte et toutes ses données. Tapez SUPPRIMER pour confirmer.",
    );
    if (confirmation !== "SUPPRIMER") return;
    setSaving(true);
    try {
      const database = supabase as unknown as SupabaseClient;
      const { error } = await database.rpc("delete_my_account");
      if (error) throw error;
      qc.clear();
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/auth");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer le compte.");
      setSaving(false);
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

        <CategoryManager />

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
                  <span
                    className={native.exactAlarm === "granted" ? "text-success" : "text-warning"}
                  >
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
          <Label
            htmlFor="data-import"
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Restaurer un export
          </Label>
          <Input
            id="data-import"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importData(file);
              event.target.value = "";
            }}
          />
        </section>

        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-destructive">Zone de danger</h2>
            <p className="text-sm text-muted-foreground mt-1">
              La suppression du compte efface définitivement le profil et toutes les données liées.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={saving}
            onClick={deleteAccount}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Supprimer définitivement mon compte
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

function CategoryManager() {
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366F1");

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold">Catégories</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Organisez vos tâches avec des catégories personnalisées. La suppression conserve les
          tâches et retire seulement leur classement.
        </p>
      </div>
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center gap-2">
            <Input
              type="color"
              aria-label={`Couleur de ${category.name}`}
              defaultValue={category.color}
              className="h-10 w-12 p-1"
              onBlur={(event) =>
                update.mutate({ id: category.id, name: category.name, color: event.target.value })
              }
            />
            <Input
              aria-label={`Nom de la catégorie ${category.name}`}
              defaultValue={category.name}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== category.name) {
                  update.mutate({ id: category.id, name: next, color: category.color });
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Supprimer la catégorie ${category.name}`}
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) {
                  remove.mutate(category.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Input
          type="color"
          aria-label="Couleur de la nouvelle catégorie"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-12 p-1"
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nouvelle catégorie"
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim()) {
              create.mutate({ name, color }, { onSuccess: () => setName("") });
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          aria-label="Ajouter la catégorie"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate({ name, color }, { onSuccess: () => setName("") })}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
    </section>
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

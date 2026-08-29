import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  hasFinancePin,
  isValidFinancePin,
  setFinancePin,
  verifyFinancePin,
} from "@/lib/finance-security";

export const Route = createFileRoute("/_authenticated/finance-security")({
  component: FinanceSecurityPage,
});

function PinField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <InputOTP
        maxLength={4}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        pattern="^[0-9]*$"
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3].map((index) => (
            <InputOTPSlot key={index} index={index} className="h-12 w-12 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

function FinanceSecurityPage() {
  const qc = useQueryClient();
  const { data: configured, isLoading } = useQuery({
    queryKey: ["finance-pin-configured"],
    queryFn: hasFinancePin,
  });
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!isValidFinancePin(newPin) || !isValidFinancePin(confirmPin)) {
      toast.error("Saisissez un code de 4 chiffres");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Les deux nouveaux codes ne correspondent pas");
      return;
    }
    setSaving(true);
    try {
      if (configured) {
        const result = await verifyFinancePin(currentPin);
        if (!result.ok) {
          if (result.reason === "locked") {
            toast.error("Trop de tentatives. Réessayez dans 15 minutes.");
          } else {
            toast.error(`Code actuel incorrect${result.remaining_attempts !== undefined ? ` · ${result.remaining_attempts} tentative(s) restante(s)` : ""}`);
          }
          return;
        }
      }
      await setFinancePin(newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      await qc.invalidateQueries({ queryKey: ["finance-pin-configured"] });
      toast.success(configured ? "Code finances modifié" : "Code finances activé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le code");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Sécurité Finances" subtitle="Code secret à 4 chiffres">
      <div className="pt-4 space-y-5">
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Protection du module Finances</h2>
              <p className="text-xs text-muted-foreground">
                Le code est chiffré côté serveur et n'est jamais stocké en clair.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Après 5 erreurs, l'accès est bloqué pendant 15 minutes. Une ouverture réussie reste
            déverrouillée 10 minutes sur cet appareil.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">
              {isLoading ? "Vérification…" : configured ? "Modifier le code" : "Créer le code"}
            </h2>
          </div>

          {configured && (
            <PinField value={currentPin} onChange={setCurrentPin} label="Code actuel" />
          )}
          <PinField value={newPin} onChange={setNewPin} label="Nouveau code" />
          <PinField value={confirmPin} onChange={setConfirmPin} label="Confirmer le nouveau code" />

          <Button
            className="w-full"
            onClick={save}
            disabled={saving || isLoading || (configured ? currentPin.length !== 4 : false)}
          >
            {saving ? "Enregistrement…" : configured ? "Modifier le code" : "Activer le code"}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

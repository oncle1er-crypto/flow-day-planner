import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
  Plus,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAddFinancialPayment,
  useCreateFinancialObligation,
  useFinancialObligations,
  useUpdateFinancialStatus,
} from "@/hooks/use-finance";
import {
  financeSummary,
  formatMoney,
  type FinancialObligation,
  type ObligationType,
} from "@/lib/finance";
import {
  hasFinancePin,
  isFinanceSessionUnlocked,
  lockFinanceSession,
  verifyFinancePin,
} from "@/lib/finance-security";

export const Route = createFileRoute("/_authenticated/finance")({ component: FinancePage });

type Filter = "all" | ObligationType | "overdue" | "settled";

function FinancePage() {
  const [unlocked, setUnlocked] = useState(() => isFinanceSessionUnlocked());
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const { data: configured, isLoading: checkingPin } = useQuery({
    queryKey: ["finance-pin-configured"],
    queryFn: hasFinancePin,
  });
  const { data: obligations = [], isLoading } = useFinancialObligations(unlocked);
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<FinancialObligation | null>(null);

  const summary = useMemo(() => financeSummary(obligations), [obligations]);
  const filtered = useMemo(() => {
    if (filter === "all") return obligations;
    if (filter === "overdue") return obligations.filter((item) => item.is_overdue);
    if (filter === "settled") return obligations.filter((item) => item.status === "settled");
    return obligations.filter((item) => item.type === filter && item.status !== "cancelled");
  }, [filter, obligations]);

  const unlock = async () => {
    setUnlocking(true);
    try {
      const result = await verifyFinancePin(pin);
      if (result.ok) {
        setUnlocked(true);
        setPin("");
        return;
      }
      if (result.reason === "locked") {
        toast.error(
          "Accès temporairement bloqué après trop de tentatives. Réessayez dans 15 minutes.",
        );
      } else {
        toast.error(
          result.reason === "wrong_pin"
            ? `Code incorrect · ${result.remaining_attempts ?? 0} tentative(s) restante(s)`
            : "Code invalide",
        );
      }
      setPin("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de vérifier le code");
    } finally {
      setUnlocking(false);
    }
  };

  if (checkingPin) {
    return (
      <AppShell title="Finances" subtitle="Dettes & créances">
        <div className="py-16 text-center text-sm text-muted-foreground">
          Vérification de la sécurité…
        </div>
      </AppShell>
    );
  }

  if (!configured) {
    return (
      <AppShell title="Finances" subtitle="Dettes & créances">
        <EmptyState
          icon={ShieldAlert}
          title="Code secret requis"
          description="Créez d'abord votre code secret de 4 chiffres depuis votre profil pour protéger vos informations financières."
          action={
            <Button asChild>
              <Link to="/finance-security">Configurer mon code</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (!unlocked) {
    return (
      <AppShell title="Finances" subtitle="Espace protégé">
        <div className="pt-10 flex justify-center">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-6 text-center shadow-card space-y-5">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center">
              <LockKeyhole className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Déverrouiller Finances</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Saisissez votre code secret à 4 chiffres.
              </p>
            </div>
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={setPin}
              inputMode="numeric"
              pattern="^[0-9]*$"
              containerClassName="justify-center"
              onComplete={() => void unlock()}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3].map((index) => (
                  <InputOTPSlot key={index} index={index} className="h-14 w-14 text-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" onClick={unlock} disabled={pin.length !== 4 || unlocking}>
              {unlocking ? "Vérification…" : "Ouvrir Finances"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/finance-security">Modifier le code depuis mon profil</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Finances"
      subtitle="Dettes & créances"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            lockFinanceSession();
            setUnlocked(false);
          }}
        >
          <LockKeyhole className="h-4 w-4" /> Verrouiller
        </Button>
      }
    >
      <div className="pt-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="On me doit" value={summary.receivables} icon={ArrowDownLeft} />
          <SummaryCard label="Je dois" value={summary.debts} icon={ArrowUpRight} />
          <SummaryCard
            label="Créances en retard"
            value={summary.overdueReceivables}
            icon={Clock3}
          />
          <SummaryCard label="Dettes en retard" value={summary.overdueDebts} icon={Clock3} />
        </div>

        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">Position nette théorique</p>
            <p className="text-2xl font-bold">{formatMoney(summary.net)}</p>
          </div>
          <WalletCards className="h-8 w-8 opacity-80" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "Tout"],
              ["receivable", "On me doit"],
              ["debt", "Je dois"],
              ["overdue", "En retard"],
              ["settled", "Soldé"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <Button className="w-full h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Ajouter une dette ou une créance
        </Button>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="Aucune opération"
            description="Ajoutez une dette ou une créance pour commencer votre suivi."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <ObligationCard key={item.id} item={item} onPayment={() => setPaymentTarget(item)} />
            ))}
          </div>
        )}
      </div>

      <CreateObligationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PaymentDialog target={paymentTarget} onClose={() => setPaymentTarget(null)} />
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ArrowDownLeft;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-card">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="text-lg font-bold leading-tight">{formatMoney(value)}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ObligationCard({ item, onPayment }: { item: FinancialObligation; onPayment: () => void }) {
  const statusMutation = useUpdateFinancialStatus();
  const settled = item.status === "settled" || item.remaining_amount <= 0;
  const cancelled = item.status === "cancelled";
  return (
    <article className="rounded-2xl border border-border bg-card/70 p-4 shadow-card space-y-3">
      <div className="flex gap-3 items-start">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 grid place-items-center">
          {item.type === "receivable" ? (
            <ArrowDownLeft className="h-5 w-5 text-primary" />
          ) : (
            <ArrowUpRight className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold truncate">{item.counterparty_name}</h3>
              <p className="text-sm text-muted-foreground truncate">{item.title}</p>
            </div>
            {item.is_overdue ? (
              <Badge variant="destructive">En retard</Badge>
            ) : settled ? (
              <Badge variant="secondary">Soldé</Badge>
            ) : cancelled ? (
              <Badge variant="outline">Annulé</Badge>
            ) : (
              <Badge variant="outline">En cours</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Amount label="Initial" value={item.original_amount} />
        <Amount label="Payé" value={item.paid_amount} />
        <Amount label="Reste" value={item.remaining_amount} strong />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{item.type === "receivable" ? "On vous doit" : "Vous devez"}</span>
        <span>
          {item.due_date
            ? `Échéance ${new Date(`${item.due_date}T12:00:00`).toLocaleDateString("fr-FR")}`
            : "Sans échéance"}
        </span>
      </div>

      {!settled && !cancelled && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onPayment}>
            Enregistrer un paiement
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => statusMutation.mutate({ id: item.id, status: "cancelled" })}
            disabled={statusMutation.isPending}
          >
            Annuler
          </Button>
        </div>
      )}
    </article>
  );
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 p-2">
      <p className={`text-sm ${strong ? "font-bold" : "font-medium"}`}>{formatMoney(value)}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateObligationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMutation = useCreateFinancialObligation();
  const [type, setType] = useState<ObligationType>("receivable");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    try {
      await createMutation.mutateAsync({
        type,
        counterparty_name: name,
        counterparty_phone: phone,
        title,
        original_amount: Number(amount),
        due_date: dueDate,
        notes,
      });
      setName("");
      setPhone("");
      setTitle("");
      setAmount("");
      setDueDate("");
      setNotes("");
      onOpenChange(false);
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle opération</DialogTitle>
          <DialogDescription>
            Enregistrez ce que vous devez ou ce qu'on vous doit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={type === "receivable" ? "default" : "outline"}
              onClick={() => setType("receivable")}
            >
              On me doit
            </Button>
            <Button
              variant={type === "debt" ? "default" : "outline"}
              onClick={() => setType("debt")}
            >
              Je dois
            </Button>
          </div>
          <Field label={type === "receivable" ? "Débiteur" : "Créancier"}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom ou entreprise"
            />
          </Field>
          <Field label="Téléphone (optionnel)">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Motif">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Prêt, achat, facture…"
            />
          </Field>
          <Field label="Montant initial (F CFA)">
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Date d'échéance (optionnel)">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Notes (optionnel)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  target,
  onClose,
}: {
  target: FinancialObligation | null;
  onClose: () => void;
}) {
  const paymentMutation = useAddFinancialPayment();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = async () => {
    if (!target) return;
    try {
      await paymentMutation.mutateAsync({ obligation: target, amount: Number(amount), note });
      setAmount("");
      setNote("");
      onClose();
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.counterparty_name} · reste ${formatMoney(target.remaining_amount)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Montant (F CFA)">
            <Input
              type="number"
              min="1"
              max={target?.remaining_amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Note (optionnel)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Espèces, Wave…"
            />
          </Field>
          {target && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setAmount(String(target.remaining_amount))}
            >
              Solder entièrement ({formatMoney(target.remaining_amount)})
            </Button>
          )}
          <Button className="w-full" onClick={submit} disabled={paymentMutation.isPending}>
            {paymentMutation.isPending ? "Enregistrement…" : "Valider le paiement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

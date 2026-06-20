import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/use-categories";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import type { Task, Priority, Status } from "@/lib/task-utils";
import { Trash2, Archive, ArchiveRestore } from "lucide-react";
import { todayISO } from "@/lib/dates";
import { SubtasksEditor } from "./SubtasksEditor";

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task;
  defaultDate?: string;
}) {
  const editing = !!task;
  const { data: categories } = useCategories();
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState<Status>("todo");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [reminder, setReminder] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.due_date ?? "");
      setDueTime(task.due_time?.slice(0, 5) ?? "");
      setPriority(task.priority as Priority);
      setStatus(task.status as Status);
      setCategoryId(task.category_id ?? "none");
      setReminder(task.reminder_enabled);
    } else {
      setTitle("");
      setDescription("");
      setDueDate(defaultDate ?? todayISO());
      setDueTime("");
      setPriority("normal");
      setStatus("todo");
      setCategoryId("none");
      setReminder(false);
    }
  }, [open, task, defaultDate]);

  const handleSave = async () => {
    if (!title.trim()) return;
    const reminderAt = reminder && dueDate ? new Date(`${dueDate}T${dueTime || "09:00"}:00`).toISOString() : null;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      priority,
      status,
      category_id: categoryId === "none" ? null : categoryId,
      reminder_enabled: reminder,
      reminder_at: reminderAt,
    };
    if (editing && task) {
      await update.mutateAsync({ id: task.id, patch: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          <DialogDescription>Notez ce que vous voulez accomplir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Appeler le client" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Détails optionnels" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Heure</Label>
              <Input id="time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminée</SelectItem>
                  <SelectItem value="postponed">Reportée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Rappel</p>
              <p className="text-xs text-muted-foreground">Recevoir une alerte à l'heure prévue</p>
            </div>
            <Switch checked={reminder} onCheckedChange={setReminder} />
          </div>
          {editing && task && <SubtasksEditor taskId={task.id} />}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {editing && task && (
            <div className="mr-auto flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await update.mutateAsync({ id: task.id, patch: { is_archived: !task.is_archived } });
                  onOpenChange(false);
                }}
                aria-label={task.is_archived ? "Désarchiver" : "Archiver"}
              >
                {task.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  await del.mutateAsync(task.id);
                  onOpenChange(false);
                }}
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!title.trim() || create.isPending || update.isPending}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
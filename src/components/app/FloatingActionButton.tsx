import { Plus } from "lucide-react";
import { useState } from "react";
import { TaskFormDialog } from "./TaskFormDialog";

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ajouter une tâche"
        className="fixed z-40 right-5 bottom-24 h-14 w-14 rounded-full bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground active:scale-95 transition"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus className="h-6 w-6" />
      </button>
      <TaskFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
import { cn } from "@/lib/utils";
import { PRIORITY_COLOR, PRIORITY_LABEL, type Priority } from "@/lib/task-utils";

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        PRIORITY_COLOR[priority],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
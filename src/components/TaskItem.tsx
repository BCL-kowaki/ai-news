import type { Task } from "@prisma/client";
import { Circle, CheckCircle2, X } from "lucide-react";
import { priorityStyle } from "@/lib/config";
import { formatDueLabel } from "@/lib/datetime";
import { deleteTask, toggleTask } from "@/app/(main)/tasks/actions";

/**
 * タスク1行（ダッシュボードと /tasks で共用）
 * 丸ボタンで完了切替、×で削除。優先度と期限をチップで表示する。
 */
export function TaskItem({ task }: { task: Task }) {
  const done = task.status === "done";
  const prio = priorityStyle(task.priority);
  const due = task.due ? formatDueLabel(task.due) : null;

  return (
    <li className="group flex items-center gap-2.5 py-2">
      {/* 完了切替（44px相当のタップ領域を確保） */}
      <form action={toggleTask} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          className="-m-2 cursor-pointer p-2 text-muted transition-colors duration-200 hover:text-accent"
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" />
          ) : (
            <Circle className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </form>

      <span
        className={`min-w-0 flex-1 truncate text-sm ${done ? "text-faint line-through" : "text-ink"}`}
      >
        {task.title}
      </span>

      {!done && (
        <span className="chip shrink-0" style={{ backgroundColor: prio.bg, color: prio.fg }}>
          {prio.label}
        </span>
      )}
      {!done && due && (
        <span
          className={`shrink-0 text-xs font-medium ${due.overdue ? "text-red-600" : "text-muted"}`}
        >
          {due.overdue ? `期限切れ ${due.label}` : due.label}
        </span>
      )}

      {/* 削除（ホバー/フォーカスで出現。スマホでは常時表示） */}
      <form action={deleteTask} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label="タスクを削除"
          className="-m-1.5 cursor-pointer p-1.5 text-faint transition-colors duration-200 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </li>
  );
}

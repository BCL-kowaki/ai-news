import { ListTodo } from "lucide-react";
import { TASK_PRIORITIES } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { TaskItem } from "@/components/TaskItem";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoResetForm } from "@/components/AutoResetForm";
import { createTask } from "./actions";

/**
 * タスク一覧ページ（/tasks）
 * 追加フォーム＋未完了（優先度→期限順）＋完了済み（直近20件）。
 */

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const data = await loadTasks();

  return (
    <main>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <ListTodo className="h-5 w-5 text-accent" aria-hidden="true" />
        タスク
      </h1>

      {/* 追加フォーム */}
      <AutoResetForm
        action={createTask}
        className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="task-title" className="text-xs font-semibold text-muted">
            やること
          </label>
          <input
            id="task-title"
            name="title"
            required
            maxLength={200}
            placeholder="例：請求書を送る"
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="task-due" className="text-xs font-semibold text-muted">
            期限（任意）
          </label>
          <input id="task-due" name="due" type="date" className="input mt-1 sm:w-40" />
        </div>
        <div>
          <label htmlFor="task-priority" className="text-xs font-semibold text-muted">
            優先度
          </label>
          <select id="task-priority" name="priority" defaultValue="1" className="input mt-1 sm:w-24">
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingLabel="追加中…">追加</SubmitButton>
      </AutoResetForm>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          <section className="card mt-6 p-4">
            <h2 className="text-sm font-semibold text-muted">
              未完了 <span className="ml-1">{data.open.length}件</span>
            </h2>
            {data.open.length === 0 ? (
              <p className="mt-3 text-sm text-muted">未完了のタスクはありません 🎉</p>
            ) : (
              <ul className="mt-1 divide-y divide-line/60">
                {data.open.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            )}
          </section>

          {data.done.length > 0 && (
            <section className="card mt-4 p-4">
              <h2 className="text-sm font-semibold text-muted">完了済み（直近20件）</h2>
              <ul className="mt-1 divide-y divide-line/60">
                {data.done.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

async function loadTasks() {
  try {
    const [open, done] = await Promise.all([
      prisma.task.findMany({
        where: { status: "open" },
        // 優先度が高い順 → 期限が近い順（期限なしは最後）→ 作成が新しい順
        orderBy: [
          { priority: "desc" },
          { due: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
      }),
      prisma.task.findMany({
        where: { status: "done" },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
    ]);
    return { open, done };
  } catch (error) {
    console.error("[タスク] 取得失敗:", error);
    return null;
  }
}

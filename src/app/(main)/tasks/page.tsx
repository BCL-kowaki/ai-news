import Link from "next/link";
import { Archive, ArchiveRestore, X } from "lucide-react";
import { TASK_PRIORITIES } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { TaskItem } from "@/components/TaskItem";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoResetForm } from "@/components/AutoResetForm";
import { createTask } from "./actions";
import { createProject, deleteProject, toggleProjectArchive } from "./project-actions";

/**
 * タスク一覧ページ（/tasks）
 *
 * 追加フォーム＋プロジェクト絞り込み＋未完了（優先度→期限順）＋完了済み（直近20件）。
 * ページ下部でプロジェクト（タスクの1つ上の分類）の追加・アーカイブ・削除ができる。
 *
 * 絞り込みは URL の ?project= で表す（サーバーコンポーネントのまま実現できる）。
 *   未指定 = すべて / <id> = そのプロジェクト / none = プロジェクトなし
 */

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const filter = searchParams.project ?? "";
  const data = await loadTasks(filter);

  return (
    <main>
      <h1 className="large-title">タスク</h1>

      {/* 追加フォーム */}
      <AutoResetForm
        action={createTask}
        className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[12rem] flex-1">
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
          <label htmlFor="task-project" className="text-xs font-semibold text-muted">
            プロジェクト（任意）
          </label>
          <select
            id="task-project"
            name="projectId"
            // 絞り込み中はそのプロジェクトを初期選択にする（そのまま追加できる）
            defaultValue={data?.projects.some((p) => p.id === filter) ? filter : ""}
            className="input mt-1 sm:w-44"
          >
            <option value="">なし</option>
            {data?.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
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
          {/* プロジェクトでの絞り込み（1つ以上あるときだけ出す） */}
          {data.projects.length > 0 && (
            <nav className="mt-5 flex flex-wrap gap-2" aria-label="プロジェクトで絞り込み">
              <FilterChip href="/tasks" label="すべて" active={filter === ""} />
              {data.projects.map((project) => (
                <FilterChip
                  key={project.id}
                  href={`/tasks?project=${project.id}`}
                  label={project.name}
                  active={filter === project.id}
                  color={project.color}
                />
              ))}
              <FilterChip href="/tasks?project=none" label="なし" active={filter === "none"} />
            </nav>
          )}

          <section className="card mt-4 p-4">
            <h2 className="text-sm font-semibold text-muted">
              未完了 <span className="ml-1">{data.open.length}件</span>
            </h2>
            {data.open.length === 0 ? (
              <p className="mt-3 text-sm text-muted">未完了のタスクはありません 🎉</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {data.open.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            )}
          </section>

          {data.done.length > 0 && (
            <section className="card mt-4 p-4">
              <h2 className="text-sm font-semibold text-muted">完了済み（直近20件）</h2>
              <ul className="mt-1 divide-y divide-line">
                {data.done.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            </section>
          )}

          {/* プロジェクト管理（タスクの1つ上の分類） */}
          <section className="card mt-4 p-4">
            <h2 className="text-sm font-semibold text-muted">プロジェクト</h2>
            <p className="mt-1 text-xs text-muted">
              クライアントや参加しているプロダクト単位でタスクを分類できます。
            </p>

            <AutoResetForm action={createProject} className="mt-3 flex gap-2">
              <input
                name="name"
                required
                maxLength={60}
                placeholder="例：〇〇株式会社 / 自社アプリ"
                className="input flex-1"
                aria-label="プロジェクト名"
              />
              <SubmitButton pendingLabel="追加中…">追加</SubmitButton>
            </AutoResetForm>

            {data.allProjects.length === 0 ? (
              <p className="mt-3 text-sm text-muted">まだプロジェクトがありません。</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {data.allProjects.map((project) => (
                  <li key={project.id} className="flex items-center gap-2.5 py-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-line"
                      style={{ backgroundColor: project.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        project.archived ? "text-faint line-through" : "text-ink"
                      }`}
                    >
                      {project.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {project._count.tasks}件
                    </span>

                    {/* アーカイブ切替（終了案件を絞り込みから隠す。タスクは残る） */}
                    <form action={toggleProjectArchive} className="shrink-0">
                      <input type="hidden" name="id" value={project.id} />
                      <button
                        type="submit"
                        aria-label={project.archived ? "進行中に戻す" : "アーカイブする"}
                        title={project.archived ? "進行中に戻す" : "アーカイブする"}
                        className="-m-1.5 cursor-pointer p-1.5 text-faint transition-colors duration-200 hover:text-ink"
                      >
                        {project.archived ? (
                          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Archive className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </form>

                    {/* 削除（タスクは消えず「なし」に戻る） */}
                    <form action={deleteProject} className="shrink-0">
                      <input type="hidden" name="id" value={project.id} />
                      <button
                        type="submit"
                        aria-label="プロジェクトを削除"
                        title="削除（タスクは残り「なし」になります）"
                        className="-m-1.5 cursor-pointer p-1.5 text-faint transition-colors duration-200 hover:text-red-600"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/** 絞り込みチップ（選択中は色を反転させる） */
function FilterChip({
  href,
  label,
  active,
  color,
}: {
  href: string;
  label: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className="chip max-w-[10rem] truncate"
      style={
        active
          ? { backgroundColor: color ?? "#382C28", color: "#FFF9EC" }
          : color
            ? { backgroundColor: `${color}33`, color }
            : undefined
      }
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

async function loadTasks(filter: string) {
  // 絞り込み条件：未指定=すべて / none=未所属 / それ以外=そのプロジェクト
  const projectWhere =
    filter === "" ? {} : filter === "none" ? { projectId: null } : { projectId: filter };

  try {
    const [open, done, projects, allProjects] = await Promise.all([
      prisma.task.findMany({
        where: { status: "open", ...projectWhere },
        // 優先度が高い順 → 期限が近い順（期限なしは最後）→ 作成が新しい順
        orderBy: [
          { priority: "desc" },
          { due: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        include: { project: { select: { id: true, name: true, color: true } } },
      }),
      prisma.task.findMany({
        where: { status: "done", ...projectWhere },
        orderBy: { completedAt: "desc" },
        take: 20,
        include: { project: { select: { id: true, name: true, color: true } } },
      }),
      // 絞り込み・選択に出すのは進行中のみ（アーカイブ済みは隠す）
      prisma.project.findMany({
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
      }),
      // 管理エリアにはアーカイブ済みも含めて全部出す
      prisma.project.findMany({
        orderBy: [{ archived: "asc" }, { sortOrder: "asc" }],
        include: { _count: { select: { tasks: true } } },
      }),
    ]);
    return { open, done, projects, allProjects };
  } catch (error) {
    console.error("[タスク] 取得失敗:", error);
    return null;
  }
}

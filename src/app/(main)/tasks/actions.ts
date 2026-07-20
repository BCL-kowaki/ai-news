"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

/**
 * タスクのサーバーアクション（作成・完了切替・削除）
 *
 * ミドルウェアで守られているが、Server Actionは外部から直接叩ける可能性もあるため、
 * 各アクションの先頭でもセッションを確認する（多層防御）。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

/** 変更が映る画面をまとめて再描画する */
function revalidateTaskViews(): void {
  revalidatePath("/");
  revalidatePath("/tasks");
}

/** タスク作成。ダッシュボードのクイック追加と /tasks のフォーム共用。 */
export async function createTask(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return; // 空のまま送信されたら何もしない

  // 期限は「YYYY-MM-DD」で受け取り、JSTの終日（その日の23:59）として保存する
  const dueRaw = String(formData.get("due") ?? "").trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw)
    ? new Date(`${dueRaw}T23:59:59+09:00`)
    : null;

  // 優先度未指定（ダッシュボードのクイック追加）は「中」。Number(null)=0 になる罠に注意
  const priorityRaw = formData.get("priority");
  const priority =
    priorityRaw !== null && [0, 1, 2].includes(Number(priorityRaw)) ? Number(priorityRaw) : 1;

  // 所属プロジェクト（任意）。空文字（「なし」を選択）は未所属として扱う
  const projectId = normalizeProjectId(formData.get("projectId"));

  await prisma.task.create({
    data: { title: title.slice(0, 200), due, priority, projectId },
  });
  revalidateTaskViews();
}

/** タスクの所属プロジェクトを変更する（一覧のセレクトから呼ばれる） */
export async function setTaskProject(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.task
    .update({
      where: { id },
      data: { projectId: normalizeProjectId(formData.get("projectId")) },
    })
    .catch(() => {
      // タスクが消えている場合は何もしない
    });
  revalidateTaskViews();
}

/** フォーム値 → projectId。空文字・未指定は null（プロジェクトなし）にする。 */
function normalizeProjectId(value: FormDataEntryValue | null): string | null {
  const id = String(value ?? "").trim();
  return id === "" ? null : id;
}

/** 完了 ⇔ 未完了の切り替え */
export async function toggleTask(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;

  const done = task.status === "open";
  await prisma.task.update({
    where: { id },
    data: { status: done ? "done" : "open", completedAt: done ? new Date() : null },
  });
  revalidateTaskViews();
}

/** タスク削除 */
export async function deleteTask(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.task.delete({ where: { id } }).catch(() => {
    // 既に消えている場合は何もしない（二重クリック対策）
  });
  revalidateTaskViews();
}

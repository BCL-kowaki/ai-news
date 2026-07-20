"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { PROJECT_COLORS } from "@/lib/config";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

/**
 * プロジェクトのサーバーアクション（作成・アーカイブ切替・削除）
 *
 * プロジェクトはタスクの1つ上の分類（クライアント案件・参加プロダクト）。
 * ミドルウェアで守られているが、Server Actionは直接叩ける可能性もあるため
 * 各アクションの先頭でもセッションを確認する（多層防御）。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

/** 変更が映る画面をまとめて再描画する */
function revalidateProjectViews(): void {
  revalidatePath("/");
  revalidatePath("/tasks");
}

/** プロジェクト作成。色は作成順にプリセットから自動割り当てする。 */
export async function createProject(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return; // 空のまま送信されたら何もしない

  // 既存件数を使って色と表示順を決める（色は使い切ったら先頭に戻る）
  const count = await prisma.project.count();
  await prisma.project.create({
    data: {
      name: name.slice(0, 60),
      color: PROJECT_COLORS[count % PROJECT_COLORS.length],
      sortOrder: count,
    },
  });
  revalidateProjectViews();
}

/** 進行中 ⇔ アーカイブ の切り替え（終了案件を一覧から隠す。タスクは残る） */
export async function toggleProjectArchive(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return;

  await prisma.project.update({
    where: { id },
    data: { archived: !project.archived },
  });
  revalidateProjectViews();
}

/**
 * プロジェクト削除。
 * スキーマの onDelete: SetNull により、所属していたタスクは削除されず
 * 「プロジェクトなし」に戻るだけ（タスクを失わない安全設計）。
 */
export async function deleteProject(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.project.delete({ where: { id } }).catch(() => {
    // 既に消えている場合は何もしない（二重クリック対策）
  });
  revalidateProjectViews();
}

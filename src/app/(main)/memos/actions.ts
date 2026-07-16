"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

/**
 * メモのサーバーアクション
 *
 * - quick（突発メモ）: とにかく速く書き残す。タイトル無し
 * - pinned（よく使うメモ）: 定型文・住所など何度も使う内容。タイトル付き・編集可能
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

function revalidateMemoViews(): void {
  revalidatePath("/");
  revalidatePath("/memos");
}

/** メモ作成。kind はフォームのhiddenで受け取る（quick / pinned のみ許可） */
export async function createMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const kindRaw = String(formData.get("kind") ?? "quick");
  const kind = kindRaw === "pinned" ? "pinned" : "quick"; // 想定外の値はquick扱い
  const title = String(formData.get("title") ?? "").trim() || null;

  await prisma.memo.create({
    data: { kind, title: title?.slice(0, 100) ?? null, body: body.slice(0, 5000) },
  });
  revalidateMemoViews();
}

/** メモの本文・タイトルを更新（よく使うメモの編集用） */
export async function updateMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) return;

  const title = String(formData.get("title") ?? "").trim() || null;

  await prisma.memo
    .update({
      where: { id },
      data: { title: title?.slice(0, 100) ?? null, body: body.slice(0, 5000) },
    })
    .catch(() => {
      // 既に削除済みなら何もしない
    });
  revalidateMemoViews();
}

/** 突発メモを「よく使うメモ」へ昇格させる */
export async function promoteMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.memo
    .update({ where: { id }, data: { kind: "pinned" } })
    .catch(() => {});
  revalidateMemoViews();
}

/** メモ削除 */
export async function deleteMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.memo.delete({ where: { id } }).catch(() => {
    // 二重クリック対策
  });
  revalidateMemoViews();
}

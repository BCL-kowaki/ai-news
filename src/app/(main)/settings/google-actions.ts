"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

/**
 * Google連携アカウントのサーバーアクション（解除・カレンダー選択の保存）
 * 各アクションの先頭でセッションを確認する（多層防御）。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

/** 連携を解除する（DBからトークンごと削除。Google側の許可はマイアカウントから取り消せる） */
export async function disconnectGoogleAccount(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.googleAccount.delete({ where: { id } }).catch(() => {
    // 既に削除済みなら何もしない
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/mail");
}

/** 表示するカレンダーの選択を保存する（チェックボックスの値をそのまま受け取る） */
export async function saveCalendarSelection(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("accountId") ?? "");
  if (!id) return;

  // checkboxは選択された分だけ "calendarId" キーで複数届く
  const selected = formData
    .getAll("calendarId")
    .map((v) => String(v))
    .filter(Boolean)
    .slice(0, 30); // 念のため上限

  await prisma.googleAccount
    .update({
      where: { id },
      // 1つも選ばれていなければprimaryに戻す（予定が全く出ない状態を防ぐ）
      data: { calendarIds: selected.length > 0 ? selected : ["primary"] },
    })
    .catch(() => {});

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}

/** アカウントの表示ラベルを変更する */
export async function renameGoogleAccount(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "")
    .trim()
    .slice(0, 20);
  if (!id || !label) return;

  await prisma.googleAccount.update({ where: { id }, data: { label } }).catch(() => {});
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/mail");
}

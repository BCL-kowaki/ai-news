"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

/**
 * メモのサーバーアクション
 *
 * - quick（突発メモ）: とにかく速く書き残す。タイトル無し
 * - pinned（よく使うメモ）: 定型文・住所など何度も使う内容。タイトル付き・編集可能
 * - フォルダ（quick/pinned共通のグルーピング）と添付ファイル（Blob）にも対応
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

function revalidateMemoViews(): void {
  revalidatePath("/");
  revalidatePath("/memos");
}

/** BlobのURLだけを添付として受け付ける（外部URLの混入防止） */
const BLOB_URL_PATTERN = /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//;

export type NewAttachment = {
  url: string;
  mime: string;
  name: string;
  bytes: number;
};

export type CreateMemoInput = {
  kind: "quick" | "pinned";
  title: string;
  body: string;
  folderId: string | null;
  attachments: NewAttachment[];
};

/**
 * メモ作成（録音・添付・フォルダ対応版）。
 * MemoComposer（クライアント）から呼ばれる。添付はアップロード済みのBlob URLを受け取る。
 */
export async function createMemoWithExtras(
  input: CreateMemoInput,
): Promise<{ ok: boolean; error?: string }> {
  await assertLoggedIn();

  const body = input.body.trim();
  const attachments = (input.attachments ?? [])
    .filter((a) => BLOB_URL_PATTERN.test(a.url))
    .slice(0, 10); // 1メモの添付は10個まで
  if (!body && attachments.length === 0) {
    return { ok: false, error: "本文か添付のどちらかは必要です" };
  }

  const kind = input.kind === "pinned" ? "pinned" : "quick";
  const title = input.title.trim().slice(0, 100) || null;

  // フォルダは実在するものだけ紐付ける（削除直後の古いIDなどは未分類に落とす）
  let folderId: string | null = null;
  if (input.folderId) {
    const folder = await prisma.memoFolder
      .findUnique({ where: { id: input.folderId } })
      .catch(() => null);
    folderId = folder?.id ?? null;
  }

  await prisma.memo.create({
    data: {
      kind,
      title,
      body: body.slice(0, 10_000),
      folderId,
      attachments: {
        create: attachments.map((a) => ({
          url: a.url,
          mime: a.mime.slice(0, 100),
          name: a.name.slice(0, 200),
          bytes: a.bytes,
        })),
      },
    },
  });
  revalidateMemoViews();
  return { ok: true };
}

/** フォルダ作成 */
export async function createFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!name) return;

  // 同名フォルダは作らない（@uniqueなのでupsertで吸収）
  await prisma.memoFolder
    .upsert({ where: { name }, create: { name }, update: {} })
    .catch(() => {});
  revalidateMemoViews();
}

/** フォルダ名の変更 */
export async function renameFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!id || !name) return;

  await prisma.memoFolder.update({ where: { id }, data: { name } }).catch(() => {
    // 同名フォルダが既にある場合などは何もしない
  });
  revalidateMemoViews();
}

/** フォルダ削除（中のメモは消えず「未分類」に戻る） */
export async function deleteFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.memoFolder.delete({ where: { id } }).catch(() => {});
  revalidateMemoViews();
}

/** メモを別フォルダへ移動（空文字=未分類） */
export async function moveMemoToFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const memoId = String(formData.get("memoId") ?? "");
  if (!memoId) return;
  const folderIdRaw = String(formData.get("folderId") ?? "");

  await prisma.memo
    .update({ where: { id: memoId }, data: { folderId: folderIdRaw || null } })
    .catch(() => {});
  revalidateMemoViews();
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

/** メモ削除（添付ファイルの実体もBlobから消す） */
export async function deleteMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // 添付の実体を先に削除（失敗してもDB削除は続行。孤児ファイルは害が小さい）
  const attachments = await prisma.memoAttachment
    .findMany({ where: { memoId: id }, select: { url: true } })
    .catch(() => []);
  if (attachments.length > 0) {
    await del(attachments.map((a) => a.url)).catch((e) => {
      console.error("[メモ] 添付ファイルの削除に失敗:", e);
    });
  }

  await prisma.memo.delete({ where: { id } }).catch(() => {
    // 二重クリック対策
  });
  revalidateMemoViews();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { purgeMemos } from "@/lib/memo-purge";
import { MEMO_ATTACHMENT_MAX, MEMO_BODY_MAX_LENGTH } from "@/lib/config";

/**
 * メモのサーバーアクション（iPhoneメモ帳方式）
 *
 * - メモは1種類だけ。よく使うものは `pinned` で一覧の先頭に固定する
 * - タイトルは本文1行目を自動で使うので、タイトル専用の入力・保存は無い
 * - 削除は2段階（ゴミ箱 → TRASH_RETENTION_DAYS 経過で完全削除）。
 *   完全削除のときだけ添付の実体をBlobから消す
 *
 * すべてのアクションは先頭でセッション確認する（ミドルウェアがあっても省略しない多層防御）。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

function revalidateMemoViews(): void {
  revalidatePath("/memos");
  revalidatePath("/memos/trash");
}

/** BlobのURLだけを添付として受け付ける（外部URLの混入防止） */
const BLOB_URL_PATTERN = /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//;

export type NewAttachment = {
  url: string;
  mime: string;
  name: string;
  bytes: number;
};

// ---------------------------------------------------------------------------
// メモ本体
// ---------------------------------------------------------------------------

/**
 * 空のメモを作ってすぐ編集画面へ送る（「新規メモ」ボタン）。
 * iPhoneメモ帳と同じく、先に器を作ってから書き始める方式。
 */
export async function createBlankMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  // 一覧でフォルダを絞っていたら、そのフォルダの中に作る
  const folderIdRaw = String(formData.get("folderId") ?? "");
  const folderId = await resolveFolderId(folderIdRaw);

  const memo = await prisma.memo.create({ data: { body: "", folderId } });
  revalidateMemoViews();
  redirect(`/memos/${memo.id}`);
}

/**
 * 本文の保存（編集画面の自動保存から呼ばれる）。
 *
 * 上限は MEMO_BODY_MAX_LENGTH に統一している。
 * ここで作成時と違う上限を使うと、長いメモを開いた瞬間に後半が消える。
 */
export async function saveMemoBody(
  id: string,
  body: string,
): Promise<{ ok: boolean; savedAt?: string; error?: string }> {
  await assertLoggedIn();

  if (!id) return { ok: false, error: "メモが見つかりません" };

  try {
    const memo = await prisma.memo.update({
      where: { id },
      data: { body: body.slice(0, MEMO_BODY_MAX_LENGTH) },
      select: { updatedAt: true },
    });
    // 一覧のタイトル・プレビュー・並び順が変わるので作り直させる
    revalidatePath("/memos");
    return { ok: true, savedAt: memo.updatedAt.toISOString() };
  } catch {
    // 別タブで削除された場合など
    return { ok: false, error: "保存できませんでした（削除された可能性があります）" };
  }
}

/** ピン留めの切り替え */
export async function toggleMemoPin(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const memo = await prisma.memo.findUnique({ where: { id }, select: { pinned: true } });
  if (!memo) return;

  await prisma.memo.update({ where: { id }, data: { pinned: !memo.pinned } });
  revalidateMemoViews();
  revalidatePath(`/memos/${id}`);
}

/** メモを別フォルダへ移動（空文字=未分類） */
export async function moveMemoToFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const memoId = String(formData.get("memoId") ?? "");
  if (!memoId) return;

  const folderId = await resolveFolderId(String(formData.get("folderId") ?? ""));

  await prisma.memo.update({ where: { id: memoId }, data: { folderId } }).catch(() => {});
  revalidateMemoViews();
  revalidatePath(`/memos/${memoId}`);
}

/**
 * ゴミ箱へ入れる（実体はまだ消さない）。
 * 編集画面から呼ばれたときは一覧へ戻す。
 */
export async function trashMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.memo.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => {});
  revalidateMemoViews();

  if (String(formData.get("redirect") ?? "") === "list") redirect("/memos");
}

/** ゴミ箱から戻す */
export async function restoreMemo(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.memo.update({ where: { id }, data: { deletedAt: null } }).catch(() => {});
  revalidateMemoViews();
}

/** 完全削除（添付の実体もBlobから消す。ここだけが後戻りできない操作） */
export async function deleteMemoForever(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await purgeMemos([id]);
  revalidateMemoViews();
}

/** ゴミ箱を空にする（中身すべてを完全削除） */
export async function emptyTrash(): Promise<void> {
  await assertLoggedIn();

  const memos = await prisma.memo.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  });
  await purgeMemos(memos.map((m) => m.id));
  revalidateMemoViews();
}

// ---------------------------------------------------------------------------
// 添付ファイル
// ---------------------------------------------------------------------------

/**
 * アップロード済みBlobをメモの添付として登録する。
 * 戻り値は登録後の添付一覧（編集画面が本文へ画像を差し込むためにIDが必要）。
 */
export async function addMemoAttachments(
  memoId: string,
  items: NewAttachment[],
): Promise<{ ok: boolean; added?: { id: string; name: string; mime: string }[]; error?: string }> {
  await assertLoggedIn();

  const safe = (items ?? []).filter((a) => BLOB_URL_PATTERN.test(a.url));
  if (safe.length === 0) return { ok: false, error: "添付できるファイルがありませんでした" };

  const current = await prisma.memoAttachment.count({ where: { memoId } });
  const room = MEMO_ATTACHMENT_MAX - current;
  if (room <= 0) {
    return { ok: false, error: `添付は1つのメモに${MEMO_ATTACHMENT_MAX}個までです` };
  }

  const added = await Promise.all(
    safe.slice(0, room).map((a) =>
      prisma.memoAttachment.create({
        data: {
          memoId,
          url: a.url,
          mime: a.mime.slice(0, 100),
          name: a.name.slice(0, 200),
          bytes: a.bytes,
        },
        select: { id: true, name: true, mime: true },
      }),
    ),
  );

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  return { ok: true, added };
}

/** 添付を1件外す（実体もBlobから消す） */
export async function removeMemoAttachment(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const attachment = await prisma.memoAttachment.findUnique({
    where: { id },
    select: { url: true, memoId: true },
  });
  if (!attachment) return;

  // 実体の削除に失敗してもDBからは外す（孤児ファイルの害は小さい）
  await del(attachment.url).catch((e) => {
    console.error("[メモ] 添付ファイルの削除に失敗:", e);
  });
  await prisma.memoAttachment.delete({ where: { id } }).catch(() => {});

  revalidatePath(`/memos/${attachment.memoId}`);
  revalidatePath("/memos");
}

// ---------------------------------------------------------------------------
// フォルダ
// ---------------------------------------------------------------------------

/** フォルダ作成 */
export async function createFolder(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!name) return;

  // 同名フォルダは作らない（@uniqueなのでupsertで吸収）
  await prisma.memoFolder.upsert({ where: { name }, create: { name }, update: {} }).catch(() => {});
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

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * フォルダIDを検証して返す（実在しないID・"none"・空文字は未分類=null）。
 * 一覧の絞り込みで使う "none" がそのまま流れてくることがあるため必ず通す。
 */
async function resolveFolderId(raw: string): Promise<string | null> {
  if (!raw || raw === "none") return null;
  const folder = await prisma.memoFolder
    .findUnique({ where: { id: raw }, select: { id: true } })
    .catch(() => null);
  return folder?.id ?? null;
}

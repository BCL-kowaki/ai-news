/**
 * メモの完全削除（ゴミ箱の後片付け）
 *
 * ここを "use server" のアクションファイルに置かないのは意図的。
 * "use server" からexportした関数はHTTPエンドポイントとして外部に公開されるため、
 * cronから呼ぶ「認証を持たない掃除処理」を置くと入口が増えてしまう。
 * 呼び出し側（Server Action=ログイン確認 / cron=CRON_SECRET）で認証を担保する。
 */

import { del } from "@vercel/blob";
import { prisma } from "./prisma";
import { TRASH_RETENTION_DAYS } from "./config";

/**
 * メモを完全削除する（添付の実体 → 行、の順）。
 * 実体の削除に失敗しても行は消す（孤児ファイルの害は小さく、DBに残るほうが混乱する）。
 */
export async function purgeMemos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const attachments = await prisma.memoAttachment
    .findMany({ where: { memoId: { in: ids } }, select: { url: true } })
    .catch(() => []);
  if (attachments.length > 0) {
    await del(attachments.map((a) => a.url)).catch((e) => {
      console.error("[メモ] 添付ファイルの削除に失敗:", e);
    });
  }

  // MemoAttachment は onDelete: Cascade なので子の行はまとめて消える
  await prisma.memo.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

/**
 * 保存期限を過ぎたゴミ箱のメモを完全削除する（毎朝のcronから呼ぶ）。
 * 戻り値は消した件数。
 */
export async function purgeExpiredTrash(): Promise<number> {
  const limit = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expired = await prisma.memo.findMany({
    where: { deletedAt: { not: null, lt: limit } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;

  await purgeMemos(expired.map((m) => m.id));
  return expired.length;
}

import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { TRASH_RETENTION_DAYS } from "@/lib/config";
import { SubmitButton } from "@/components/SubmitButton";
import { TrashList, type TrashItem } from "./TrashList";
import { emptyTrash } from "../actions";

/**
 * 最近削除した項目（/memos/trash）
 *
 * 削除は2段階にしてある。一覧の「削除」はここに移すだけで、
 * TRASH_RETENTION_DAYS 経過したものを毎朝のcronが完全に消す。
 * 「完全に削除」だけが後戻りできない操作（添付の実体もBlobから消える）。
 */

export const dynamic = "force-dynamic";

export default async function MemoTrashPage() {
  const memos = await loadTrash();

  return (
    <main>
      <Link
        href="/memos"
        className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        メモ一覧
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="large-title">最近削除した項目</h1>
        {memos && memos.length > 0 && (
          <form action={emptyTrash}>
            <SubmitButton variant="ghost" pendingLabel="削除中…">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              ゴミ箱を空にする
            </SubmitButton>
          </form>
        )}
      </div>

      <p className="mt-1 text-xs text-faint">
        ここに入れたメモは{TRASH_RETENTION_DAYS}日後に自動で完全削除されます。
      </p>

      {memos === null ? (
        <p className="card mt-4 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <TrashList memos={memos} />
      )}
    </main>
  );
}

async function loadTrash(): Promise<TrashItem[] | null> {
  try {
    const memos = await prisma.memo.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, body: true, deletedAt: true, _count: { select: { attachments: true } } },
    });
    return memos.map((m) => ({
      id: m.id,
      body: m.body,
      deletedAt: m.deletedAt,
      attachmentCount: m._count.attachments,
    }));
  } catch (error) {
    console.error("[メモ] ゴミ箱の取得失敗:", error);
    return null;
  }
}

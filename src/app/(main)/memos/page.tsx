import Link from "next/link";
import { FolderCog, FolderPlus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SubmitButton } from "@/components/SubmitButton";
import { MemoList, type MemoListItem } from "./MemoList";
import { createFolder, deleteFolder, renameFolder } from "./actions";

/**
 * メモ一覧（/memos） — iPhoneメモ帳方式
 *
 * このサーバー側の役目は「全メモとフォルダを渡すこと」と「フォルダ管理」だけ。
 * 検索・絞り込み・並び替え・スワイプ操作は MemoList（クライアント）が受け持つ。
 * サーバーへ行き直さずその場で絞り込めるようにして、ネイティブアプリの感触に近づけている。
 */

export const dynamic = "force-dynamic";

export default async function MemosPage({
  searchParams,
}: {
  searchParams: { folder?: string; sort?: string };
}) {
  const data = await loadMemos();

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1 className="large-title">メモ</h1>
        <Link href="/memos/trash" className="btn-ghost" aria-label="最近削除した項目">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          ゴミ箱
        </Link>
      </div>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          <MemoList
            memos={data.memos}
            folders={data.folders}
            initialFolderId={searchParams.folder}
            initialSort={searchParams.sort}
          />

          {/* フォルダ管理（普段は畳んでおく） */}
          <details className="mt-4">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <FolderCog className="h-3.5 w-3.5" aria-hidden="true" />
              フォルダを管理
            </summary>
            <div className="card mt-2 max-w-md p-4">
              <form action={createFolder} className="flex gap-2">
                <label htmlFor="new-folder" className="sr-only">
                  新しいフォルダ名
                </label>
                <input
                  id="new-folder"
                  name="name"
                  required
                  maxLength={30}
                  placeholder="新しいフォルダ名"
                  className="input flex-1"
                />
                <SubmitButton pendingLabel="…">
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  追加
                </SubmitButton>
              </form>
              {data.folders.length > 0 && (
                <ul className="mt-3 divide-y divide-line">
                  {data.folders.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-2">
                      <form action={renameFolder} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={f.id} />
                        <label htmlFor={`folder-${f.id}`} className="sr-only">
                          フォルダ名
                        </label>
                        <input
                          id={`folder-${f.id}`}
                          name="name"
                          defaultValue={f.name}
                          maxLength={30}
                          className="input flex-1 !py-1.5 text-sm"
                        />
                        <SubmitButton variant="ghost" pendingLabel="…">
                          変更
                        </SubmitButton>
                      </form>
                      <form action={deleteFolder}>
                        <input type="hidden" name="id" value={f.id} />
                        <SubmitButton variant="ghost" pendingLabel="…">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-faint">
                フォルダを削除しても中のメモは消えません（未分類に戻ります）。
              </p>
            </div>
          </details>

          {/* 右下の作成ボタンに隠れないよう、末尾に余白を作る */}
          <div className="h-20" aria-hidden="true" />
        </>
      )}
    </main>
  );
}

async function loadMemos() {
  try {
    const [folders, memos] = await Promise.all([
      prisma.memoFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.memo.findMany({
        // ゴミ箱のメモは一覧に出さない
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          body: true,
          pinned: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
          folder: { select: { name: true } },
          _count: { select: { attachments: true } },
        },
      }),
    ]);

    const items: MemoListItem[] = memos.map((m) => ({
      id: m.id,
      body: m.body,
      pinned: m.pinned,
      folderId: m.folderId,
      folderName: m.folder?.name ?? null,
      attachmentCount: m._count.attachments,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return { folders, memos: items };
  } catch (error) {
    console.error("[メモ] 取得失敗:", error);
    return null;
  }
}

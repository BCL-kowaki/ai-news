import Link from "next/link";
import { Pin, Trash2, Pencil, FolderPlus, FolderCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";
import { getReadableAudioUrl } from "@/lib/blob";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { Linkify } from "@/components/Linkify";
import { MemoAttachments, type AttachmentView } from "@/components/MemoAttachments";
import { MemoComposer } from "./MemoComposer";
import {
  createFolder,
  deleteFolder,
  deleteMemo,
  moveMemoToFolder,
  promoteMemo,
  renameFolder,
  updateMemo,
} from "./actions";

/**
 * メモページ（/memos)
 *
 * - 突発メモ: 思いついたことを最速で書き残す（録音→文字起こし・添付対応）
 * - よく使うメモ: 定型文・住所・番号などを保存し、コピー・編集して使い回す
 * - フォルダ: 両方共通のグルーピング。チップで絞り込み・後から移動も可能
 */

export const dynamic = "force-dynamic";

type FolderOption = { id: string; name: string };

type MemoView = {
  id: string;
  kind: string;
  title: string | null;
  body: string;
  createdAt: Date;
  folderId: string | null;
  folderName: string | null;
  attachments: AttachmentView[];
};

export default async function MemosPage({
  searchParams,
}: {
  searchParams: { folder?: string };
}) {
  const folderFilter = searchParams.folder; // undefined=すべて / "none"=未分類 / その他=フォルダID
  const data = await loadMemos(folderFilter);

  return (
    <main>
      <h1 className="large-title">メモ</h1>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          {/* フォルダの絞り込みチップ＋管理 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FolderChip href="/memos" label="すべて" active={!folderFilter} />
            <FolderChip href="/memos?folder=none" label="未分類" active={folderFilter === "none"} />
            {data.folders.map((f) => (
              <FolderChip
                key={f.id}
                href={`/memos?folder=${f.id}`}
                label={f.name}
                active={folderFilter === f.id}
              />
            ))}
          </div>

          {/* フォルダ管理（畳んで表示） */}
          <details className="mt-2">
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

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* 突発メモ */}
            <section>
              <h2 className="text-sm font-bold text-muted">突発メモ</h2>
              <div className="mt-2">
                <MemoComposer
                  kind="quick"
                  folders={data.folders}
                  placeholder="思いついたことをそのまま書く…（録音・添付もOK）"
                  submitLabel="残す"
                />
              </div>

              <ul className="mt-3 space-y-3">
                {data.quick.map((memo) => (
                  <li key={memo.id} className="card p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      <Linkify text={memo.body} />
                    </p>
                    <MemoAttachments items={memo.attachments} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs text-faint">
                        {formatJstDateTime(memo.createdAt)}
                        {memo.folderName && (
                          <span className="chip bg-fill text-muted">{memo.folderName}</span>
                        )}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <MoveFolderForm memo={memo} folders={data.folders} />
                        <form action={promoteMemo}>
                          <input type="hidden" name="id" value={memo.id} />
                          <SubmitButton variant="ghost" pendingLabel="…">
                            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                            よく使うへ
                          </SubmitButton>
                        </form>
                        <form action={deleteMemo}>
                          <input type="hidden" name="id" value={memo.id} />
                          <SubmitButton variant="ghost" pendingLabel="…">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            削除
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </li>
                ))}
                {data.quick.length === 0 && (
                  <li className="px-1 py-2 text-sm text-muted">突発メモはまだありません。</li>
                )}
              </ul>
            </section>

            {/* よく使うメモ */}
            <section>
              <h2 className="text-sm font-bold text-muted">よく使うメモ</h2>
              <div className="mt-2">
                <MemoComposer
                  kind="pinned"
                  folders={data.folders}
                  placeholder="定型文・住所・番号など、何度も使う内容…"
                  submitLabel="保存"
                />
              </div>

              <ul className="mt-3 space-y-3">
                {data.pinned.map((memo) => (
                  <PinnedMemoCard key={memo.id} memo={memo} folders={data.folders} />
                ))}
                {data.pinned.length === 0 && (
                  <li className="px-1 py-2 text-sm text-muted">
                    よく使うメモはまだありません。定型文や住所などを登録しておくと便利です。
                  </li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

/** フォルダ絞り込みチップ */
function FolderChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`chip cursor-pointer transition-opacity duration-150 hover:opacity-80 ${
        active ? "bg-accent-soft text-accent" : "bg-card text-muted"
      }`}
    >
      {label}
    </Link>
  );
}

/** フォルダ移動フォーム（select＋移動ボタン） */
function MoveFolderForm({ memo, folders }: { memo: MemoView; folders: FolderOption[] }) {
  if (folders.length === 0) return null;
  return (
    <form action={moveMemoToFolder} className="flex items-center gap-1.5">
      <input type="hidden" name="memoId" value={memo.id} />
      <label htmlFor={`move-${memo.id}`} className="sr-only">
        フォルダ
      </label>
      <select
        id={`move-${memo.id}`}
        name="folderId"
        defaultValue={memo.folderId ?? ""}
        className="input !w-auto !py-1 text-xs"
      >
        <option value="">未分類</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <SubmitButton variant="ghost" pendingLabel="…">
        移動
      </SubmitButton>
    </form>
  );
}

/** よく使うメモ1件（コピー・編集・削除つき） */
function PinnedMemoCard({ memo, folders }: { memo: MemoView; folders: FolderOption[] }) {
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Pin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {memo.title ?? "（無題）"}
          {memo.folderName && (
            <span className="chip bg-fill font-normal text-muted">{memo.folderName}</span>
          )}
        </h3>
        <CopyButton text={memo.body} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
        <Linkify text={memo.body} />
      </p>
      <MemoAttachments items={memo.attachments} />

      {/* 編集（畳んで表示） */}
      <details className="mt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <Pencil className="h-3 w-3" aria-hidden="true" />
          編集・移動
        </summary>
        <form action={updateMemo} className="mt-2 rounded-cell bg-fill p-3">
          <input type="hidden" name="id" value={memo.id} />
          <label htmlFor={`title-${memo.id}`} className="text-xs font-bold text-muted">
            タイトル
          </label>
          <input
            id={`title-${memo.id}`}
            name="title"
            defaultValue={memo.title ?? ""}
            maxLength={100}
            className="input mt-1"
          />
          <label htmlFor={`body-${memo.id}`} className="mt-2 block text-xs font-bold text-muted">
            内容
          </label>
          <textarea
            id={`body-${memo.id}`}
            name="body"
            required
            rows={4}
            maxLength={10000}
            defaultValue={memo.body}
            className="input mt-1 resize-y"
          />
          <div className="mt-2 flex justify-between">
            <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
          </div>
        </form>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <MoveFolderForm memo={memo} folders={folders} />
          <form action={deleteMemo}>
            <input type="hidden" name="id" value={memo.id} />
            <SubmitButton variant="ghost" pendingLabel="…">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              このメモを削除
            </SubmitButton>
          </form>
        </div>
      </details>
    </li>
  );
}

async function loadMemos(folderFilter: string | undefined) {
  try {
    // 絞り込み条件（"none"=未分類、フォルダID指定、未指定=すべて）
    const folderWhere =
      folderFilter === "none"
        ? { folderId: null }
        : folderFilter
          ? { folderId: folderFilter }
          : {};

    const [folders, quickRaw, pinnedRaw] = await Promise.all([
      prisma.memoFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.memo.findMany({
        where: { kind: "quick", ...folderWhere },
        orderBy: { createdAt: "desc" },
        include: { attachments: true, folder: { select: { name: true } } },
      }),
      prisma.memo.findMany({
        where: { kind: "pinned", ...folderWhere },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: { attachments: true, folder: { select: { name: true } } },
      }),
    ]);

    // Private Blobの添付に署名付きURLを発行（表示用・1時間有効）
    const toView = async (memo: (typeof quickRaw)[number]): Promise<MemoView> => ({
      id: memo.id,
      kind: memo.kind,
      title: memo.title,
      body: memo.body,
      createdAt: memo.createdAt,
      folderId: memo.folderId,
      folderName: memo.folder?.name ?? null,
      attachments: await Promise.all(
        memo.attachments.map(async (a) => ({
          id: a.id,
          name: a.name,
          mime: a.mime,
          signedUrl: await getReadableAudioUrl(a.url),
        })),
      ),
    });

    const [quick, pinned] = await Promise.all([
      Promise.all(quickRaw.map(toView)),
      Promise.all(pinnedRaw.map(toView)),
    ]);

    return { folders, quick, pinned };
  } catch (error) {
    console.error("[メモ] 取得失敗:", error);
    return null;
  }
}

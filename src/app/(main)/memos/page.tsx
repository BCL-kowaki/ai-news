import Link from "next/link";
import {
  FolderCog,
  FolderPlus,
  Paperclip,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";
import { memoPreview, memoTitle } from "@/lib/memo";
import { MEMO_SORTS, toMemoSort, type MemoSort } from "@/lib/config";
import { SubmitButton } from "@/components/SubmitButton";
import { createBlankMemo, createFolder, deleteFolder, renameFolder } from "./actions";

/**
 * メモ一覧（/memos） — iPhoneメモ帳方式
 *
 * 一覧はタイトル（本文1行目）とプレビューだけを見せ、本文は詳細画面（/memos/[id]）で編集する。
 * ピン留めしたメモは常に先頭のセクションに固定し、並び替え（?sort=）は下のセクションに効かせる。
 * 絞り込みはフォルダ（?folder=）と全文検索（?q=）の組み合わせ。
 */

export const dynamic = "force-dynamic";

type FolderOption = { id: string; name: string };

type MemoRow = {
  id: string;
  body: string;
  pinned: boolean;
  folderName: string | null;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export default async function MemosPage({
  searchParams,
}: {
  searchParams: { folder?: string; q?: string; sort?: string };
}) {
  const folderFilter = searchParams.folder; // undefined=すべて / "none"=未分類 / その他=フォルダID
  const query = (searchParams.q ?? "").trim();
  const sort = toMemoSort(searchParams.sort);

  const data = await loadMemos(folderFilter, query, sort);

  // 現在の絞り込みを他のリンクへ引き継ぐためのクエリ組み立て
  const linkTo = (overrides: { folder?: string; q?: string; sort?: string }) => {
    const params = new URLSearchParams();
    const folder = "folder" in overrides ? overrides.folder : folderFilter;
    const q = "q" in overrides ? overrides.q : query;
    const s = "sort" in overrides ? overrides.sort : sort;
    if (folder) params.set("folder", folder);
    if (q) params.set("q", q);
    if (s && s !== "updated") params.set("sort", s);
    const qs = params.toString();
    return qs ? `/memos?${qs}` : "/memos";
  };

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1 className="large-title">メモ</h1>
        <div className="flex items-center gap-2">
          <Link href="/memos/trash" className="btn-ghost" aria-label="最近削除した項目">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            ゴミ箱
          </Link>
          {/* 新規メモ：空のメモを作ってすぐ編集画面へ飛ばす */}
          <form action={createBlankMemo}>
            <input type="hidden" name="folderId" value={folderFilter ?? ""} />
            <SubmitButton pendingLabel="作成中…">
              <Plus className="h-4 w-4" aria-hidden="true" />
              新規メモ
            </SubmitButton>
          </form>
        </div>
      </div>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          {/* 検索 */}
          <form method="get" action="/memos" className="mt-4 flex gap-2">
            {folderFilter && <input type="hidden" name="folder" value={folderFilter} />}
            {sort !== "updated" && <input type="hidden" name="sort" value={sort} />}
            <label htmlFor="memo-search" className="sr-only">
              メモを検索
            </label>
            <input
              id="memo-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="メモを検索"
              className="input flex-1"
            />
            <SubmitButton pendingLabel="…">
              <Search className="h-4 w-4" aria-hidden="true" />
              検索
            </SubmitButton>
          </form>

          {/* フォルダの絞り込みチップ */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip href={linkTo({ folder: undefined })} label="すべて" active={!folderFilter} />
            <Chip href={linkTo({ folder: "none" })} label="未分類" active={folderFilter === "none"} />
            {data.folders.map((f) => (
              <Chip
                key={f.id}
                href={linkTo({ folder: f.id })}
                label={f.name}
                active={folderFilter === f.id}
              />
            ))}
          </div>

          {/* 並び替え */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-faint">並び替え</span>
            {MEMO_SORTS.map((s) => (
              <Chip
                key={s.value}
                href={linkTo({ sort: s.value })}
                label={s.label}
                active={sort === s.value}
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

          {/* 検索結果の件数表示 */}
          {query && (
            <p className="mt-3 text-sm text-muted">
              「{query}」の検索結果 {data.pinned.length + data.others.length}件
            </p>
          )}

          {/* ピン留め */}
          {data.pinned.length > 0 && (
            <MemoSection title="ピン留め" icon={<Pin className="h-3 w-3 text-accent" />} rows={data.pinned} />
          )}

          {/* それ以外 */}
          {data.others.length > 0 && (
            <MemoSection
              title={data.pinned.length > 0 ? "メモ" : undefined}
              rows={data.others}
            />
          )}

          {data.pinned.length === 0 && data.others.length === 0 && (
            <p className="card mt-4 p-4 text-sm text-muted">
              {query
                ? "見つかりませんでした。別のことばで探してみてください。"
                : "メモはまだありません。「新規メモ」から書き始められます。"}
            </p>
          )}
        </>
      )}
    </main>
  );
}

/** 絞り込み・並び替えのチップ */
function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
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

/** メモの行リスト（1セクション） */
function MemoSection({
  title,
  icon,
  rows,
}: {
  title?: string;
  icon?: React.ReactNode;
  rows: MemoRow[];
}) {
  return (
    <section className="mt-4">
      {title && (
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-muted">
          {icon}
          {title}
        </h2>
      )}
      <ul className="card mt-2 divide-y divide-line">
        {rows.map((memo) => (
          <li key={memo.id}>
            <Link
              href={`/memos/${memo.id}`}
              className="block px-4 py-3 transition-colors duration-150 hover:bg-bg active:opacity-60"
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 truncate text-[15px] font-bold">{memoTitle(memo.body)}</span>
                {memo.pinned && (
                  <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-label="ピン留め" />
                )}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {memoPreview(memo.body) || "追加のテキストなし"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                <span>{formatJstDateTime(memo.updatedAt)}</span>
                {memo.attachmentCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Paperclip className="h-3 w-3" aria-hidden="true" />
                    {memo.attachmentCount}
                  </span>
                )}
                {memo.folderName && (
                  <span className="chip bg-fill text-muted">{memo.folderName}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function loadMemos(folderFilter: string | undefined, query: string, sort: MemoSort) {
  try {
    // 絞り込み条件（"none"=未分類、フォルダID指定、未指定=すべて）
    const folderWhere =
      folderFilter === "none" ? { folderId: null } : folderFilter ? { folderId: folderFilter } : {};

    // 検索は本文の部分一致（大文字小文字を区別しない）。タイトルは本文1行目なので本文だけで足りる
    const searchWhere = query
      ? { body: { contains: query, mode: "insensitive" as const } }
      : {};

    const [folders, memos] = await Promise.all([
      prisma.memoFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.memo.findMany({
        // ゴミ箱のメモは一覧に出さない
        where: { deletedAt: null, ...folderWhere, ...searchWhere },
        orderBy: sort === "created" ? { createdAt: "desc" } : { updatedAt: "desc" },
        select: {
          id: true,
          body: true,
          pinned: true,
          createdAt: true,
          updatedAt: true,
          folder: { select: { name: true } },
          _count: { select: { attachments: true } },
        },
      }),
    ]);

    const rows: MemoRow[] = memos.map((m) => ({
      id: m.id,
      body: m.body,
      pinned: m.pinned,
      folderName: m.folder?.name ?? null,
      attachmentCount: m._count.attachments,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    // タイトル順は本文1行目から導く値なのでDBでは並べられない。取得後にJSで並べる
    if (sort === "title") {
      rows.sort((a, b) => memoTitle(a.body).localeCompare(memoTitle(b.body), "ja"));
    }

    return {
      folders,
      pinned: rows.filter((m) => m.pinned),
      others: rows.filter((m) => !m.pinned),
    };
  } catch (error) {
    console.error("[メモ] 取得失敗:", error);
    return null;
  }
}

"use client";

import Link from "next/link";
import { ChevronRight, Folder, FolderCog, FolderPlus, Inbox, StickyNote, Trash2 } from "lucide-react";
import { FOLDER_ALL, FOLDER_NONE, FOLDER_TRASH } from "@/lib/config";
import { SubmitButton } from "@/components/SubmitButton";
import type { FolderOption } from "./MemoList";
import { createFolder, deleteFolder, renameFolder } from "./actions";

/**
 * 左ペイン：フォルダ一覧（Macのメモ帳のサイドバー相当）
 *
 * 「すべてのメモ / 未分類 / 各フォルダ / 最近削除した項目」を件数つきで並べる。
 * 選択はURL（?folder=）で表すので、リロードしても・共有しても同じ場所が開く。
 * スマホではこれが最初の画面になり、押すと一覧画面へ進む。
 */

export type FolderCount = {
  all: number;
  none: number;
  trash: number;
  byFolder: Record<string, number>;
};

export function FolderPane({
  folders,
  counts,
  selected,
}: {
  folders: FolderOption[];
  counts: FolderCount;
  selected: string;
}) {
  return (
    <div className="pb-4">
      <h1 className="large-title lg:text-[22px]">メモ</h1>

      <nav aria-label="フォルダ" className="mt-3 space-y-0.5">
        <Row
          href={`/memos?folder=${FOLDER_ALL}`}
          label="すべてのメモ"
          count={counts.all}
          active={selected === FOLDER_ALL}
          icon={<StickyNote className="h-4 w-4" aria-hidden="true" />}
        />
        <Row
          href={`/memos?folder=${FOLDER_NONE}`}
          label="未分類"
          count={counts.none}
          active={selected === FOLDER_NONE}
          icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
        />
        {folders.map((f) => (
          <Row
            key={f.id}
            href={`/memos?folder=${f.id}`}
            label={f.name}
            count={counts.byFolder[f.id] ?? 0}
            active={selected === f.id}
            icon={<Folder className="h-4 w-4" aria-hidden="true" />}
          />
        ))}
        <Row
          href={`/memos?folder=${FOLDER_TRASH}`}
          label="最近削除した項目"
          count={counts.trash}
          active={selected === FOLDER_TRASH}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        />
      </nav>

      {/* フォルダの追加・整理（普段は畳んでおく） */}
      <details className="mt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <FolderCog className="h-3.5 w-3.5" aria-hidden="true" />
          フォルダを管理
        </summary>

        <div className="card mt-2 p-3">
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
              className="input flex-1 !py-1.5 text-sm"
            />
            <SubmitButton variant="ghost" pendingLabel="…">
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
            </SubmitButton>
          </form>

          {folders.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {folders.map((f) => (
                <li key={f.id} className="flex items-center gap-1.5 py-2">
                  <form action={renameFolder} className="flex flex-1 items-center gap-1.5">
                    <input type="hidden" name="id" value={f.id} />
                    <label htmlFor={`folder-${f.id}`} className="sr-only">
                      フォルダ名
                    </label>
                    <input
                      id={`folder-${f.id}`}
                      name="name"
                      defaultValue={f.name}
                      maxLength={30}
                      className="input min-w-0 flex-1 !py-1 text-[13px]"
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
    </div>
  );
}

/** フォルダ1行（件数つき。スマホでは「次の画面へ進む」ことが分かるよう矢印を出す） */
function Row({
  href,
  label,
  count,
  active,
  icon,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[15px] font-bold transition-colors duration-150 active:opacity-60 lg:py-2 lg:text-[14px] ${
        active ? "bg-accent-soft text-accent" : "text-ink hover:bg-fill"
      }`}
    >
      <span className={active ? "text-accent" : "text-muted"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs font-bold text-faint">{count}</span>
      <ChevronRight className="h-4 w-4 text-faint lg:hidden" aria-hidden="true" />
    </Link>
  );
}

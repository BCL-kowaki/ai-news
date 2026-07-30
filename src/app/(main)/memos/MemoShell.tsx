"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FOLDER_ALL, FOLDER_NONE, FOLDER_TRASH } from "@/lib/config";
import { FolderPane, type FolderCount } from "./FolderPane";
import { MemoList, type FolderOption, type MemoListItem } from "./MemoList";
import { TrashList, type TrashItem } from "./TrashList";

/**
 * メモの3ペイン枠（Macのメモ帳と同じ配置）
 *
 * PC(lg以上): 左=フォルダ / 中央=一覧 / 右=本文 を横に並べ、それぞれ独立してスクロールする。
 * スマホ: 並べずに1画面ずつ辿る。どの画面を出すかはURLだけで決まる。
 *   - /memos                … フォルダ一覧
 *   - /memos?folder=all など … メモ一覧（そのフォルダ）
 *   - /memos/[id]           … 本文
 * こうしておくと、戻る操作がブラウザの「戻る」と自然に一致する。
 */

export function MemoShell({
  folders,
  memos,
  trash,
  failed,
  children,
}: {
  folders: FolderOption[];
  memos: MemoListItem[];
  trash: TrashItem[];
  failed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** URLで選ばれているフォルダ。未指定は「すべて」扱い */
  const rawFolder = searchParams.get("folder");
  const folder = rawFolder ?? FOLDER_ALL;

  /** 本文を開いているか（/memos 以外＝/memos/[id]） */
  const showingMemo = pathname !== "/memos";
  /** 開いているメモのID（一覧で選択中を光らせるため） */
  const selectedId = showingMemo ? (pathname.split("/")[2] ?? null) : null;
  /** スマホでフォルダ一覧を出すのは「フォルダ未指定で本文も開いていない」ときだけ */
  const showingFolders = !rawFolder && !showingMemo;

  // フォルダごとの件数（左ペインの数字）。読み込んだ一覧から数えるので追加の問い合わせは不要
  const counts: FolderCount = {
    all: memos.length,
    none: memos.filter((m) => m.folderId === null).length,
    trash: trash.length,
    byFolder: Object.fromEntries(
      folders.map((f) => [f.id, memos.filter((m) => m.folderId === f.id).length]),
    ),
  };

  const currentFolderName =
    folder === FOLDER_ALL
      ? "すべてのメモ"
      : folder === FOLDER_NONE
        ? "未分類"
        : folder === FOLDER_TRASH
          ? "最近削除した項目"
          : (folders.find((f) => f.id === folder)?.name ?? "すべてのメモ");

  if (failed) {
    return (
      <main>
        <h1 className="large-title">メモ</h1>
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      </main>
    );
  }

  /*
   * PCは3列。各列の高さを揃えて中で個別にスクロールさせる
   * （ヘッダー48px + 上下の余白ぶんを引いた高さ）。
   */
  const paneScroll = "lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto";

  return (
    <div className="lg:grid lg:grid-cols-[196px_minmax(272px,320px)_1fr]">
      {/* 左：フォルダ */}
      <aside
        className={`${showingFolders ? "block" : "hidden"} lg:block ${paneScroll} lg:pr-4`}
      >
        <FolderPane folders={folders} counts={counts} selected={folder} />
      </aside>

      {/* 中央：一覧 */}
      <div
        className={`${!showingFolders && !showingMemo ? "block" : "hidden"} lg:block ${paneScroll} lg:border-l-2 lg:border-line lg:px-4`}
      >
        {folder === FOLDER_TRASH ? (
          <TrashList memos={trash} />
        ) : (
          <MemoList
            memos={memos}
            folders={folders}
            folder={folder}
            folderName={currentFolderName}
            selectedId={selectedId}
          />
        )}
      </div>

      {/* 右：本文 */}
      <div
        className={`${showingMemo ? "block" : "hidden"} lg:block ${paneScroll} lg:border-l-2 lg:border-line lg:pl-4`}
      >
        {children}
      </div>
    </div>
  );
}

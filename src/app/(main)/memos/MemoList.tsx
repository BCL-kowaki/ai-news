"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Folder,
  FolderOpen,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { MEMO_SORTS, toMemoSort, type MemoSort } from "@/lib/config";
import { formatMemoTimestamp } from "@/lib/datetime";
import { memoPreview, memoTitle } from "@/lib/memo";
import { SwipeRow, type SwipeAction } from "@/components/SwipeRow";
import { ContextMenu, type MenuItem } from "@/components/ContextMenu";
import {
  createBlankMemoIn,
  duplicateMemoById,
  moveMemoToFolderById,
  toggleMemoPinById,
  trashMemoById,
} from "./actions";

/**
 * メモ一覧の本体（iPhoneメモ帳の操作感を再現するクライアント側）
 *
 * 検索・フォルダ絞り込み・並び替えは**その場で即反映**させたいので、
 * サーバーへ行き直さずここで持つ（ネイティブアプリと同じ感触にするため）。
 * 一覧に出す全メモは最初にサーバーから受け取っている。
 *
 * 操作は3経路。指でも指以外でも同じことができるようにしてある。
 * - 左スワイプ … 複製・削除 / 右スワイプ … ピン留め
 * - 長押し・右クリック … メニュー（ピン留め・複製・フォルダ移動・削除）
 * - 行を開いた先の詳細画面 … 同じ操作をボタンで
 */

export type MemoListItem = {
  id: string;
  body: string;
  pinned: boolean;
  folderId: string | null;
  folderName: string | null;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FolderOption = { id: string; name: string };

type MenuTarget = { memo: MemoListItem; x: number; y: number };

export function MemoList({
  memos,
  folders,
  initialFolderId,
  initialSort,
}: {
  memos: MemoListItem[];
  folders: FolderOption[];
  /** URLから引き継いだ初期の絞り込み（undefined=すべて / "none"=未分類） */
  initialFolderId?: string;
  initialSort?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  /** サーバーから受け取った一覧。操作直後は先に画面を変えて、あとから取り直す */
  const [items, setItems] = useState(memos);
  useEffect(() => setItems(memos), [memos]);

  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | undefined>(initialFolderId);
  const [sort, setSort] = useState<MemoSort>(toMemoSort(initialSort));
  /** 右側の操作ボタンを開いている行（1行だけ開く） */
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [creating, setCreating] = useState(false);

  /** 操作を実行して、画面をサーバーの内容に合わせ直す */
  function run(action: () => Promise<unknown>) {
    setOpenId(null);
    startTransition(() => {
      void action().then(() => router.refresh());
    });
  }

  /** 一覧から消える操作（削除）は先に画面から消して待たせない */
  function trash(memo: MemoListItem) {
    setItems((prev) => prev.filter((m) => m.id !== memo.id));
    run(() => trashMemoById(memo.id));
  }

  function togglePin(memo: MemoListItem) {
    setItems((prev) =>
      prev.map((m) => (m.id === memo.id ? { ...m, pinned: !m.pinned } : m)),
    );
    run(() => toggleMemoPinById(memo.id));
  }

  function duplicate(memo: MemoListItem) {
    run(() => duplicateMemoById(memo.id));
  }

  function moveTo(memo: MemoListItem, targetFolderId: string) {
    run(() => moveMemoToFolderById(memo.id, targetFolderId));
  }

  /** 新規メモ（作ってすぐ編集画面へ） */
  async function createMemo() {
    setCreating(true);
    try {
      const { id } = await createBlankMemoIn(folderId ?? "");
      router.push(`/memos/${id}`);
    } catch {
      setCreating(false);
    }
  }

  // 絞り込み → 検索 → 並び替え。ピン留めは常に先頭へ寄せる
  const { pinned, others, total } = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = items.filter((m) => {
      if (folderId === "none" && m.folderId !== null) return false;
      if (folderId && folderId !== "none" && m.folderId !== folderId) return false;
      if (needle && !m.body.toLowerCase().includes(needle)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "title") return memoTitle(a.body).localeCompare(memoTitle(b.body), "ja");
      if (sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return {
      pinned: sorted.filter((m) => m.pinned),
      others: sorted.filter((m) => !m.pinned),
      total: sorted.length,
    };
  }, [items, query, folderId, sort]);

  /** 長押しメニューの中身（フォルダ移動は候補が多くなりすぎないよう先頭6件まで） */
  function menuItems(memo: MemoListItem): MenuItem[] {
    const base: MenuItem[] = [
      {
        key: "pin",
        label: memo.pinned ? "ピンを外す" : "ピン留め",
        icon: memo.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
        run: () => togglePin(memo),
      },
      {
        key: "duplicate",
        label: "複製",
        icon: <Copy className="h-4 w-4" />,
        run: () => duplicate(memo),
      },
    ];

    if (memo.folderId !== null) {
      base.push({
        key: "move-none",
        label: "未分類へ移動",
        icon: <FolderOpen className="h-4 w-4" />,
        run: () => moveTo(memo, ""),
      });
    }
    for (const f of folders.filter((f) => f.id !== memo.folderId).slice(0, 6)) {
      base.push({
        key: `move-${f.id}`,
        label: `「${f.name}」へ移動`,
        icon: <Folder className="h-4 w-4" />,
        run: () => moveTo(memo, f.id),
      });
    }

    base.push({
      key: "trash",
      label: "削除",
      icon: <Trash2 className="h-4 w-4" />,
      danger: true,
      run: () => trash(memo),
    });
    return base;
  }

  function swipeActions(memo: MemoListItem): { leading: SwipeAction; trailing: SwipeAction[] } {
    return {
      leading: {
        key: "pin",
        label: memo.pinned ? "ピン解除" : "ピン留め",
        icon: memo.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
        tone: "pin",
        run: () => togglePin(memo),
      },
      trailing: [
        {
          key: "duplicate",
          label: "複製",
          icon: <Copy className="h-4 w-4" />,
          tone: "calm",
          run: () => duplicate(memo),
        },
        {
          key: "trash",
          label: "削除",
          icon: <Trash2 className="h-4 w-4" />,
          tone: "danger",
          run: () => trash(memo),
        },
      ],
    };
  }

  return (
    <>
      {/* 検索（打つだけで絞り込む。検索ボタンは要らない） */}
      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor="memo-search" className="sr-only">
          メモを検索
        </label>
        <input
          id="memo-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="メモを検索"
          className="input !pl-9 !pr-9"
        />
        {query && (
          <button
            type="button"
            aria-label="検索をクリア"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-faint hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* フォルダ */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip label="すべて" active={!folderId} onClick={() => setFolderId(undefined)} />
        <Chip label="未分類" active={folderId === "none"} onClick={() => setFolderId("none")} />
        {folders.map((f) => (
          <Chip
            key={f.id}
            label={f.name}
            active={folderId === f.id}
            onClick={() => setFolderId(f.id)}
          />
        ))}
      </div>

      {/* 並び替え */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-faint">並び替え</span>
        {MEMO_SORTS.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            active={sort === s.value}
            onClick={() => setSort(s.value)}
          />
        ))}
      </div>

      {total === 0 ? (
        <p className="card mt-4 p-4 text-sm text-muted">
          {query
            ? `「${query}」に一致するメモはありません。`
            : "メモはまだありません。右下のボタンから書き始められます。"}
        </p>
      ) : (
        <>
          {pinned.length > 0 && (
            <Section title="ピン留め">
              {pinned.map((memo) => (
                <Row
                  key={memo.id}
                  memo={memo}
                  open={openId === memo.id}
                  onOpenChange={(o) => setOpenId(o ? memo.id : null)}
                  onLongPress={(x, y) => setMenu({ memo, x, y })}
                  actions={swipeActions(memo)}
                />
              ))}
            </Section>
          )}
          {others.length > 0 && (
            <Section title={pinned.length > 0 ? "メモ" : undefined}>
              {others.map((memo) => (
                <Row
                  key={memo.id}
                  memo={memo}
                  open={openId === memo.id}
                  onOpenChange={(o) => setOpenId(o ? memo.id : null)}
                  onLongPress={(x, y) => setMenu({ memo, x, y })}
                  actions={swipeActions(memo)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <p className="mt-3 text-center text-xs text-faint">{total}件のメモ</p>
      <p className="mt-1 text-center text-[11px] text-faint">
        左へスワイプで複製・削除／右へスワイプでピン留め／長押しでメニュー
      </p>

      {/* 新規メモ（右下に固定。スマホはタブバーの上に浮かせる） */}
      <button
        type="button"
        onClick={() => void createMemo()}
        disabled={creating}
        aria-label="新規メモ"
        className="btn-primary fixed right-4 z-30 !h-14 !w-14 !rounded-full !px-0 bottom-[calc(env(safe-area-inset-bottom)+68px)] md:bottom-6 md:right-6"
      >
        <Pencil className="h-6 w-6" aria-hidden="true" />
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.memo)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

/** 絞り込み・並び替えのチップ */
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip cursor-pointer transition-opacity duration-150 hover:opacity-80 ${
        active ? "bg-accent-soft text-accent" : "bg-card text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      {title && <h2 className="text-sm font-bold text-muted">{title}</h2>}
      <div className="card mt-2 divide-y divide-line">{children}</div>
    </section>
  );
}

/** メモ1行（スワイプ・長押し対応） */
function Row({
  memo,
  open,
  onOpenChange,
  onLongPress,
  actions,
}: {
  memo: MemoListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLongPress: (x: number, y: number) => void;
  actions: { leading: SwipeAction; trailing: SwipeAction[] };
}) {
  /** 長押しメニューを指の位置に出すため、最後に触った座標を覚えておく */
  const [point, setPoint] = useState({ x: 0, y: 0 });

  return (
    <div onPointerDown={(e) => setPoint({ x: e.clientX, y: e.clientY })}>
      <SwipeRow
        open={open}
        onOpenChange={onOpenChange}
        leading={actions.leading}
        trailing={actions.trailing}
        onLongPress={() => onLongPress(point.x, point.y)}
      >
        <Link
          href={`/memos/${memo.id}`}
          // 長押し中にiOSがテキスト選択・リンクメニューを出すのを抑える
          className="block select-none px-4 py-3 transition-colors duration-150 hover:bg-bg active:opacity-60"
          draggable={false}
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
            <span>{formatMemoTimestamp(memo.updatedAt)}</span>
            {memo.attachmentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {memo.attachmentCount}
              </span>
            )}
            {memo.folderName && <span className="chip bg-fill text-muted">{memo.folderName}</span>}
          </div>
        </Link>
      </SwipeRow>
    </div>
  );
}

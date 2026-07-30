"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, RotateCcw, Trash2 } from "lucide-react";
import { formatMemoTimestamp } from "@/lib/datetime";
import { memoPreview, memoTitle } from "@/lib/memo";
import { SwipeRow } from "@/components/SwipeRow";
import { ContextMenu, type MenuItem } from "@/components/ContextMenu";
import { deleteMemoForeverById, restoreMemoById } from "../actions";

/**
 * ゴミ箱の一覧（スワイプ操作つき）
 *
 * - 右へスワイプ … 元に戻す
 * - 左へスワイプ … 完全に削除（引っ張り切っても実行される。ここだけは後戻りできない）
 * - 長押し・右クリック … 同じ操作をメニューで
 */

export type TrashItem = {
  id: string;
  body: string;
  deletedAt: Date | null;
  attachmentCount: number;
};

export function TrashList({ memos }: { memos: TrashItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(memos);
  useEffect(() => setItems(memos), [memos]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ item: TrashItem; x: number; y: number } | null>(null);

  /** どちらの操作でも行は一覧から消えるので、先に画面から外して待たせない */
  function act(item: TrashItem, action: () => Promise<unknown>) {
    setOpenId(null);
    setItems((prev) => prev.filter((m) => m.id !== item.id));
    startTransition(() => {
      void action().then(() => router.refresh());
    });
  }

  const restore = (item: TrashItem) => act(item, () => restoreMemoById(item.id));
  const purge = (item: TrashItem) => act(item, () => deleteMemoForeverById(item.id));

  function menuItems(item: TrashItem): MenuItem[] {
    return [
      {
        key: "restore",
        label: "元に戻す",
        icon: <RotateCcw className="h-4 w-4" />,
        run: () => restore(item),
      },
      {
        key: "purge",
        label: "完全に削除",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        run: () => purge(item),
      },
    ];
  }

  if (items.length === 0) {
    return <p className="card mt-4 p-4 text-sm text-muted">ゴミ箱は空です。</p>;
  }

  return (
    <>
      <div className="card mt-4 divide-y divide-line">
        {items.map((item) => (
          <TrashRow
            key={item.id}
            item={item}
            open={openId === item.id}
            onOpenChange={(o) => setOpenId(o ? item.id : null)}
            onLongPress={(x, y) => setMenu({ item, x, y })}
            onRestore={() => restore(item)}
            onPurge={() => purge(item)}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-faint">
        右へスワイプで元に戻す／左へスワイプすると「完全削除」ボタンが出ます
      </p>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

function TrashRow({
  item,
  open,
  onOpenChange,
  onLongPress,
  onRestore,
  onPurge,
}: {
  item: TrashItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLongPress: (x: number, y: number) => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const [point, setPoint] = useState({ x: 0, y: 0 });

  return (
    <div onPointerDown={(e) => setPoint({ x: e.clientX, y: e.clientY })}>
      <SwipeRow
        open={open}
        onOpenChange={onOpenChange}
        onLongPress={() => onLongPress(point.x, point.y)}
        // 完全削除は取り消せないので、引っ張り切りでは実行せず必ずボタンを押させる
        allowFullSwipeCommit={false}
        leading={{
          key: "restore",
          label: "元に戻す",
          icon: <RotateCcw className="h-4 w-4" />,
          tone: "calm",
          run: onRestore,
        }}
        trailing={[
          {
            key: "purge",
            label: "完全削除",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            run: onPurge,
          },
        ]}
      >
        <div className="select-none px-4 py-3">
          <p className="truncate text-[15px] font-bold">{memoTitle(item.body)}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {memoPreview(item.body) || "追加のテキストなし"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
            <span>削除 {item.deletedAt ? formatMemoTimestamp(item.deletedAt) : ""}</span>
            {item.attachmentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {item.attachmentCount}
              </span>
            )}
          </div>
        </div>
      </SwipeRow>
    </div>
  );
}

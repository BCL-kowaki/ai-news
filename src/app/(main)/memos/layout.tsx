import { prisma } from "@/lib/prisma";
import { MemoShell } from "./MemoShell";
import type { MemoListItem } from "./MemoList";
import type { TrashItem } from "./TrashList";

/**
 * メモの枠組み（3ペイン）
 *
 * Macのメモ帳と同じ「左=フォルダ / 中央=一覧 / 右=本文」を1つのレイアウトで持つ。
 * 3つのペインで使うデータ（フォルダ・メモ・ゴミ箱）はここで一度に読み、
 * 右ペインの中身だけを children（/memos = 未選択、/memos/[id] = 本文）に任せる。
 *
 * スマホでは3ペインを並べず、1画面ずつ辿る（フォルダ → 一覧 → 本文）。
 * どのペインを見せるかはURLで決まり、判定は MemoShell（クライアント）が行う。
 */

export const dynamic = "force-dynamic";

export default async function MemosLayout({ children }: { children: React.ReactNode }) {
  const data = await loadPanes();

  return (
    <MemoShell
      folders={data?.folders ?? []}
      memos={data?.memos ?? []}
      trash={data?.trash ?? []}
      failed={data === null}
    >
      {children}
    </MemoShell>
  );
}

async function loadPanes() {
  try {
    const [folders, memos, trash] = await Promise.all([
      prisma.memoFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.memo.findMany({
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
      prisma.memo.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        select: { id: true, body: true, deletedAt: true, _count: { select: { attachments: true } } },
      }),
    ]);

    const memoItems: MemoListItem[] = memos.map((m) => ({
      id: m.id,
      body: m.body,
      pinned: m.pinned,
      folderId: m.folderId,
      folderName: m.folder?.name ?? null,
      attachmentCount: m._count.attachments,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    const trashItems: TrashItem[] = trash.map((m) => ({
      id: m.id,
      body: m.body,
      deletedAt: m.deletedAt,
      attachmentCount: m._count.attachments,
    }));

    return { folders, memos: memoItems, trash: trashItems };
  } catch (error) {
    console.error("[メモ] 取得失敗:", error);
    return null;
  }
}

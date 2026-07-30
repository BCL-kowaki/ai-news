import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pin, PinOff, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";
import { getReadableAudioUrl } from "@/lib/blob";
import { memoTitle } from "@/lib/memo";
import { MEMO_ATTACHMENT_MAX } from "@/lib/config";
import { SubmitButton } from "@/components/SubmitButton";
import { MemoAttachments, type AttachmentView } from "@/components/MemoAttachments";
import { MemoEditor } from "./MemoEditor";
import { moveMemoToFolder, removeMemoAttachment, toggleMemoPin, trashMemo } from "../actions";

/**
 * メモ詳細・編集（/memos/[id]）
 *
 * 本文の編集は MemoEditor（クライアント側・自動保存）に任せ、
 * このサーバー側ではピン留め・フォルダ移動・削除・添付一覧を受け持つ。
 * ゴミ箱に入っているメモを直接開いた場合は、編集させずゴミ箱へ案内する。
 */

export const dynamic = "force-dynamic";

export default async function MemoDetailPage({ params }: { params: { id: string } }) {
  const memo = await prisma.memo
    .findUnique({
      where: { id: params.id },
      include: { attachments: { orderBy: { createdAt: "asc" } }, folder: { select: { name: true } } },
    })
    .catch(() => null);

  if (!memo) notFound();

  const folders = await prisma.memoFolder
    .findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } })
    .catch(() => []);

  // Private Blobの添付に署名付きURLを発行（表示用・1時間有効）
  const attachments: AttachmentView[] = await Promise.all(
    memo.attachments.map(async (a) => ({
      id: a.id,
      name: a.name,
      mime: a.mime,
      signedUrl: await getReadableAudioUrl(a.url),
    })),
  );

  // ゴミ箱の中身は編集させない（うっかり書き直して復元し忘れるのを防ぐ）
  if (memo.deletedAt) {
    return (
      <main>
        <BackLink />
        <h1 className="large-title mt-2">{memoTitle(memo.body)}</h1>
        <div className="card mt-4 p-4">
          <p className="text-sm text-muted">
            このメモはゴミ箱に入っています（{formatJstDateTime(memo.deletedAt)}）。
            編集するには、ゴミ箱から元に戻してください。
          </p>
          <Link href="/memos/trash" className="btn-primary mt-3">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            ゴミ箱を開く
          </Link>
        </div>
        <pre className="card mt-4 whitespace-pre-wrap p-4 text-sm text-muted">{memo.body}</pre>
      </main>
    );
  }

  return (
    <main>
      {/*
       * ヘッダーはiPhoneメモ帳に合わせ、戻る＋操作アイコンだけにしている。
       * タイトルは本文の1行目なので、ここに見出しを置くと同じ文字が二重に出てしまう。
       */}
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <div className="flex items-center gap-2">
          <form action={toggleMemoPin}>
            <input type="hidden" name="id" value={memo.id} />
            <SubmitButton variant="ghost" pendingLabel="…">
              {memo.pinned ? (
                <>
                  <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ピンを外す
                </>
              ) : (
                <>
                  <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  ピン留め
                </>
              )}
            </SubmitButton>
          </form>
          <form action={trashMemo}>
            <input type="hidden" name="id" value={memo.id} />
            {/* 一覧へ戻す（編集画面から消したあとに空の画面を見せない） */}
            <input type="hidden" name="redirect" value="list" />
            <SubmitButton variant="ghost" pendingLabel="…">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              削除
            </SubmitButton>
          </form>
        </div>
      </div>

      {/* 日時は本文の上に小さく（iPhoneメモ帳と同じ位置） */}
      <p className="mt-3 text-center text-xs text-faint">
        {formatJstDateTime(memo.updatedAt)}
        {memo.folder?.name && ` ・ ${memo.folder.name}`}
      </p>

      {/* 本文（整形表示＋タップで編集・自動保存） */}
      <MemoEditor memoId={memo.id} initialBody={memo.body} />

      {/* フォルダ */}
      <section className="card mt-4 p-4">
        <h2 className="card-title">フォルダ</h2>
        {folders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            フォルダはまだありません。
            <Link href="/memos" className="ml-1 font-bold text-accent underline">
              一覧の「フォルダを管理」
            </Link>
            から作れます。
          </p>
        ) : (
          <form action={moveMemoToFolder} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="memoId" value={memo.id} />
            <label htmlFor="folder-select" className="sr-only">
              フォルダ
            </label>
            <select
              id="folder-select"
              name="folderId"
              defaultValue={memo.folderId ?? ""}
              className="input !w-auto !min-w-32 !py-1.5 text-sm"
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
            {memo.folder?.name && (
              <span className="text-xs text-faint">現在: {memo.folder.name}</span>
            )}
          </form>
        )}
      </section>

      {/* 添付ファイル */}
      <section className="card mt-4 p-4">
        <h2 className="card-title">
          添付ファイル（{attachments.length}/{MEMO_ATTACHMENT_MAX}）
        </h2>
        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            添付はありません。上の「画像を挿入」「添付」から追加できます。
          </p>
        ) : (
          <>
            <MemoAttachments items={attachments} />
            <ul className="mt-3 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <form action={removeMemoAttachment}>
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton variant="ghost" pendingLabel="…">
                      <X className="h-3 w-3" aria-hidden="true" />
                      <span className="max-w-40 truncate">{a.name}</span>
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">
              名前を押すと添付を外します（ファイルの実体も削除されます）。
              本文に差し込んだ画像は、本文中の記述も消してください。
            </p>
          </>
        )}
      </section>
    </main>
  );
}

/** 一覧へ戻るリンク */
function BackLink() {
  return (
    <Link
      href="/memos"
      className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      メモ一覧
    </Link>
  );
}

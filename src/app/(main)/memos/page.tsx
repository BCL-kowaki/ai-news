import type { Memo } from "@prisma/client";
import { Pin, StickyNote, Trash2, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatJstDateTime } from "@/lib/datetime";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoResetForm } from "@/components/AutoResetForm";
import { createMemo, deleteMemo, promoteMemo, updateMemo } from "./actions";

/**
 * メモページ（/memos)
 *
 * - 突発メモ: 思いついたことを最速で書き残す（タイトル無し・新しい順）
 * - よく使うメモ: 定型文・住所・番号などを保存し、コピー・編集して使い回す
 */

export const dynamic = "force-dynamic";

export default async function MemosPage() {
  const data = await loadMemos();

  return (
    <main>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <StickyNote className="h-5 w-5 text-accent" aria-hidden="true" />
        メモ
      </h1>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* 突発メモ */}
          <section>
            <h2 className="text-sm font-semibold text-muted">突発メモ</h2>
            <AutoResetForm action={createMemo} className="card mt-2 p-4">
              <input type="hidden" name="kind" value="quick" />
              <label htmlFor="quick-body" className="sr-only">
                突発メモの内容
              </label>
              <textarea
                id="quick-body"
                name="body"
                required
                rows={3}
                maxLength={5000}
                placeholder="思いついたことをそのまま書く…"
                className="input resize-y"
              />
              <div className="mt-2 flex justify-end">
                <SubmitButton pendingLabel="保存中…">残す</SubmitButton>
              </div>
            </AutoResetForm>

            <ul className="mt-3 space-y-3">
              {data.quick.map((memo) => (
                <li key={memo.id} className="card p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{memo.body}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-faint">{formatJstDateTime(memo.createdAt)}</span>
                    <div className="flex gap-2">
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
            <h2 className="text-sm font-semibold text-muted">よく使うメモ</h2>

            {/* 追加フォーム（普段は畳んでおく） */}
            <details className="card mt-2">
              <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
                <Plus className="h-4 w-4" aria-hidden="true" />
                新しいよく使うメモ
              </summary>
              <AutoResetForm action={createMemo} className="border-t border-line/60 p-4">
                <input type="hidden" name="kind" value="pinned" />
                <label htmlFor="pinned-title" className="text-xs font-semibold text-muted">
                  タイトル
                </label>
                <input
                  id="pinned-title"
                  name="title"
                  maxLength={100}
                  placeholder="例：自宅の住所"
                  className="input mt-1"
                />
                <label htmlFor="pinned-body" className="mt-3 block text-xs font-semibold text-muted">
                  内容
                </label>
                <textarea
                  id="pinned-body"
                  name="body"
                  required
                  rows={4}
                  maxLength={5000}
                  className="input mt-1 resize-y"
                />
                <div className="mt-2 flex justify-end">
                  <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
                </div>
              </AutoResetForm>
            </details>

            <ul className="mt-3 space-y-3">
              {data.pinned.map((memo) => (
                <PinnedMemoCard key={memo.id} memo={memo} />
              ))}
              {data.pinned.length === 0 && (
                <li className="px-1 py-2 text-sm text-muted">
                  よく使うメモはまだありません。定型文や住所などを登録しておくと便利です。
                </li>
              )}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}

/** よく使うメモ1件（コピー・編集・削除つき） */
function PinnedMemoCard({ memo }: { memo: Memo }) {
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Pin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {memo.title ?? "（無題）"}
        </h3>
        <CopyButton text={memo.body} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{memo.body}</p>

      {/* 編集（畳んで表示） */}
      <details className="mt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-muted transition-colors duration-200 hover:text-ink [&::-webkit-details-marker]:hidden">
          <Pencil className="h-3 w-3" aria-hidden="true" />
          編集
        </summary>
        <form action={updateMemo} className="mt-2 rounded-xl bg-bg p-3">
          <input type="hidden" name="id" value={memo.id} />
          <label htmlFor={`title-${memo.id}`} className="text-xs font-semibold text-muted">
            タイトル
          </label>
          <input
            id={`title-${memo.id}`}
            name="title"
            defaultValue={memo.title ?? ""}
            maxLength={100}
            className="input mt-1"
          />
          <label htmlFor={`body-${memo.id}`} className="mt-2 block text-xs font-semibold text-muted">
            内容
          </label>
          <textarea
            id={`body-${memo.id}`}
            name="body"
            required
            rows={4}
            maxLength={5000}
            defaultValue={memo.body}
            className="input mt-1 resize-y"
          />
          <div className="mt-2 flex justify-between">
            <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
          </div>
        </form>
        <form action={deleteMemo} className="mt-2 flex justify-end">
          <input type="hidden" name="id" value={memo.id} />
          <SubmitButton variant="ghost" pendingLabel="…">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            このメモを削除
          </SubmitButton>
        </form>
      </details>
    </li>
  );
}

async function loadMemos() {
  try {
    const [quick, pinned] = await Promise.all([
      prisma.memo.findMany({ where: { kind: "quick" }, orderBy: { createdAt: "desc" } }),
      prisma.memo.findMany({
        where: { kind: "pinned" },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      }),
    ]);
    return { quick, pinned };
  } catch (error) {
    console.error("[メモ] 取得失敗:", error);
    return null;
  }
}

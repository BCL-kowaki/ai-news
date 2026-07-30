import { StickyNote } from "lucide-react";

/**
 * 右ペインの初期表示（メモを選んでいないとき）
 *
 * 3ペインの枠とデータは layout.tsx が持つので、ここは「まだ選ばれていない」ことを伝えるだけ。
 * スマホではこのペイン自体が隠れる（フォルダ一覧か、メモ一覧が表示される）。
 */

export const dynamic = "force-dynamic";

export default function MemosIndexPage() {
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-2 py-20 text-faint lg:flex">
      <StickyNote className="h-10 w-10" aria-hidden="true" />
      <p className="text-sm font-bold">メモを選択してください</p>
      <p className="text-xs">左のフォルダから選ぶか、「新規」で書き始められます。</p>
    </div>
  );
}

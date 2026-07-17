import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * ルートレイアウト（全ページ共通の骨格）
 *
 * フォントはAppleのシステムフォント（tailwind.config.ts の fontFamily 参照）。
 * iPhone/MacではSF Pro＋ヒラギノ角ゴになり、ネイティブアプリと同じ文字になる。
 * ナビゲーション付きの画面枠は src/app/(main)/layout.tsx（ログイン画面には出さないため分離）。
 */

export const metadata: Metadata = {
  title: "AI秘書",
  description: "ニュース・予定・メール・タスク・メモを1画面に集約する個人用秘書ダッシュボード",
  robots: { index: false, follow: false }, // 個人用のため検索エンジンには載せない
};

export const viewport: Viewport = {
  themeColor: "#f8f3e8", // ステータスバー周りをページ背景（紙色）と揃える
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

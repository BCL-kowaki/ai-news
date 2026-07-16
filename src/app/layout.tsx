import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

/**
 * ルートレイアウト（全ページ共通の骨格）
 *
 * フォントの読み込みとbodyの基本スタイルだけを担当する。
 * ナビゲーション付きの画面枠は src/app/(main)/layout.tsx（ログイン画面には出さないため分離）。
 */

// 欧文: Inter / 日本語: Noto Sans JP（next/fontがビルド時に取得しCSS変数で注入する）
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "AI秘書",
  description: "ニュース・予定・メール・タスク・メモを1画面に集約する個人用秘書ダッシュボード",
  robots: { index: false, follow: false }, // 個人用のため検索エンジンには載せない
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJp.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

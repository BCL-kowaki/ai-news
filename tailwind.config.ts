import type { Config } from "tailwindcss";

/**
 * デザイントークン（iOSネイティブ調）
 *
 * 色の実体は globals.css の CSS変数（:root）にあり、ここでは名前を割り当てるだけ。
 * → 配色変更・ダークモード対応は globals.css の変数を書き換えれば全体に効く。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", // ページ背景（iOS systemGroupedBackground）
        card: "var(--card)", // カード背景
        ink: "var(--ink)", // 本文
        muted: "var(--muted)", // 補助テキスト（secondaryLabel）
        faint: "var(--faint)", // 最弱テキスト（tertiaryLabel）
        line: "var(--line)", // ヘアライン区切り
        accent: "var(--accent)", // iOSブルー
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        fill: "var(--fill)", // 入力欄・グレーボタンの塗り
      },
      fontFamily: {
        // Appleのシステムフォント優先（SF Pro / ヒラギノ角ゴ）。他OSは各システムフォントへ
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Hiragino Sans",
          "Segoe UI",
          "Yu Gothic UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "1.25rem", // 20px。iOSウィジェット風のカード角丸
        cell: "0.75rem", // 12px。リストのインセットグループ用
      },
    },
  },
  plugins: [],
};

export default config;

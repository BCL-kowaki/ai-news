import type { Config } from "tailwindcss";

/**
 * デザイントークン（エディトリアル調。参考: yuji.uk/html/260713）
 *
 * 色の実体は globals.css の CSS変数（:root）にあり、ここでは名前を割り当てるだけ。
 * → 配色変更は globals.css の変数を書き換えれば全体に効く。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", // ページ背景（紙・クリーム）
        "bg-deep": "var(--bg-deep)", // 濃いめの紙
        card: "var(--card)", // カード背景
        ink: "var(--ink)", // 本文（濃茶）
        muted: "var(--muted)", // 補助テキスト
        faint: "var(--faint)", // 最弱テキスト
        line: "var(--line)", // 枠線（茶）
        accent: "var(--accent)", // アクセント（レンガ赤）
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        fill: "var(--fill)", // 入力欄などの塗り
      },
      fontFamily: {
        // 参考サイトと同じシステムフォント構成
        sans: ["system-ui", "Hiragino Sans", "Yu Gothic", "sans-serif"],
      },
      boxShadow: {
        // ずらした硬い影（ぼかしゼロ）。エディトリアル調の要
        card: "5px 6px 0 var(--hard-shadow)",
      },
      borderRadius: {
        card: "11px", // カードの角丸（参考サイトのframe）
        cell: "8px", // 内側ボックス用
      },
    },
  },
  plugins: [],
};

export default config;

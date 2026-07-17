/**
 * 本文中のURLを自動でリンクにして表示する（サーバーコンポーネント対応）
 *
 * https:// / http:// で始まる文字列をアンカーに変換し、新しいタブで開く。
 * それ以外のテキストはそのまま（whitespace-pre-wrapは親側で指定する）。
 */

// キャプチャ付きで分割すると、奇数番目の要素がURLになる
const URL_PATTERN = /(https?:\/\/[^\s<>"「」（）]+)/g;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-accent underline underline-offset-2 hover:opacity-70"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

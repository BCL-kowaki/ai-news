"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

/**
 * レポート共有リンクの表示・コピー（クライアント側）
 *
 * 共有ONのときだけ表示され、リンクのコピーができる。
 * URLは表示時にブラウザ側で組み立てる（本番・ローカルどちらでも正しいURLになる）。
 */
export function ShareReportBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  // サーバー描画時は location が無いので、その間は相対パスを見せておく
  const url =
    typeof window === "undefined" ? `/share/${token}` : `${window.location.origin}/share/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーできない環境では、テキストを選択して手動コピーしてもらう
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-bg p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        共有リンク（ログイン不要・レポートのみ）
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="共有リンク"
          className="input min-w-0 flex-1 text-xs"
        />
        <button type="button" onClick={copy} className="btn-ghost shrink-0">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              コピーしました
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              コピー
            </>
          )}
        </button>
      </div>
    </div>
  );
}

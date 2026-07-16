"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** メモ本文をクリップボードへコピーするボタン（定型文の貼り付け用） */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="本文をコピー"
      className="btn-ghost"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
          コピーしました
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          コピー
        </>
      )}
    </button>
  );
}

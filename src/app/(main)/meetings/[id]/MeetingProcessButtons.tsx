"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";

/**
 * 文字起こし・レポート生成の実行ボタン
 * 処理は数十秒〜数分かかるため、実行中はボタンを無効化して進行表示する。
 */
export function MeetingProcessButtons({
  meetingId,
  hasTranscript,
  isBusy,
}: {
  meetingId: string;
  hasTranscript: boolean;
  isBusy: boolean; // サーバー側で transcribing / summarizing 中
}) {
  const router = useRouter();
  const [running, setRunning] = useState<"transcribe" | "summarize" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: "transcribe" | "summarize") {
    setRunning(kind);
    setMessage(
      kind === "transcribe"
        ? "文字起こし中です。会議の長さに応じて数分かかることがあります…"
        : "レポートを生成中です…",
    );
    try {
      const res = await fetch(`/api/meetings/${meetingId}/${kind}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(res.ok ? null : json.error ?? "処理に失敗しました。");
    } catch {
      setMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  const disabled = running !== null || isBusy;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("transcribe")}
          disabled={disabled}
          className="btn-primary"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {hasTranscript ? "文字起こしをやり直す" : "文字起こしする"}
        </button>
        <button
          type="button"
          onClick={() => run("summarize")}
          disabled={disabled || !hasTranscript}
          title={hasTranscript ? "レポートを生成" : "先に文字起こしが必要です"}
          className="btn-primary"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          レポートを作る
        </button>
      </div>
      {(message || isBusy) && (
        <p className="mt-2 text-sm font-medium text-muted">
          {message ?? "処理を実行中です。しばらくしてから再読み込みしてください…"}
        </p>
      )}
    </div>
  );
}

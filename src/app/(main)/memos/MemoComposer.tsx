"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Mic, Paperclip, Square, X } from "lucide-react";
import { createMemoWithExtras, type NewAttachment } from "./actions";

/**
 * メモ作成フォーム（録音→文字起こし・添付・フォルダ対応）
 *
 * - 録音: 停止するとGeminiで文字起こしして本文に挿入（音声も添付として保存）
 * - 添付: 画像・動画・PDF・音声。ブラウザからBlobへ直接アップロード
 * - フォルダ: 作成時に選択（後から移動も可能）
 */

type FolderOption = { id: string; name: string };

export function MemoComposer({
  kind,
  folders,
  placeholder,
  submitLabel,
}: {
  kind: "quick" | "pinned";
  folders: FolderOption[];
  placeholder: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [folderId, setFolderId] = useState("");
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const [busy, setBusy] = useState<"idle" | "recording" | "transcribing" | "uploading" | "saving">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 画面を離れるときにマイクを解放
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /** ファイルをBlobへアップロードして添付リストに加える */
  async function uploadAttachment(data: Blob, name: string, mime: string): Promise<NewAttachment> {
    // "audio/webm;codecs=opus" のようなコーデック付きは許可リストに合わないため素の形式に正規化
    const baseMime = mime.split(";")[0].trim();
    const uploaded = await upload(`memos/${name}`, data, {
      access: "private",
      handleUploadUrl: "/api/uploads",
      contentType: baseMime,
    });
    return { url: uploaded.url, mime: baseMime, name, bytes: data.size };
  }

  /** 録音の開始・停止 */
  async function toggleRecording() {
    if (busy === "recording") {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => void finishRecording(recorder.mimeType || "audio/webm");
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start(10_000);
      setBusy("recording");
    } catch {
      setError("マイクを使用できません。ブラウザの設定を確認してください。");
    }
  }

  /** 録音停止後: アップロード→文字起こし→本文に挿入 */
  async function finishRecording(mime: string) {
    setBusy("transcribing");
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "m4a" : "webm";
      const attachment = await uploadAttachment(blob, `voice-memo.${ext}`, mime);
      setAttachments((prev) => [...prev, attachment]);

      const res = await fetch("/api/memos/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: attachment.url, mime }),
      });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (res.ok && json.text) {
        setBody((prev) => (prev ? `${prev}\n${json.text}` : json.text ?? ""));
      } else {
        setError(json.error ?? "文字起こしに失敗しました（音声は添付済み）");
      }
    } catch {
      setError(
        "録音の保存に失敗しました。Vercel Blob（BLOB_READ_WRITE_TOKEN）の設定を確認してください。",
      );
    } finally {
      setBusy("idle");
    }
  }

  /** ファイル添付 */
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy("uploading");
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const attachment = await uploadAttachment(
          file,
          file.name,
          file.type || "application/octet-stream",
        );
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch {
      setError(
        "添付のアップロードに失敗しました。Vercel Blob（BLOB_READ_WRITE_TOKEN）の設定を確認してください。",
      );
    } finally {
      setBusy("idle");
    }
  }

  /** 保存 */
  async function save() {
    setBusy("saving");
    setError(null);
    try {
      const result = await createMemoWithExtras({
        kind,
        title,
        body,
        folderId: folderId || null,
        attachments,
      });
      if (result.ok) {
        setTitle("");
        setBody("");
        setAttachments([]);
        router.refresh();
      } else {
        setError(result.error ?? "保存に失敗しました");
      }
    } finally {
      setBusy("idle");
    }
  }

  const disabled = busy !== "idle";

  return (
    <div className="card p-4">
      {kind === "pinned" && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="タイトル（例：自宅の住所）"
          className="input mb-2"
          disabled={disabled}
          aria-label="タイトル"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={10_000}
        placeholder={placeholder}
        className="input resize-y"
        disabled={busy === "saving"}
        aria-label="メモの内容"
      />

      {/* 添付プレビュー（保存前） */}
      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <li
              key={a.url}
              className="chip bg-fill text-ink"
              title={a.name}
            >
              <span className="max-w-40 truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`${a.name} を添付から外す`}
                className="cursor-pointer text-faint hover:text-accent"
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* 録音（トグル） */}
        <button
          type="button"
          onClick={toggleRecording}
          disabled={busy === "transcribing" || busy === "uploading" || busy === "saving"}
          className={busy === "recording" ? "btn-primary !bg-red-600" : "btn-ghost"}
        >
          {busy === "recording" ? (
            <>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              停止して文字起こし
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              録音
            </>
          )}
        </button>

        {/* ファイル添付 */}
        <label className={`btn-ghost ${disabled ? "pointer-events-none opacity-40" : ""}`}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          添付
          <input
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,audio/*"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {/* フォルダ選択 */}
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="input !w-auto !min-w-28 !py-1.5 text-[13px]"
          disabled={disabled}
          aria-label="フォルダ"
        >
          <option value="">未分類</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <div className="ml-auto">
          <button type="button" onClick={save} disabled={disabled} className="btn-primary">
            {busy === "saving" ? "保存中…" : submitLabel}
          </button>
        </div>
      </div>

      {busy === "transcribing" && (
        <p className="mt-2 text-sm font-medium text-muted">文字起こし中…（本文に挿入されます）</p>
      )}
      {busy === "uploading" && (
        <p className="mt-2 text-sm font-medium text-muted">アップロード中…</p>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

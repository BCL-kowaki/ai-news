"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Mic, Square, Upload } from "lucide-react";
import { createMeeting } from "./actions";

/**
 * 会議の録音・音声取り込みカード
 *
 * - 録音: ブラウザのマイク（MediaRecorder）。停止するとBlobへアップロード→会議として登録
 * - 取り込み: 手元の音声ファイル（m4a/mp3等）をアップロードして登録
 * 音声本体はブラウザからVercel Blobへ直接送る（サーバーの4.5MB制限を回避）。
 */

type Phase = "idle" | "recording" | "uploading";

/** ブラウザが録音に使えるMIMEタイプを選ぶ（Chrome系=webm / Safari=mp4） */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function MeetingRecorder() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [title, setTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 画面を離れるときにマイクを確実に解放する
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined,
      );

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void finishRecording();
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = new Date();
      recorder.start(10_000); // 10秒ごとにデータを回収（長時間でもメモリに優しい）

      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setPhase("recording");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "マイクの使用が許可されていません。ブラウザの設定でこのサイトのマイクを許可してください。"
          : "録音を開始できませんでした。マイクが使える環境か確認してください。",
      );
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop(); // onstop → finishRecording
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  /** 録音停止後：Blobへアップロードして会議として登録 */
  async function finishRecording() {
    const mime = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    const startedAt = startedAtRef.current ?? new Date();
    const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
    const ext = mime.includes("mp4") ? "m4a" : "webm";
    await saveMeeting(blob, `recording.${ext}`, mime, startedAt, durationSec);
  }

  /** 音声ファイルの取り込み */
  async function handleFile(file: File) {
    setError(null);
    await saveMeeting(file, file.name, file.type || "audio/mpeg", new Date(), null);
  }

  /** 共通：Blobへアップロード → 会議レコード作成 → 詳細ページへ */
  async function saveMeeting(
    data: Blob,
    filename: string,
    mime: string,
    recordedAt: Date,
    durationSec: number | null,
  ) {
    setPhase("uploading");
    try {
      const uploaded = await upload(`meetings/${filename}`, data, {
        access: "private", // 会議音声は機密。再生時はサーバーが署名付きURLを発行する
        handleUploadUrl: "/api/meetings/upload",
        contentType: mime,
      });

      const result = await createMeeting({
        title,
        recordedAtISO: recordedAt.toISOString(),
        durationSec,
        audioUrl: uploaded.url,
        audioMime: mime,
        audioBytes: data.size,
      });

      if (result.ok && result.id) {
        router.push(`/meetings/${result.id}`);
        router.refresh();
      } else {
        setError(result.calendarMessage || "会議の登録に失敗しました。");
        setPhase("idle");
      }
    } catch (e) {
      console.error("[会議] アップロード失敗:", e);
      setError(
        "音声のアップロードに失敗しました。Vercel Blob（BLOB_READ_WRITE_TOKEN）の設定を確認してください。",
      );
      setPhase("idle");
    }
  }

  return (
    <section className="card p-5">
      <label htmlFor="meeting-title" className="text-xs font-semibold text-muted">
        会議名（あとで変更不可・空なら「会議」）
      </label>
      <input
        id="meeting-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        placeholder="例：定例ミーティング"
        className="input mt-1"
        disabled={phase !== "idle"}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {phase === "recording" ? (
          <>
            <button type="button" onClick={stopRecording} className="btn-primary !bg-red-600">
              <Square className="h-4 w-4" aria-hidden="true" />
              停止して保存
            </button>
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-red-600">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
              録音中 {formatElapsed(elapsed)}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              disabled={phase === "uploading"}
              className="btn-primary"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              録音を開始
            </button>

            {/* 音声ファイルの取り込み */}
            <label className={`btn-ghost ${phase === "uploading" ? "opacity-40" : ""}`}>
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              音声ファイルを取り込む
              <input
                type="file"
                accept="audio/*,.m4a,.webm"
                className="sr-only"
                disabled={phase === "uploading"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}

        {phase === "uploading" && (
          <span className="text-sm font-semibold text-muted">アップロード中…</span>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        保存すると自動でGoogleカレンダーに「会議: 会議名」が登録されます（書き込み権限のあるアカウントがある場合）。
        文字起こしとレポート生成は保存後の詳細画面から実行できます。
      </p>
    </section>
  );
}

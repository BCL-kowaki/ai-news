"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { speakNews } from "@/app/actions";
import type { NewsAudioScope } from "@/lib/news-audio";

/**
 * ニュースを音声で聞くボタン（記事1本 / ジャンル別 / 受信箱ぜんぶ）
 *
 * 押すと原稿づくり（AI）→音声化を行うため数秒〜十数秒かかる。その間はローディング表示。
 * 音声ファイルを再生するので、画面を消しても再生が続く（通勤中に聞ける）。
 *
 * 【iOSの自動再生制限への対応】
 * iOSでは「ユーザーの操作の中で」再生を始めないと音が出ない。
 * 生成完了後の再生は操作から時間が空くため、押した瞬間に無音を1回鳴らして
 * オーディオ要素のロックを解除しておき、あとからURLを差し替えて再生する。
 */

/** ロック解除用の無音WAV（44バイトのヘッダーのみ） */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

type Props = {
  scope: NewsAudioScope;
  /** ボタンの見た目。icon=一覧の行に置く小さいボタン / button=見出し横の通常ボタン */
  variant?: "icon" | "button";
  /** button のときのラベル */
  label?: string;
  /** ロック画面に出すタイトル */
  mediaTitle?: string;
};

export function NewsAudioButton({
  scope,
  variant = "icon",
  label = "音声で聞く",
  mediaTitle,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false); // 音声URLを取得済みか
  const [error, setError] = useState<string | null>(null);

  // ロック画面・通知領域の表示（対応ブラウザのみ）
  useEffect(() => {
    if (!ready || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle ?? "ニュース",
      artist: "SERA",
      album: "AI秘書",
    });
  }, [ready, mediaTitle]);

  async function handleClick() {
    const audio = audioRef.current;
    if (!audio) return;

    // 取得済みなら再生/一時停止を切り替えるだけ
    if (ready) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }

    setError(null);
    setLoading(true);

    // 操作の中でいったん無音を再生し、iOSのロックを解除しておく
    try {
      audio.src = SILENT_WAV;
      await audio.play();
      audio.pause();
    } catch {
      // 解除に失敗しても続行（生成後に手動で再生できる）
    }

    const result = await speakNews(scope);
    setLoading(false);

    if (!result.ok || !result.url) {
      setError(result.error ?? "音声を作成できませんでした");
      return;
    }

    audio.src = result.url;
    setReady(true);
    try {
      await audio.play();
    } catch {
      // 自動再生が拒否された場合は、もう一度押せば再生できる
    }
  }

  const icon = loading ? (
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
  ) : playing ? (
    <Pause className="h-4 w-4" aria-hidden="true" />
  ) : (
    <Volume2 className="h-4 w-4" aria-hidden="true" />
  );

  return (
    <>
      {variant === "button" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleClick} disabled={loading} className="btn-ghost">
            {icon}
            {loading ? "音声を作成中…" : playing ? "一時停止" : label}
          </button>
          {error && <span className="text-xs font-bold text-red-600">{error}</span>}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          aria-label={playing ? "一時停止" : "この記事を音声で聞く"}
          title={error ?? (playing ? "一時停止" : "この記事を音声で聞く")}
          className={`-m-1 cursor-pointer p-1 transition-colors duration-150 disabled:cursor-default ${
            error ? "text-red-600" : playing ? "text-accent" : "text-faint hover:text-accent"
          }`}
        >
          {icon}
        </button>
      )}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}

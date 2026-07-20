"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * ブリーフィングの読み上げ再生プレーヤー
 *
 * 音声ファイル（WAV）を <audio> で再生するので、画面を消しても再生が続き、
 * ロック画面やイヤホンのボタンからも操作できる（通勤中に聞く用途）。
 * Media Session APIでロック画面にタイトルを出す。
 */
export function BriefingAudio({ src, dateLabel }: { src: string; dateLabel: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // ロック画面・通知領域に表示される情報を設定する
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `今日のブリーフィング（${dateLabel}）`,
      artist: "SERA",
      album: "AI秘書",
    });
  }, [dateLabel]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // 再生はユーザー操作の中で呼ぶ必要がある（モバイルの自動再生制限）
      void audio.play();
    } else {
      audio.pause();
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-bg px-3.5 py-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "一時停止" : "読み上げを再生"}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-line bg-card text-ink transition-transform duration-150 active:scale-95"
      >
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-ink">音声で聞く</p>
        <p className="text-xs text-muted">画面を消しても再生が続きます</p>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  MEMO_LONG_PRESS_MS,
  MEMO_SWIPE_ACTION_WIDTH,
  MEMO_SWIPE_COMMIT_EXTRA_PX,
  MEMO_SWIPE_START_PX,
} from "@/lib/config";

/**
 * スワイプで操作できるリスト行（iPhoneのリスト操作を再現）
 *
 * - 左へスワイプ … 行の右側にボタンが顔を出す（`trailing`）。押して実行、または引っ張り切ると最後のボタンを実行
 * - 右へスワイプ … 引っ張り切るとその場で実行して戻る（`leading`。iPhoneメモ帳のピン留めと同じ）
 * - 長押し / 右クリック … `onLongPress`（コンテキストメニューを出す用）
 *
 * 縦スクロールを奪わないため、最初の指の動きが縦か横かを見てから横スワイプに入る。
 * 開いている状態で中身を押したときは、操作の実行ではなく「閉じる」を優先する（誤爆防止）。
 */

export type SwipeAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** 地色。danger=取り消せない操作 / pin=ピン留め / calm=元に戻す・複製 */
  tone: "danger" | "pin" | "calm";
  run: () => void;
};

const TONE_CLASS: Record<SwipeAction["tone"], string> = {
  danger: "swipe-danger",
  pin: "swipe-pin",
  calm: "swipe-calm",
};

/** 指の動きをまだ判定していない / 横スワイプ中 / 縦スクロールに譲った */
type Gesture = "undecided" | "swiping" | "scrolling";

export function SwipeRow({
  children,
  trailing = [],
  leading,
  open,
  onOpenChange,
  onLongPress,
  allowFullSwipeCommit = true,
}: {
  children: React.ReactNode;
  trailing?: SwipeAction[];
  leading?: SwipeAction;
  /** 右側のボタンを出しているか（親が管理し、他の行を閉じるのに使う） */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLongPress?: () => void;
  /**
   * 左へ引っ張り切ったときに最後のボタンを自動実行するか。
   * 取り消せない操作（完全削除）ではfalseにし、必ずボタンを押させる。
   */
  allowFullSwipeCommit?: boolean;
}) {
  const trailingWidth = trailing.length * MEMO_SWIPE_ACTION_WIDTH;

  /** 指でドラッグ中の位置。null のときは open に従う */
  const [drag, setDrag] = useState<number | null>(null);
  /*
   * 同じ位置をrefにも持つ。
   * Reactの状態更新は次の描画までまとめられるため、pointermoveとpointerupが
   * 同じ処理の中で連続して届くと、指を離した判定が古い位置で行われてしまう
   * （ブラウザがイベントをまとめて渡してくることがある）。判定は必ずこのrefを見る。
   */
  const dragRef = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef<Gesture>("undecided");
  /** いま押している指／マウスのID。押していない間は null（＝動かしても反応しない） */
  const activePointerRef = useRef<number | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 直前のスワイプで操作を実行したか（実行直後のクリックを飲み込むため） */
  const justActedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  const offset = drag !== null ? drag : open ? -trailingWidth : 0;

  /** ドラッグ位置を更新する（状態とrefを必ず一緒に動かす） */
  function setDragOffset(next: number | null) {
    dragRef.current = next;
    setDrag(next);
  }

  /** 操作をやめて元に戻す（押していない状態へ） */
  function resetGesture() {
    activePointerRef.current = null;
    gestureRef.current = "undecided";
    cancelLongPress();
    setDragOffset(null);
  }

  function cancelLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    // マウスの右クリックや複数指は扱わない
    if (e.pointerType === "mouse" && e.button !== 0) return;

    activePointerRef.current = e.pointerId;
    startRef.current = { x: e.clientX, y: e.clientY };
    gestureRef.current = "undecided";
    justActedRef.current = false;

    if (onLongPress) {
      cancelLongPress();
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null;
        // 長押しが成立したらスワイプ扱いにはしない
        gestureRef.current = "scrolling";
        setDragOffset(null);
        onLongPress();
      }, MEMO_LONG_PRESS_MS);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    /*
     * ガード節：押していないときの動きは無視する。
     * pointermove は「指で触れている間」だけでなく **マウスがただ通り過ぎたときにも発火する**。
     * これを見ていないと、PCでカーソルを重ねただけで行が横に滑ってしまう（実際に起きた）。
     * - 押していない（activePointer が無い）
     * - 押し始めたポインタと別のポインタ
     * - マウスでボタンが離れている（枠の外で離した場合の取りこぼし対策）
     */
    if (activePointerRef.current === null || e.pointerId !== activePointerRef.current) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      resetGesture();
      return;
    }
    if (gestureRef.current === "scrolling") return;

    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (gestureRef.current === "undecided") {
      // 縦に動いたらブラウザのスクロールに譲る（ここを誤ると一覧がスクロールできなくなる）
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > MEMO_SWIPE_START_PX) {
        gestureRef.current = "scrolling";
        cancelLongPress();
        return;
      }
      if (Math.abs(dx) < MEMO_SWIPE_START_PX) return;
      gestureRef.current = "swiping";
      cancelLongPress();
      // 指が行の外へ出ても追い続ける。既に離れているポインタでは失敗するので握りつぶす
      try {
        rowRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        // 捕まえられなくてもスワイプ自体は続けられる
      }
    }

    const base = open ? -trailingWidth : 0;
    let next = base + dx;
    // 行けない方向へは引っ張らせない（ボタンが無い側は動かさない）
    const min = trailing.length > 0 ? -(trailingWidth + MEMO_SWIPE_ACTION_WIDTH) : 0;
    const max = leading ? MEMO_SWIPE_ACTION_WIDTH * 2 : 0;
    next = Math.max(min, Math.min(max, next));
    setDragOffset(next);
  }

  function handlePointerUp() {
    cancelLongPress();
    // 指／マウスを離したので、次に動かしても反応しないよう押下状態を解除する
    activePointerRef.current = null;

    if (gestureRef.current !== "swiping") {
      gestureRef.current = "undecided";
      return;
    }
    gestureRef.current = "undecided";

    const current = dragRef.current ?? 0;
    // ボタンを出し切った位置から、さらに一定距離ぶん引っ張ったら実行とみなす。
    // 画面幅の割合で決めないのは、幅が 0 と報告される場面でしきい値が 0 になり、
    // ほんの少し滑らせただけで削除が走ってしまうため（実際に踏んだ）。
    const commitDistance = trailingWidth + MEMO_SWIPE_COMMIT_EXTRA_PX;

    // 右へ引っ張り切った → leading をその場で実行して閉じる
    if (leading && current >= MEMO_SWIPE_ACTION_WIDTH) {
      justActedRef.current = true;
      setDragOffset(null);
      onOpenChange(false);
      leading.run();
      return;
    }
    // 左へ引っ張り切った → 一番強い操作（最後のボタン）を実行
    if (allowFullSwipeCommit && trailing.length > 0 && -current >= commitDistance) {
      justActedRef.current = true;
      setDragOffset(null);
      onOpenChange(false);
      trailing[trailing.length - 1].run();
      return;
    }
    // 半端な位置は、ボタン1つぶん出ていれば開く・出ていなければ閉じる
    setDragOffset(null);
    if (trailing.length > 0) onOpenChange(-current >= MEMO_SWIPE_ACTION_WIDTH / 2);
  }

  /** 開いている間は中身のタップを「閉じる」に使う（リンク遷移させない） */
  function handleContentClickCapture(e: React.MouseEvent) {
    if (justActedRef.current) {
      justActedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (open || drag !== null) {
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
      setDragOffset(null);
    }
  }

  return (
    <div
      ref={rowRef}
      className="swipe-row"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => {
        if (!onLongPress) return;
        e.preventDefault();
        onLongPress();
      }}
    >
      {/* 右スワイプで顔を出す操作（引っ張り切ると実行） */}
      {leading && (
        <div
          className={`absolute inset-y-0 left-0 ${TONE_CLASS[leading.tone]} swipe-action`}
          style={{ width: MEMO_SWIPE_ACTION_WIDTH }}
          aria-hidden="true"
        >
          {leading.icon}
          {leading.label}
        </div>
      )}

      {/* 左スワイプで顔を出す操作（押して実行） */}
      {trailing.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: trailingWidth }}>
          {trailing.map((action) => (
            <button
              key={action.key}
              type="button"
              // 開いていないときは押せないようにする（見えていない操作を踏ませない）
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              className={`${TONE_CLASS[action.tone]} swipe-action cursor-pointer`}
              style={{ width: MEMO_SWIPE_ACTION_WIDTH }}
              onClick={() => {
                onOpenChange(false);
                action.run();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="swipe-content"
        style={{
          transform: `translateX(${offset}px)`,
          // ドラッグ中は指に追従させ、離したときだけ滑らかに戻す
          transition: drag !== null ? "none" : "transform 200ms ease-out",
        }}
        onClickCapture={handleContentClickCapture}
      >
        {children}
      </div>
    </div>
  );
}

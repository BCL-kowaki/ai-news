"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 長押し・右クリックで出るメニュー（iPhoneのコンテキストメニュー風）
 *
 * 画面のどこを押しても閉じる／Escでも閉じる。
 * 画面の端で切れないように、開いたあとに実寸を測って位置を内側へ寄せる。
 */

export type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** 取り消せない操作は赤字にして目立たせる */
  danger?: boolean;
  run: () => void;
};

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 画面外にはみ出す分だけ内側へ寄せる（スマホの端で開いたときに切れないように）
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPos({
      left: Math.min(Math.max(margin, x), window.innerWidth - width - margin),
      top: Math.min(Math.max(margin, y), window.innerHeight - height - margin),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // 押した瞬間に閉じる（長押しを離した直後の誤爆を避けるため click ではなく pointerdown）
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <>
      {/* 後ろを暗くして、メニューが出ていることをはっきりさせる */}
      <div className="fixed inset-0 z-40 bg-[rgba(56,44,40,0.18)]" aria-hidden="true" />
      <div
        ref={menuRef}
        role="menu"
        className="context-menu"
        style={{ left: pos.left, top: pos.top }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={item.danger ? "!text-[color:var(--swipe-danger)]" : undefined}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

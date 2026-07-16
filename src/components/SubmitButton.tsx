"use client";

import { useFormStatus } from "react-dom";

/**
 * フォーム送信ボタン（送信中は自動で無効化して二重送信を防ぐ）
 * <form action={...}> の中で使う。
 */
export function SubmitButton({
  children,
  pendingLabel = "送信中…",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base = variant === "primary" ? "btn-primary" : "btn-ghost";
  return (
    <button type="submit" disabled={pending} className={`${base} ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

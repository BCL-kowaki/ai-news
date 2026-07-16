"use client";

import { useRef } from "react";

/**
 * 送信成功後に入力欄を自動で空にするフォーム
 *
 * Server Action をそのまま <form action> に渡すと、送信後も入力値が残ってしまう。
 * このラッパーはアクション完了後に form.reset() を呼び、連続入力しやすくする。
 */
export function AutoResetForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        await action(formData);
        ref.current?.reset();
      }}
    >
      {children}
    </form>
  );
}

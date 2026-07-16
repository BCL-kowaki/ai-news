"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/** ログアウトボタン */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="btn-ghost"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      ログアウト
    </button>
  );
}

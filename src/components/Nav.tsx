"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  ListTodo,
  StickyNote,
  Mic,
  Settings,
} from "lucide-react";

/**
 * 共通ナビゲーション
 *
 * - スマホ: 画面下部の固定タブバー（iOSのタブバー風：すりガラス＋アイコン＋小ラベル）
 * - PC(md以上): 画面上部のヘッダー内に横並び
 * 現在地のタブはiOSブルーでハイライトする。
 */

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: LayoutDashboard },
  { href: "/news", label: "ニュース", icon: Newspaper },
  { href: "/tasks", label: "タスク", icon: ListTodo },
  { href: "/memos", label: "メモ", icon: StickyNote },
  { href: "/meetings", label: "会議", icon: Mic },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

/** 現在地の判定（/news/xxx でも「ニュース」を光らせる） */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** スマホ用: 下部固定タブバー（iOS風） */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-150 active:opacity-60 ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** PC用: ヘッダー内の横並びナビ */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインナビゲーション" className="hidden md:block">
      <ul className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 active:opacity-60 ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

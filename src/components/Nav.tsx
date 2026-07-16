"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  ListTodo,
  StickyNote,
  Settings,
} from "lucide-react";

/**
 * 共通ナビゲーション
 *
 * - スマホ: 画面下部の固定タブバー（親指で届く位置。セーフエリア対応）
 * - PC(md以上): 画面上部のヘッダー内に横並び
 * 現在地のタブはアクセント色でハイライトする。
 */

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: LayoutDashboard },
  { href: "/news", label: "ニュース", icon: Newspaper },
  { href: "/tasks", label: "タスク", icon: ListTodo },
  { href: "/memos", label: "メモ", icon: StickyNote },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

/** 現在地の判定（/news/xxx でも「ニュース」を光らせる） */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** スマホ用: 下部固定タブバー */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-200 ${
                  active ? "text-accent" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
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
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-bg hover:text-ink"
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

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { authOptions } from "@/lib/nextauth";
import { DesktopNav, MobileTabBar } from "@/components/Nav";

/**
 * ログイン後の全画面共通レイアウト
 *
 * - サーバー側でもセッションを確認する（ミドルウェアとの二重防御）
 * - PC: 上部ヘッダー（ロゴ＋ナビ） / スマホ: 下部タブバー
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // ガード節：ミドルウェアをすり抜けた場合の保険（多層防御）
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight">AI秘書</span>
          </Link>
          <DesktopNav />
        </div>
      </header>

      {/* スマホは下部タブバーに隠れないよう余白を確保 */}
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-6 md:pb-12">{children}</div>

      <MobileTabBar />
    </div>
  );
}

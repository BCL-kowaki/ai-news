import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/nextauth";
import { DesktopNav, MobileTabBar, SettingsLink } from "@/components/Nav";

/**
 * ログイン後の全画面共通レイアウト
 *
 * - サーバー側でもセッションを確認する（ミドルウェアとの二重防御）
 * - PC: 上部ヘッダー（すりガラス） / スマホ: 下部タブバー（iOS風）
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // ガード節：ミドルウェアをすり抜けた場合の保険（多層防御）
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="glass-bar sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center active:opacity-60">
            {/* SERAワードマーク（白地ロゴ）。mix-blend-multiplyで白を透過させ、すりガラスに馴染ませる */}
            <Image
              src="/logo-wordmark.png"
              alt="SERA — AI Secretary Agent"
              width={880}
              height={330}
              priority
              className="h-7 w-auto mix-blend-multiply"
            />
          </Link>
          <div className="flex items-center gap-2">
            <DesktopNav />
            {/* 設定は右上の歯車（スマホ・PC共通） */}
            <SettingsLink />
          </div>
        </div>
      </header>

      {/* スマホは下部タブバーに隠れないよう余白を確保 */}
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-5 md:pb-12">{children}</div>

      <MobileTabBar />
    </div>
  );
}

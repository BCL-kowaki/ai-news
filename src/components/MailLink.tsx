"use client";

/**
 * メールを開くリンク
 *
 * - iPhone/iPad: Gmailアプリを直接起動（googlegmail://）。アプリが無ければブラウザのGmailへ
 * - Android: mail.google.com を開くとOSがGmailアプリに引き継ぐ（App Links）
 * - PC: 新しいタブでGmail（Web）を開く
 */
export function MailLink({
  webUrl,
  threadId,
  accountEmail,
  className,
  children,
}: {
  webUrl: string;
  threadId: string;
  accountEmail: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOS) return; // iOS以外は通常のリンク挙動（新規タブでGmail Web）

    e.preventDefault();
    // まずGmailアプリを起動してみる。開けなければ0.8秒後にWebへフォールバック
    const fallback = setTimeout(() => {
      window.open(webUrl, "_blank", "noopener");
    }, 800);
    // アプリが起動して画面が切り替わったらフォールバックを中止
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) clearTimeout(fallback);
      },
      { once: true },
    );
    window.location.href = `googlegmail:///cv=${threadId}/accountId=${encodeURIComponent(accountEmail)}`;
  }

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}

import { FileText, File } from "lucide-react";

/**
 * メモの添付ファイル表示
 *
 * MIMEタイプに応じて出し分ける:
 * - 画像 … サムネイル表示（クリックで原寸を新規タブ表示）
 * - 動画 / 音声 … その場で再生できるプレーヤー
 * - PDF・その他 … ファイル名のリンク（新規タブ）
 * URLはPrivate Blobの署名付きURL（ページ表示時にサーバーで発行済み・1時間有効）。
 */

export type AttachmentView = {
  id: string;
  name: string;
  mime: string;
  signedUrl: string;
};

export function MemoAttachments({ items }: { items: AttachmentView[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-2">
      {/* 画像はグリッドでまとめる */}
      {items.some((a) => a.mime.startsWith("image/")) && (
        <div className="flex flex-wrap gap-2">
          {items
            .filter((a) => a.mime.startsWith("image/"))
            .map((a) => (
              <a key={a.id} href={a.signedUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- 署名付き外部URLのためnext/image非対応 */}
                <img
                  src={a.signedUrl}
                  alt={a.name}
                  loading="lazy"
                  className="max-h-36 rounded-lg border-2 border-line object-cover"
                />
              </a>
            ))}
        </div>
      )}

      {items
        .filter((a) => a.mime.startsWith("video/"))
        .map((a) => (
          <video key={a.id} controls preload="metadata" src={a.signedUrl} className="max-h-64 w-full rounded-lg border-2 border-line">
            <a href={a.signedUrl}>{a.name}</a>
          </video>
        ))}

      {items
        .filter((a) => a.mime.startsWith("audio/"))
        .map((a) => (
          <audio key={a.id} controls preload="metadata" src={a.signedUrl} className="w-full" />
        ))}

      {/* PDF・その他はリンクで */}
      <div className="flex flex-wrap gap-2">
        {items
          .filter(
            (a) =>
              !a.mime.startsWith("image/") &&
              !a.mime.startsWith("video/") &&
              !a.mime.startsWith("audio/"),
          )
          .map((a) => (
            <a
              key={a.id}
              href={a.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              {a.mime === "application/pdf" ? (
                <FileText className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              ) : (
                <File className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="max-w-48 truncate">{a.name}</span>
            </a>
          ))}
      </div>
    </div>
  );
}

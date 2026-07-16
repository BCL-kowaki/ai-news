# AI秘書（秘書エージェント） — CLAUDE.md

> 旧「AIニュース自動配信システム（Slack配信）」を2026-07-17に作り替えた。
> **現在の正確な仕様は docs/仕様書.md、現状と残タスクは docs/引き継ぎメモ.md を正とする。**

## プロジェクト概要

ニュース・予定・メール・タスク・メモを1画面に集約する**個人用の秘書エージェント**Webアプリ。

- 個人利用（ログインできるのは `ALLOWED_EMAIL` に載せた本人のみ）
- フェーズ1（完了）: ログイン必須化・ベントグリッドUI・タスク・メモ・ニュース内蔵（Slack配信は廃止）
- フェーズ2（未着手）: Google連携 — 会社用/個人用アカウントのカレンダー・Gmail表示（家族共用カレンダーは個人アカウントの共有経由）
- フェーズ3（未着手）: AI秘書 — 朝のブリーフィング自動生成・メール要約/重要度（Claude Haiku中心で低コスト）

## 技術スタック

- Next.js 14 (App Router) + TypeScript / Tailwind CSS（CSS変数トークン）
- Prisma + Neon PostgreSQL / Vercel（hnd1）
- NextAuth v4（Googleサインイン・JWT・許可リスト） / lucide-react
- 定期実行: GitHub Actions（Vercel Hobbyのcron制限のため。`.github/workflows/cron.yml`）
- AI: Claude Haiku（要約・ブリーフィング） / DeepL（翻訳）。どちらも未設定でも壊れないフェイルセーフ

## 必読ドキュメント（docs/）

| ファイル | 内容 |
|---|---|
| 仕様書.md | 全機能・画面・API・スキーマ・環境変数（実装と同期） |
| 引き継ぎメモ.md | 現状・残タスク・ハマりどころ。**まずこれを読む** |
| セットアップ手順.md | ユーザー作業（GCP OAuth・Vercel環境変数など） |
| 仕様メモ・TODO.md | フェーズ2〜3の実装予定 |
| 開発整理ドキュメント.md | ファイルリスク区分・開発ルール・検証コマンド |

## 設計ルール(最重要)

1. **認証のフェイルセーフを崩さない**: 環境変数未設定なら「動かない」側に倒す（ログイン・cronとも）
2. **Server Actionは先頭でセッション確認**（ミドルウェアがあっても省略しない。多層防御）
3. **定数・分類は `src/lib/config.ts`、デザイントークンは `globals.css` のCSS変数が単一定義元**
4. RSSソースの増減は `src/lib/sources.ts` の編集だけ（DB自動同期）
5. 高リスクファイル（middleware.ts / nextauth.ts / auth.ts / schema.prisma / Secrets）は**承認なしで変更しない**

## 環境変数（詳細は docs/仕様書.md）

```
DATABASE_URL / DIRECT_URL      # Neon（Pooled / Direct）
NEXTAUTH_SECRET / NEXTAUTH_URL # ログインセッション
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ALLOWED_EMAIL
CRON_SECRET                    # cron認証
DEEPL_API_KEY / ANTHROPIC_API_KEY  # 任意（翻訳・要約）
TOKEN_ENCRYPTION_KEY           # フェーズ2（Google連携トークン暗号化）
```

## リポジトリ構成の注意【重要】

gitルートはホームディレクトリ `/Users/takaya`（プロジェクト直下ではない）。
コミットは必ず `cd ~/work/myfolda/AIニュース` してから、このフォルダ配下だけを `git add` する。
`git add -A` をホーム基準で実行しない（個人設定・鍵を巻き込む危険）。

## 検証・デプロイ

```
npx tsc --noEmit && npx next build   # 完了報告前に必ず通す
cd ~/work/myfolda/AIニュース && git push  # デプロイ（Vercel自動）
```

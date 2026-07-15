# AIニュース自動配信システム(Slack) — CLAUDE.md

> **【配信先の変更】** 当初LINE想定だったが、着手時にSlackへ変更した。
> 理由: LINEの無料枠(月200通)制約が消え、セットアップも実装もシンプルになるため。
> 判断の詳細は docs/事業頭脳・戦略メモ.md、現在の正確な仕様は docs/仕様書.md を正とする。
> 以下このファイルにLINE前提の記述が残る箇所は docs/ を優先すること。

## プロジェクト概要

AI関連の最新ニュースを収集し、**Slackの指定チャンネル**へ自分専用に配信するシステム。

- 個人利用(配信先は自分のみ)
- X(Twitter)公式APIは使用しない(月$200のコストを回避するため)
- 情報収集は1時間毎に裏側で実行し、ストックする
- 配信は1日3回(8/13/19時)にまとめる。Slackは無料枠上限が無いため頻度は自由に変えられる
- 過去記事はSlackの検索・履歴で遡れるため、専用の一覧機能は作らない
- **要約は行わない**。記事タイトル+URLをそのまま配信する完全シンプル案を採用(Claude API呼び出しゼロ)

---

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **DB**: Neon PostgreSQL + Prisma
- **認証**: NextAuth.js(管理画面がある場合。今回は個人利用のため簡易でも可)
- **ホスティング**: Vercel
- **定期実行**: GitHub Actions（Vercel Hobbyのcronは1日1回制限のため。詳細は docs/仕様書.md）
- **メッセージング**: Slack Incoming Webhook

---

## アーキテクチャ

```
[Vercel Cron: 1時間毎]
      │
      ▼
[RSS収集ジョブ] ──► 複数ソースをパース ──► 新着記事のみ抽出
      │
      ▼
[Neon DB] articles テーブルに保存(重複排除、title + url のみ)
      │
      ▼
[articles.status = 'pending' として保持]

─────────────────────────────────────

[Vercel Cron: 1日3回(例: 8時/13時/19時)]
      │
      ▼
[配信ジョブ] pending記事を全件抽出
      │
      ▼
[タイトル + URLを箇条書きフォーマットに整形]
      │
      ▼
[Slack Incoming Webhook] まとめて投稿(多ければ複数メッセージに分割)
      │
      ▼
[articles.status = 'sent' に更新]

※ 過去記事はSlackのチャンネルに残るため、「今すぐ見る」的な仕組みは不要
```

---

## 設計ルール(最重要)

1. 配信は1日3回(8/13/19時)。Slackは送信数上限が無いため、頻度はcron設定で自由に変えられる
2. 1回の配信件数には上限を設ける(`MAX_ARTICLES_PER_BROADCAST`)。大量通知と古い記事の滞留を防ぐ
3. 1メッセージが長すぎないよう、件数が多いときは分割して複数メッセージで投稿する
4. Slackに載せる記事タイトルは必ずエスケープする(`< > &`)。メッセージ崩れ・インジェクション防止

---

## DBスキーマ(Prisma想定)

```prisma
model Source {
  id        String   @id @default(cuid())
  name      String
  url       String   // RSS URL
  category  String?  // "AI全般", "研究", "プロダクト" 等
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Article {
  id          String   @id @default(cuid())
  sourceId    String
  title       String
  url         String   @unique
  publishedAt DateTime
  status      String   @default("pending") // pending / sent / skipped
  fetchedAt   DateTime @default(now())
  sentAt      DateTime?
}

model SendLog {
  id        String   @id @default(cuid())
  sentAt    DateTime @default(now())
  count     Int      // その回で送った記事数
  monthKey  String   // "2026-07" 形式で月次カウント用
}
```

---

## 環境変数

```
DATABASE_URL=          # Neon Pooled 接続文字列
DIRECT_URL=            # Neon Direct 接続文字列(マイグレーション用)
SLACK_WEBHOOK_URL=     # Slack Incoming Webhook URL
CRON_SECRET=           # Cronエンドポイントの認証用
```

---

## 実装タスク(優先順)

1. Next.jsプロジェクト初期化 + Prisma + Neon接続
2. `Source` テーブルにRSSソースを登録(TechCrunch AI, Ars Technica AI, ITmedia AI+, VentureBeat AI, Hacker News API等)
3. `/api/cron/fetch` — 1時間毎に呼ばれるRSS収集エンドポイント
   - 各SourceのRSSをパース → 新規URLのみ `Article`(title + url)にinsert
4. `/api/cron/broadcast` — 1日3回、pending記事をまとめてSlackへ投稿
   - タイトル+URLをリンク付き箇条書きに整形し、多ければ分割して投稿(下記フォーマット参照)
   - 1回の上限件数を超えた古い記事は skipped にして滞留を防ぐ
5. GitHub Actions設定(`.github/workflows/cron.yml`)
6. (任意)Slackスラッシュコマンドでキーワード検索

> ※ 実装は完了済み。現在の正確な仕様は docs/仕様書.md を参照。

### 配信メッセージフォーマット例(Slack mrkdwn)

```
📰 AIニュース(8:00更新・3件)

1. <https://example.com/article1|OpenAIが新モデルを発表>
2. <https://example.com/article2|Anthropicが安全性レポートを公開>
```

---

## 定期実行(GitHub Actions)

Vercel Hobbyのcronは「1日1回」制限のため、GitHub Actionsから叩く。
設定は `.github/workflows/cron.yml`。Vercel Proに上げる場合の `vercel.json` 例:

```json
{
  "crons": [
    { "path": "/api/cron/fetch", "schedule": "0 * * * *" },
    { "path": "/api/cron/broadcast", "schedule": "0 23,4,10 * * *" }
  ]
}
```
(VercelのcronはUTC。23/4/10時UTC = JST 8/13/19時)

---

## RSSソース候補(X APIを使わない代替)

| ソース | URL例 | 備考 |
|---|---|---|
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 一次情報多め |
| Ars Technica | https://feeds.arstechnica.com/arstechnica/technology-lab | AI含む |
| ITmedia AI+ | https://rss.itmedia.co.jp/rss/2.0/aiplus.xml | 日本語ソース |
| VentureBeat AI | https://venturebeat.com/category/ai/feed/ | - |
| Hacker News API | https://hn.algolia.com/api | "AI"等でクエリ検索可 |
| OpenAI Blog | https://openai.com/news/rss.xml | 一次情報源(X投稿の元ネタ) |
| Anthropic News | https://www.anthropic.com/news | 要RSS確認 |
| Google News RSS | https://news.google.com/rss/search?q=AI | キーワードカスタム可 |

---

## コーディング規約

- Karpathy 12-rule フレームワークに準拠(小さく作って動かしながら育てる)
- 出力は日本語コメント・日本語ログメッセージを基本とする
- 各cronエンドポイントは `CRON_SECRET` によるBearer認証を必須にする
- 各cronエンドポイントは認証(CRON_SECRET)が未設定なら動かないフェイルセーフにする
- Slackに載せる外部由来テキスト(記事タイトル)は必ずエスケープしてから送る

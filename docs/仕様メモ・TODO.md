# 仕様メモ・TODO（今後実装予定）

> 最終更新: 2026-07-17

## 次にやること（優先順）

1. **ユーザー作業: GCPのOAuthクライアント作成 → 本番ログイン確認**（docs/セットアップ手順.md 手順3〜5）
2. **フェーズ2: Google連携**
   - 自前OAuthコネクタ（/api/google/connect → callback。access_type=offline & prompt=consent）
   - refresh_tokenをAES-256-GCM暗号化してGoogleAccountへ保存（鍵: TOKEN_ENCRYPTION_KEY）
   - スコープ: `calendar.readonly` + `gmail.readonly`（GCP同意画面にスコープ追加が必要）
   - カレンダー統合表示: 複数アカウント + calendarList からの表示カレンダー選択（家族共用はここで拾う）
   - Gmail: アカウント別の最新・未読一覧（本文はDB非保存・短期キャッシュ）
   - 失効時の「再連携」導線（テストモードは7日で失効するため必須）
3. **フェーズ3: AI秘書**
   - `/api/cron/briefing`（朝7時JST = UTC 22時、GitHub Actionsにジョブ追加）
   - 予定+重要メール+タスク+ニュース → Claude Haikuで日本語ブリーフィング生成 → Briefingへ
   - メールのAI要約・重要度抽出（オンデマンド）
   - メール→タスク化ボタン

## 改善アイデア（優先度低）

- よく使うメモの並び替えUI（sortOrderは実装済み・UI未実装）
- タスクの編集（今は追加・完了・削除のみ）
- ニュースの重複間引き（別ソースの同一ニュースをタイトル類似で除外）
- キーワードミュート
- ダークモード（CSS変数化済みなので変数の切り替えだけで対応可能）
- Next.js 15へのメジャーアップデート（npm auditの残警告解消）

## 判断待ち・要確認事項

- 【要確認】会社のGoogle Workspaceが外部アプリ（テストモードのOAuth）接続を許可しているか。フェーズ2の接続時に判明する
- 【要確認】家族共用カレンダーが個人アカウントに共有されているか（されていれば追加OAuth不要）
- 【要確認】gitルートがホームディレクトリになっている件。プロジェクト単独リポジトリへの切り出し

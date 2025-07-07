# TODOリスト

このドキュメントは、`misskey-antennatl` を `npm run dev` で正常に動作させるために必要な、残りのタスクを管理します。

## 必須タスク (for dev)

- [x] **`.env.local` ファイルの作成と設定**
  - `misskey-antennatl` のルートディレクトリに `.env.local` ファイルを作成する必要があります。
  - `.env.local.sample` をコピーし、以下の3つの環境変数を自分のMisskey環境に合わせて設定してください。
    - `MISSKEY_HOST`: あなたのMisskeyインスタンスのURL (例: `https://misskey.io`)
    - `MISSKEY_TOKEN`: `read:antennas` と `read:notes` の権限を持つAPIトークン
    - `ANTENNA_ID`: 監視対象のアンテナID

- [ ] **Misskey APIレスポンスの完全なパース処理**
  - 現在、`lib/misskey.ts` の `fetchConversation` 関数は、会話スレッドを正しく `ancestors` と `descendants` に分類していません。（簡易的なプレースホルダー実装になっています）
  - Misskeyの `/api/notes/conversation` から返されるフラットなノート配列を、リプライ関係に基づいて正しくソートし、スレッド構造に再構築するロジックを実装する必要があります。

- [ ] **UIの微調整と動作確認**
  - 実際にAPIから取得したデータでUIが崩れないか、インタラクション（スレッドの開閉など）が意図通りに動作するかを確認し、必要に応じてスタイルを調整します。
  - 特に、添付メディアの表示やCW（Contents Warning）の扱いは未実装です。

## 今後の改善タスク (post-MVP)

- [ ] 認証機能 (OAuth2)
- [ ] PWA対応とPush通知
- [ ] LocalStorageによる既読管理
- [ ] 検索・フィルタリング機能
- [ ] i18n (国際化対応)

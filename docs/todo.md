# TODOリスト

このドキュメントは、`misskey-antennatl` を `npm run dev` で正常に動作させるために必要な、残りのタスクを管理します。

## 必須タスク (for dev)

- [x] **`.env.local` ファイルの作成と設定**
  - `misskey-antennatl` のルートディレクトリに `.env.local` ファイルを作成する必要があります。
  - `.env.local.sample` をコピーし、以下の3つの環境変数を自分のMisskey環境に合わせて設定してください。
    - `MISSKEY_HOST`: あなたのMisskeyインスタンスのURL (例: `https://misskey.io`)
    - `MISSKEY_TOKEN`: `read:antennas` と `read:notes` の権限を持つAPIトークン
    - `ANTENNA_ID`: 監視対象のアンテナID

- [x] **`lib/misskey.ts` に `misskeyFetch` ヘルパーと `getTimelineAround` 関数を実装**
  - Misskey APIへのリクエストを共通化し、トークンを自動注入する `misskeyFetch` を作成。
  - 指定されたノートIDを中心に、その前後のタイムラインを取得する `getTimelineAround` を実装。

- [x] **新 Edge Route `/api/contextTL` の実装**
  - クエリパラメータ `noteId` (必須) と `scope` (global/local) を受け取り、`getTimelineAround` を呼び出して結果を返すAPIルートを実装。
  - エラーハンドリング（400, 500, 429）を実装。

- [x] **`src/app/page.tsx` を `/api/contextTL` を利用するように修正**
  - `useSWR` のエンドポイントを `/api/contextTL` に変更し、`noteId` と `scope` を渡すように修正。
  - データ型を `MisskeyNote[]` に変更し、取得したノートを `NoteCard` で表示するように変更。

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
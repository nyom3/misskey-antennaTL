# なぜ動くのか？ (Why-it-Works) — misskey-antennaTL

> **目的**  
> *misskey-antennaTL* の動作原理を“一気通貫”で把握する。  
> 概要を **TL;DR → Mermaid 全体図** で速読し、以下に **詳細解説** と **Deep-Dive 技術メモ** を続けます。  
> v1/v2/v3 で触れた技術キーワードは **すべて残し**、重複は統合しました。

---

## ✨ TL;DR

| 質問 | 5 秒で答え |
|------|-----------|
| **どこからデータが来る？** | Misskey API (antennas/notes + notes/conversation) |
| **誰が呼ぶ？** | Edge Runtime の API Route (`/api/mentionContext`, `/api/contextTL`) |
| **型安全は？** | Zod で外部レスポンスをランタイム検証 |
| **UI 更新は？** | React + SWR が 30 秒ごと自動再検証 |
| **キャッシュ戦略は？** | Vercel CDN 60 秒 + LRUCache(emoji) |
| **ハイドレーション対策？** | `isEmojiCacheReady` が整うまで描画を遅延 |

---

## 🗺️ 全体アーキテクチャ図

```mermaid
graph TD
  A["ブラウザ (React/SWR)"] -->|GET /api/mentionContext| B["Edge API (route.ts)"]
  B -->|POST /api/antennas/notes など| C["Misskey API"]
  B -->|Zod型検証 & JSON| A
  B -.->|"CDNキャッシュ (60s)"| A
````

* **SWR** がクライアント側キャッシュと再検証を制御。
* **Edge (Node ではなく Edge Runtime)** が Misskey に代理アクセスし、Zod で検証 → CDN と連携。
* 絵文字画像は **LRUCache** に保管し、頻出絵文字を切らさない。

---

## 1. コンポーネント別の役割

| 層           | ファイル例                                                                     | 主な仕事                         | 技術                            |
| ----------- | ------------------------------------------------------------------------- | ---------------------------- | ----------------------------- |
| **フロント**    | `src/app/page.tsx`<br>`src/components/NoteCard.tsx`                       | SWR でデータ取得→UI描画              | React (App Router) / Tailwind |
| **API ルート** | `src/app/api/mentionContext/route.ts`<br>`src/app/api/contextTL/route.ts` | Misskey API へ POST → 結果整形・検証 | Next.js Edge Runtime / Zod    |
| **ライブラリ**   | `src/lib/misskey.ts`                                                      | `misskeyFetch` 共通クライアント      | fetch / 環境変数                  |
| **ユーティリティ** | `src/lib/emoji.ts`                                                        | 絵文字キャッシュ & 置換                | LRUCache / DOMPurify          |
| **外部**      | Misskey インスタンス                                                            | データソース                       | Misskey API                   |

---

## 2. データフロー詳細

### 2-1. アンテナ TL 取得

1. HomePage マウント → `useSWR('/api/mentionContext')`
2. Edge ルート

   1. `antennas/notes` 取得
   2. 各ノートに対し `notes/conversation` を **p-map** 並列 (同時 5 本)
3. 取得結果を `ThreadSchema[]` で **Zod.parse**
4. JSON + `Cache-Control: s-maxage=60, stale-while-revalidate` で返送
5. SWR はローカルキャッシュ → UI 再描画

### 2-2. コンテキスト TL

*Note 選択時のみ*

1. `useSWR('/api/contextTL?noteId=...')`
2. ルートが `notes/show` + `notes/timeline` (前後 2 本) を並列取得
3. 失敗時は 500 → fetcher が throw → SWR `error` → `toast.error`

---

## 3. なぜその技術？（選択理由の比較表）

| 技術                     | 候補 vs 採用       | 採用理由                                              |
| ---------------------- | -------------- | ------------------------------------------------- |
| **Next.js App Router** | Pages Router   | Nested Layout / Server Component / Edge API を一貫管理 |
| **Edge Runtime**       | Node Functions | 地理的に近い＋CDNキャッシュがシームレス                             |
| **SWR**                | React Query    | 軽量・宣言的・再検証ロジックが 1 行                               |
| **Zod**                | io-ts / yup    | 型と実行時バリデーションを 1 ソース管理                             |
| **LRUCache**           | Map + TTL      | 頻出絵文字を自動で残しつつ上限制御                                 |

---

## 4. Deep-Dive ① 型安全 & エラー伝搬

```plaintext
Misskeyレスポンス
   ↓ Zod.parse()
      ├─ OK → JSON 200
      └─ NG → ZodError
               ↓ catch → JSON 500
                     ↓ fetcher → throw Error
                            ↓ SWR error → toast.error
```

* ポイントは「**壊れたデータが UI に届く前に 2 回弾く**」。
* 例外は詳細メッセージ付きでログ（Edge）とユーザ通知（toast）の両方へ。

---

## 5. Deep-Dive ② キャッシュ戦略

| レイヤ                  | TTL                      | 目的              |
| -------------------- | ------------------------ | --------------- |
| **Vercel CDN**       | 60 s (`s-maxage`)        | Misskey 呼び出しを抑制 |
| **SWR ローカル**         | 30 s (`refreshInterval`) | ブラウザ間通信を 0 に    |
| **LRUCache (emoji)** | Max 2000 エントリ            | 頻出絵文字を即表示       |

* メモリ→CDN→Misskey の優先順。
* 絵文字は 977 個 → LRU `max:2000` で全保持しつつ余裕枠。

---

## 6. Deep-Dive ③ 絵文字 & ハイドレーション

1. ページ初回ロード

   * SSR：ショートコード `:penguin:` のまま
2. クライアント `useEffect`

   * `fetchAndCacheEmojis` → LRUCache にロード
   * `setIsEmojiCacheReady(true)`
3. `isLoading = ... || !isEmojiCacheReady` が false になるタイミングで `NoteCard` 描画
4. `dangerouslySetInnerHTML` で `<img src=".../penguin.png">` に置換

> **ハイドレーションエラー解消**：SSR と CSR の DOM 差分が無い状態で初回描画。

---

## 7. よくある質問 (FAQ)

| Q                              | A                                        |
| ------------------------------ | ---------------------------------------- |
| Edge Runtime で Node API は？     | Buffer/crypto 以外は不可。fetch ベースなら問題なし。     |
| `dangerouslySetInnerHTML` は安全？ | DOMPurify 済み & Misskey 由来だけを許容。          |
| ポーリング 30 s は多くない？              | CDN キャッシュ込みで Misskey 直撃は最小。必要なら環境変数で調整可。 |

---

## 8. 開発 Tips / Quick Links

* **主要APIルート**: [`src/app/api/mentionContext/route.ts`](../src/app/api/mentionContext/route.ts)
* **SWR共通フェッチャ**: [`src/lib/fetcher.ts`](../src/lib/fetcher.ts)
* **Zod スキーマ**: [`src/lib/misskey.ts`](../src/lib/misskey.ts)
* **絵文字ユーティリティ**: [`src/lib/emoji.ts`](../src/lib/emoji.ts)
* **Tailwind プレイグラウンド**: `npm run dev` → `http://localhost:3000/play`

---

## 9. まとめ

> **ブラウザ**が「30 秒ごと」に状況を尋ね
> **Edge**が「外部 API＋型検証＋キャッシュ」で仲介し
> **Misskey**が「生データ」を返す。
> その 3 者が **壊れたときの逃げ道**を全部持っているから、
> ユーザは *Misskey をそのまま見ているように感じられる*──
> これが **「なぜ動くのか？」の真の答え** です。


# なぜ動くのか？ (Why-it-Works) — misskey-antennaTL

## 1. 俯瞰図：3 層＋CDN キャッシュ

```
┌──────────────────────────── ブラウザ (React/SWR) ───────────────────────────┐
│ 1. useSWR ➜ GET /api/mentionContext                                         │
│ 2. useSWR ➜ (optional) GET /api/contextTL?noteId=…                          │
└──────────────────────▲─────────────────────────────────────────────────────┘
                       │  JSON (threads[]) / (timeline[])
                       │ 60s キャッシュ (s‑maxage)
┌──────────────────────┴─────────────────────────────────────────────────────┐
│          Vercel Edge API Route (route.ts 2 本)                              │
│  a) validate with Zod ➜ misskeyFetch()                                      │
│  b) add `Cache‑Control: s‑maxage=60`                                        │
└──────────────────────┬─────────────────────────────────────────────────────┘
                       │  POST /api/antennas/notes など (Bearer + body.i)
┌──────────────────────┴─────────────────────────────────────────────────────┐
│                Misskey インスタンス API                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 🎯 要点（30 秒サマリ）

* **ブラウザ**: useSWR が 30 秒おきにエンドポイントを再検証。必要に応じて文脈 TL も取得。
* **Edge API**: Misskey に代理接続し、Zod で型検証。CDN に 60 秒キャッシュさせる。
* **Misskey**: `antennas/notes`, `notes/conversation`, `notes/timeline` の 3 系列を返す。
* **CDN**: 「30 秒ポーリング × 60 秒キャッシュ」で実質 2 ホップに 1 回しか Misskey を叩かない。

> 類推 ▶︎ **物流センター**に似ている。ブラウザは 30 秒ごとに在庫確認（useSWR）。Edge は倉庫で在庫を一括検品（Zod）。Misskey はメーカー倉庫。CDN は近所の小売店に置かれた「デポ」。

---

## 2. データフロー：コード位置付き詳細

| ステップ | 処理                                 | 主なコード                                         | 補足                                                             |
| ---- | ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| ①    | *ブラウザ* ➜ `/api/mentionContext` GET | `src/app/page.tsx` (useSWR)                   | `refreshInterval: 30_000`、失敗で `toast.error()`                  |
| ②    | Edge route.ts でアンテナ一覧取得            | `fetchAntennaNotes()` in `lib/misskey.ts`     | `antennas/notes` POST。`ThreadSchema` にまだ乗せない raw 配列            |
| ③    | 各ノートの会話を並列取得                       | `p-map` + `fetchConversation()`               | 同時 5 件 (`concurrency:5`) で `notes/conversation` & `notes/show` |
| ④    | Thread 構造を組み立て & 検証                | `ThreadSchema.array().parse(threads)`         | ここで **ZodError → 500** フローへ分岐可                                 |
| ⑤    | Edge が CDN ヘッダ付与し JSON 返却          | `NextResponse.json()`                         | `s‑maxage=60, stale‑while‑revalidate`                          |
| ⑥    | ブラウザ useSWR がキャッシュ更新               | `data: antennaData`                           | `isLoadingAntenna` false → UI再描画                               |
| ⑦    | クリックで `selectedNoteId` セット         | `setSelectedNoteId(id)`                       | トリガで 2 つ目の SWR (contextTL) キー生成                                |
| ⑧    | Edge `/api/contextTL` route.ts     | `getTimelineAround()`                         | sinceId/untilId で前後 10 件ずつ                                     |
| ⑨    | 絵文字キャッシュ確立後描画                      | `parseNoteText()` + `dangerouslySetInnerHTML` | `isEmojiCacheReady` が true になるまでローディング継続                       |

### ストーリーで読む

1. **一覧**を見て → 2. **ノートをクリック** → 3. 前後タイムラインと会話を即時取得 → 4. 絵文字が揃った時点で初めて本文をレンダリング。UX 的には「一瞬で全文脈が出る」ように感じる。

---

## 3. 技術選択と解決した課題

| 技術                     | 何を解決？                                                 | 類推イメージ                                   |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------- |
| **Next.js App Router** | ページ階層 × データフェッチを UI ツリーに共置。SSR/CSR の境界を柔軟に。           | スケルトン住宅：間取り（layout）と部屋（page）をファイル名で決めるだけ |
| **Edge Runtime**       | 地理的遅延カット & サーバレスオートスケール。Node API 制限の代わりに `fetch` 最適化。 | 駅ナカのコンビニ：近いので速い、品目は最小限                   |
| **SWR**                | キャッシュ＋再検証＋エラーUI を 1 行で。                               | ネットワークの定期巡回センサー                          |
| **Zod**                | 外部 API 崩壊の即検知。型の Single Source。                       | 空港ゲートの荷物 X 線検査                           |
| **LRUCache**           | カスタム絵文字 1000 件弱をメモリ上で効率保存。                            | 冷蔵庫の回転棚：賞味期限が近い順に前へ                      |
| **Tailwind**           | クラス 1 行で一貫 UI。                                        | LEGO ブロック感覚                              |

---

## 4. 型安全の壁：Zod 深掘り

```ts
const MisskeyNoteSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  text: z.string().nullable(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().url(),
  }),
});
```

* **静的**: `type MisskeyNote = z.infer<typeof MisskeyNoteSchema>` → VSCode 補完
* **実行時**: `.parse(raw)` → 失敗なら `ZodError`。Edge で 500 JSON に変換。

> 類推 ▶︎ 「履歴書チェック」：項目が欠けていたら採用面接まで進めない。

---

## 5. キャッシュ戦略

### 5‑1 CDN + Edge

* **HTTP ヘッダ** `Cache‑Control: s‑maxage=60, stale‑while‑revalidate`
* ユーザ数 N 人が 30 秒ごとに切り替えても、Misskey への直撃は 60 秒に 1 回。

### 5‑2 LRUCache for emoji

* `max: 2000` → Misskey.io の絵文字 (\~977) 全保持 OK。
* `.get(name)` の O(1) 参照。古いものは自動でパージ。

---

## 6. 絵文字処理フロー  *(v2 もともとの章)

```
fetchAndCacheEmojis()      // one‑shot POST /api/emojis
       ▼                  // LRUCache に保存
isEmojiCacheReady === false
       ▼ useEffect で true に
parseNoteText() replace :emoji: → <img>
       ▼
dangerouslySetInnerHTML()  // 安全な HTML のみ
```

* 安全性確保：Misskey から来る text に `<script>` は入らない。置換時も画像タグのみ挿入。
* ハイドレーション対応：キャッシュ未完了時はテキストのまま SSR → クライアントで true になってから再レンダリング。

### 6-A. 絵文字データの取得とキャッシュ  *(v1 4.1 全文を移植)*
- **`fetchAndCacheEmojis`**（`src/lib/emoji.ts`）  
  1. `POST /api/emojis` でカスタム絵文字リストを一括取得  
  2. 受け取った `{ name, url }` を **LRUCache** (`max: 2000`) に保存  
  3. 初回ロード時にのみ実行 (`useEffect` in `src/app/page.tsx`)  
- **トラブルシュート**: 977 個の絵文字を `max: 500` で運用すると LRU から溢れ、  
  一部が表示されない ⇒ `max: 2000` へ拡大して解決。

### 6-B. ノート本文中での絵文字置換  *(v1 4.2 全文を移植)*
- **`parseNoteText`**  
  1. 正規表現 `/:( [a-zA-Z0-9_\\-]+):/g` でショートコード検出  
  2. LRU に存在すれば `<img class="inline-block h-5 w-5" ...>` へ置換  
  3. 置換後の HTML 文字列を返す  
- `NoteCard.tsx` 側では  
```tsx
  <div
    className="prose"
    dangerouslySetInnerHTML={{ __html: parseNoteText(note.text) }}
  />
```

によって描画される。

---

## 7. エラー伝搬ケーススタディ  *(v2 章)*

```
Misskey returns avatarUrl: null
        ▼
ThreadSchema.parse() → ZodError("avatarUrl: Invalid url")
        ▼
Edge catch → HTTP 500 JSON { error, details }
        ▼
fetcher(): res.ok false → throw Error(details)
        ▼
useSWR error → toast.error("読込に失敗: avatarUrl invalid")
```

ユーザーは「読込に失敗」と正確な理由を即座に知るが、UI はクラッシュしない。

### 7-A. レンダリングとハイドレーション  *(v1 5. 全文を移植)*

* **問題**: SSR 時は絵文字キャッシュが空 → `:penguin:` がそのまま HTML に。
  CSR でキャッシュ完了後に `<img>` 差し替えが起きるため初期 DOM に不一致が生じる。
* **対策** (`src/app/page.tsx`)

  ```tsx
  const [isEmojiCacheReady, setIsEmojiCacheReady] = useState(false);
  const isLoading = isLoadingAntenna
                 || (selectedNoteId && isLoadingTimeline)
                 || (!!instanceHost && !isEmojiCacheReady);
  ```

  * 絵文字キャッシュが終わるまで `isLoading` を true にし、ページ描画を遅延
  * ハイドレーション差分がゼロになり、警告も解消

---

## 8. App Router vs Pages Router 早見表

| 観点     | Pages                | App                        | ひと言類推         |
| ------ | -------------------- | -------------------------- | ------------- |
| ルート判断  | `pages/` ファイル        | `app/` レイアウト階層             | 1階建て vs メゾネット |
| データ取得  | `getServerSideProps` | Server Component で直接 await | キッチンが各部屋に増える  |
| レンダリング | 100% CSR or SSR      | RSC + streaming            | 動画配信のチャンク送信   |
| 移行可否   | デフォルト                | 両立 OK (競合時 app優先)          | 既存ビルに新館増築     |

---

## 9. 開発フロー (簡易メモ)

1. `.env.local` に `MISSKEY_HOST` `MISSKEY_TOKEN` `ANTENNA_ID` を入れる。
2. `npm run dev` → `http://localhost:3000`。
3. `curl http://localhost:3000/api/mentionContext | jq` で JSON 確認。
4. VSCode で `CMD + P` → `ThreadSchema` と打てば型定義にジャンプ。

---

## 10. まとめ：結局「なぜ動く？」

> **多層の安全装置が噛み合っているから**

* Edge が Misskey との境界役、Zod がデータ検査官、SWR がデータ搬送管理人、LRU が倉庫、Tailwind が内装標準化。
* すべてが **壊れる前提** で設計されており、壊れても UI は壊さない。だからユーザーは「まるで社内ツールのように安定した Misskey ビューア」を享受できる。

```

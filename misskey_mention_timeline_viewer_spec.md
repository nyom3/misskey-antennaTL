# 📄 Misskey Mention Timeline Viewer — 技術仕様書 (v0.9)

## 0. プロンプト
1以降の内容でプロト版を作成して。
技術的なところは仮案なので、notepad-appとある程度同期をとり
既存採用技術はそっちに寄せるように調整してください

## 1. 概要 / Purpose

Misskey の **アンテナ TL**（自分への言及を収集するアンテナ）と **会話ツリー** API を組み合わせ、 ブラウザで「メンション＋前後の文脈」を TL 風に復元・閲覧できるシングルページアプリケーション (SPA) を実装する。

## 2. ゴール / Goals

| #  | 目標                                              | 完了定義                                                   |
| -- | ----------------------------------------------- | ------------------------------------------------------ |
| G1 | アンテナ TL(最大100件)を取得し、React 画面に一覧描画               | `/api/mentionContext` が 200 を返し、一覧が閲覧可能                |
| G2 | 各 Note の会話スレッドを取得し、インデント表示                      | スレッドがネスト表示され、折りたたみ/展開 UI が動作                           |
| G3 | モバイル〜PC までレスポンシブ                                | Tailwind breakpoints で確認 (sm〜xl)                       |
| G4 | 初期セットアップ〜デプロイを `npm install && npm dev` だけで再現 | README に手順があり、CI build が pass                          |
| G5 | ESLint / TypeScript / Prettier が全て通る            | `npm lint`, `npm type-check`, `npm format` が 0 exit |

## 3. 非目標 / Out‑of‑Scope (Phase‑1)

- 認証 UI（Misskey の OAuth2 画面）
- Supabase, DB 永続化
- PWA (Service Worker) / Push 通知
- テーマ切替 (ダークモード) は Tailwind のデフォルト class で準備のみ

## 4. アーキテクチャ

```
[Next.js 15 (app router)]
├─ /app                 – ページ & ルート単位 React Server Components
├─ /components          – 再利用 UI
├─ /lib/misskey.ts      – API ラッパー(fetch w/ typed response)
└─ /api/mentionContext  – Edge Runtime API Route
```

- **Edge Runtime** を想定(Vercel)、fetch latency を最小化。
- フロントは **SWR** で 30s ポーリング or Misskey WS (将来)。

## 5. 技術スタック / Tech Stack

| 区分     | 採用技術                                  | 備考                                   |
| ------ | ------------------------------------- | ------------------------------------ |
| 言語     | TypeScript 5.5                        | ^5.5.x                               |
| FW     | Next.js 15 (app router, edge runtime) | `@next/experimental-runtime` 有効      |
| UI     | React 19 / Tailwind CSS 3.4           | Twin 一切なし                            |
| API    | Misskey REST API v13.x                | `https://{host}/api/*`               |
| HTTP   | `undici` / fetch                      | Node18 互換                            |
| State  | SWR v2                                | `useSwr({ refreshInterval: 30000 })` |
| Lint   | ESLint (@next/eslint‑plugin‑next)     | AirBnB + Next 標準                     |
| Format | Prettier                              | trailingComma: es5                   |
| Test   | Vitest + Testing‑Library/React        | API mock に MSW                       |
| CI     | GitHub Actions                        | `npm test && npm build`            |

## 6. 機能要件 / Functional Requirements

1. **アンテナ TL 取得**
   - API: `POST /api/antennas/notes`
   - 入力: `antennaId`, `limit=30`, `i`(token)
2. **スレッド取得**
   - API: `POST /api/notes/conversation`
   - パラメータ: `noteId` (root)
3. **表示**
   - Note カード
     - アバター, displayName, username
     - 本文 (markdown → html), 添付 media thumb (max 2)
     - 投稿日時 (JST, 相対表示)
   - スレッドネスト (left border, padding)
   - 折りたたみ/展開ボタン (lucide-react icon)
4. **UX**
   - スクロール位置保持 (router cache)
   - リンク (misskey.io) クリックで新規タブ
   - エラートースト (react-hot-toast)

## 7. 非機能要件 / NFR

- **性能**: API Route レスポンス < 800 ms (Vercel東京), DOM ノード < 300
- **レート制御**: 会話 API への並列呼び出しを 5 同時までに制限 (p‑map)
- **セキュリティ**: `.env.local` にトークンを保持、ブラウザには出さない(Server Actions or API Only)
- **アクセシビリティ**: `aria-expanded` など基本属性
- **ブラウザサポート**: Last 2 Chrome / Safari / Firefox / Edge (モダン)

## 8. API 契約定義

### 8.1 `/api/mentionContext` (GET)

| 項目    | 内容                    |
| ----- | --------------------- |
| Query | `?limit=<1‑100>` 任意   |
| Res   | `200` JSON `[Thread]` |

```ts
// Thread 型
interface Thread {
  root: MisskeyNote;      // ルートノート
  ancestors: MisskeyNote[]; // 祖先 (古い順)
  descendants: MisskeyNote[]; // 子孫 (新しい順)
}
```

- MisskeyNote 型は docs のレスポンス定義を軽量 subset に。
- キャッシュ: `Cache-Control: s-maxage=60, stale-while-revalidate` (CDN)

### 8.2 エラー

| HTTP | 説明                                  |
| ---- | ----------------------------------- |
| 401  | Token なし/権限不足                       |
| 429  | Rate-limit 超過（Retry‑After ヘッダ付き）    |
| 500  | Misskey API エラー (詳細は `error` フィールド) |

## 9. 環境変数 / .env.local

```
MISSKEY_HOST=https://misskey.io
MISSKEY_TOKEN=xxxxxxxxxxxxxxxxx  # read:antennas read:notes
ANTENNA_ID=xxxxxxxxxxxxxxxxx     # 手動取得
```

## 10. ディレクトリ / Repository Layout (proposal)

```
misskey-antennaTL/
├─ app/
│  ├─ page.tsx              # root page (/)
│  └─ layout.tsx            # <html>
├─ components/
│  ├─ NoteCard.tsx
│  ├─ Thread.tsx
│  └─ Loader.tsx
├─ lib/
│  └─ misskey.ts            # fetch wrappers & Zod schemas
├─ api/
│  └─ mentionContext/route.ts  # Edge runtime
├─ styles/
│  └─ globals.css
├─ tests/
│  └─ noteCard.test.tsx
├─ public/
│  └─ favicon.svg
├─ .github/workflows/ci.yml
├─ tsconfig.json
└─ README.md
```

## 11. セットアップ / Usage

```sh
npm install    
cp .env.local.sample .env.local  # 値を入れる
npm dev        # http://localhost:3000/
```

## 12. コーディング規約 / Conventions

- **import alias**: `@/` → `./src/*` (tsconfig paths)
- **型安全**: 外部 API レスポンスは **Zod** で parse
- **コンポーネント命名**: UpperCamelCase, フォルダ名＝ファイル名
- **Commit**: Conventional Commits (`feat:`, `fix:`...) — lint‑staged で commit 時 format

## 13. テスト戦略

| レイヤ            | 手段                    | 例                                         |
| -------------- | --------------------- | ----------------------------------------- |
| 単体             | Vitest                | lib/misskey fetch wrapper → stub response |
| UI             | React Testing Library | NoteCard renders text & media             |
| API            | MSW                   | mentionContext returns 200                |
| E2E (optional) | Playwright            | `/` loads & displays notes                |

## 14. 今後のロードマップ (post‑MVP)

1. OAuth2 / Token 自動取得 (ユーザー各自)
2. PWA & Push 通知 (Service Worker + Misskey Streaming)
3. LocalStorage 既読・ハイライト
4. 検索・日付フィルタ UI
5. i18n (next-intl)

## 15. 参考リンク

- Misskey API Docs: [https://misskey-hub.net/ja/docs/for-developers/api/](https://misskey-hub.net/ja/docs/for-developers/api/)
- Example antenna stream: `wss://misskey.io/streaming?i=<token>&channel=antenna:<id>`

---

> **作業開始フロー**
>
> 1. この仕様書を README に転記 or リンク
> 2. `npm create next-app@latest` で骨格生成 (→ js→ts 変換)
> 3. `npm add swr zod react-hot-toast lucide-react p-map`
> 4. API Route → NoteCard → ThreadComponent の順で実装
> 5. GitHub に初回 push → CI green を確認

---

© 2025 開発


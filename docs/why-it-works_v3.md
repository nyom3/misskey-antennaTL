# なぜ動くのか？ v3（Why-it-Works v3）

> **このドキュメントは「全体像の速習＋詳細の深掘り」を両立することを目指しています。まず概要でざっくり全体像を把握し、必要なら各パートで詳細・Tips・比喩的な解説も参照できます。**

---

## 1. TL;DR（要点まとめ・30秒でわかる）

- **構成:** Next.js App Router（React/SWR）＋Edge API（Vercel）＋Misskey API
- **流れ:** ブラウザは30秒ごとにAPI取得→Edge APIがMisskey代理取得＆型検証→CDN/LRUキャッシュ→崩れてもUIは壊れない
- **キーワード:** 型安全（Zod）、キャッシュ（CDN/LRU）、多重防御、即時エラー通知

---

## 2. システム全体像（図・構成要素）

```mermaid
flowchart TD
    A[ブラウザ (React/SWR)] -->|GET /api/mentionContext| B[Edge API (route.ts)] B -->|POST /api/antennas/notes など| C[Misskey API]B -->|Zod型検証 & JSON| AB -.->|CDNキャッシュ (60s)| A
```

- **フロント:** React (Next.js) + Tailwind CSS（UI/状態管理/SWR）
- **バックエンド:** Next.js Edge Runtime（API中継・型検証・キャッシュ）
- **データ:** Misskey API（antennas/notes, notes/conversation など）

---

## 3. データフロー（ストーリー形式）

1. **ページ初期表示:** useSWRが `/api/mentionContext` へGET → Edge APIへ
2. **Edge API:** MisskeyへPOSTし、antennas/notes→各ノートの会話を並列取得
3. **型検証:** 取得データをZodで検証。不正時は500エラー
4. **キャッシュ:** CDNで60秒キャッシュされ、Misskey APIへの負荷分散
5. **UI更新:** SWRが正常データ受信でUI再描画。失敗時は即エラートースト表示

---

## 4. 技術選択＆設計意図（一覧＋比喩）

| 技術            | 役割                       | 類推イメージ           | 詳細補足                                  |
|-----------------|----------------------------|------------------------|-------------------------------------------|
| Next.js AppRouter| UIツリー＋データ取得を共置   | 家の間取り＋部屋        | SSR/CSRの柔軟な切替、複数ページ対応         |
| Edge Runtime    | レイテンシ削減＋中継API      | 駅ナカ                 | fetch最適化、オートスケール                |
| SWR             | キャッシュ＋再検証           | 巡回センサー           | 1行で再検証・ローディング・エラー管理        |
| Zod             | 型安全＋バリデーション        | 空港X線検査             | ランタイム型検証。失敗時は500エラー         |
| LRUCache        | 絵文字キャッシュ             | 回転棚                  | O(1)参照・自動パージ                       |
| Tailwind CSS    | UI一貫性                    | LEGOブロック            | クラス1行で統一デザイン                    |

---

## 5. 絵文字処理・ハイドレーション対策

- **fetchAndCacheEmojis:** 初回のみMisskeyのカスタム絵文字リストを取得し、LRUCacheに保存
- **parseNoteText:** ノート本文の `:emoji_name:` を `<img>` タグに置換（キャッシュ済みのみ）
- **ハイドレーションエラー対策:** emojiCache未準備時はテキストのままSSR、準備後にクライアント再レンダリング
- **dangerouslySetInnerHTML:** 信頼できるHTMLのみを挿入、XSSリスク回避

---

## 6. 型安全・エラー伝搬・多重防御

- **Zod型検証:** 外部APIの不正データは即500エラーで切断
- **エラー伝搬:** フロント（useSWR）がエラーを検知→トーストで即表示、UIクラッシュなし
- **多重防御:** どこかが壊れても、他で補完・通知される設計

---

## 7. キャッシュ戦略（CDN＋LRU）

- **CDN:** Cache-Control: s-maxage=60, stale-while-revalidate
  - ユーザー多数でもMisskey APIへのリクエストを大幅削減
- **LRUCache:** 絵文字上限2000件、古いものは自動削除

---

## 8. よくある質問・Tips

- **.env.local記入例:**  
  ```
  MISSKEY_HOST=https://misskey.io
  MISSKEY_TOKEN=xxxxx
  ANTENNA_ID=xxxxxx
  ```

- **開発起動:**  
  ```
  npm run dev
  http://localhost:3000
  ```

- **クイックリンク:**
    - mentionContext API: `src/app/api/mentionContext/route.ts`
    - Misskey fetch: `src/lib/misskey.ts`
    - 絵文字: `src/lib/emoji.ts`
    - 型定義: `ThreadSchema`など

---

## 9. まとめ

- **多層防御＋型安全＋キャッシュ戦略で「壊れても崩れない」安定運用**
- **初学者も実装者も、全体像も詳細もすぐ辿れる構成を目指しました**

---

> **補足や拡張提案があれば、GitHub Issue/PRへお気軽に！**

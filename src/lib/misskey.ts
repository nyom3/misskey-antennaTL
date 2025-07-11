import { z } from 'zod';
import pMap from 'p-map';

// Misskeyのノート情報を軽量化したZodスキーマ定義。
// Misskey APIから返されるノートオブジェクトの構造を定義し、
// ランタイムでのバリデーションとTypeScriptの型生成に利用します。
// これにより、APIレスポンスの型安全性を保証します。
export const MisskeyNoteSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  text: z.string().nullable(),
  cw: z.string().nullable(), // Contents Warningのテキスト
  user: z.object({
    id: z.string(),
    createdAt: z.string().optional(), // ユーザーの作成日時も取得
    name: z.string().nullable(),
    username: z.string(),
    host: z.string().nullable(), // リモートユーザーの場合のホスト名
    avatarUrl: z.string().url(),
  }),
  files: z.array(z.object({
    thumbnailUrl: z.string().url(),
  })).optional(), // 添付ファイルのサムネイルURL
  // Misskey APIでは { name: url } の連想配列として返るため Record で受け取る
  emojis: z.record(z.string().url()).optional(),
  // その他の必要なフィールドがあればここに追加
});

// ZodスキーマからTypeScriptの型を生成します。
// これにより、コード全体でMisskeyNoteオブジェクトを型安全に扱えます。
export type MisskeyNote = z.infer<typeof MisskeyNoteSchema>;

// スレッド全体の構造を定義するZodスキーマ。
// 会話の流れを表現するために、ルートノート、祖先ノート、子孫ノートを含みます。
export const ThreadSchema = z.object({
  root: MisskeyNoteSchema,      // スレッドの起点となるノート
  ancestors: z.array(MisskeyNoteSchema), // rootより前のノート（古い順）
  descendants: z.array(MisskeyNoteSchema), // rootより後のノート（新しい順）
});

// ThreadスキーマからTypeScriptの型を生成します。
export type Thread = z.infer<typeof ThreadSchema>;

/**
 * Misskey APIへのリクエストを共通化するヘルパー関数。
 * すべてのMisskey API呼び出しはこの関数を経由し、
 * 認証トークンの自動注入、Content-Typeヘッダーの設定、エラーハンドリングを行います。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param endpoint APIエンドポイント (例: 'notes/show')
 * @param body リクエストボディ (デフォルトは空オブジェクト)
 * @returns APIレスポンスのJSONデータ
 * @throws APIリクエストが失敗した場合、エラーをスローします。
 */
export async function misskeyFetch(host: string, token: string, endpoint: string, body: object = {}) {
  const response = await fetch(`${host}/api/${endpoint}`, {
    method: 'POST', // Misskey APIはほとんどのエンドポイントでPOSTメソッドを使用します
    headers: {
      'Content-Type': 'application/json',
      // 認証トークンをAuthorizationヘッダーに含める（Misskey APIの仕様による）
      'Authorization': `Bearer ${token}`,
    },
    // リクエストボディに認証トークン 'i' を含める（Misskey APIのもう一つの認証方法）
    body: JSON.stringify({ ...body, i: token }),
  });

  // レスポンスが成功しなかった場合（HTTPステータスコードが2xx以外）のエラーハンドリング
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})); // エラーレスポンスボディをパース
    const errorMessage = errorBody.error?.message || response.statusText; // エラーメッセージを抽出
    const error = new Error(`Misskey APIエラー (${endpoint}): ${errorMessage}`);
    (error as any).statusCode = response.status; // HTTPステータスコードをエラーオブジェクトに追加
    (error as any).retryAfter = response.headers.get('Retry-After'); // Retry-Afterヘッダーがあれば追加
    throw error;
  }
  return response.json(); // 成功した場合、JSONデータを返却
}

/**
 * 指定されたアンテナIDのノート一覧を取得します。
 * `antennas/notes` エンドポイントを使用します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param antennaId 取得対象のアンテナID
 * @param limit 取得件数（デフォルト30）
 * @returns MisskeyNoteの配列
 */
export async function fetchAntennaNotes(host: string, token: string, antennaId: string, limit: number = 30) {
  const notes = await misskeyFetch(host, token, 'antennas/notes', { antennaId, limit });
  // 取得したノートの配列をZodスキーマでバリデーションします。
  return z.array(MisskeyNoteSchema).parse(notes);
}

/**
 * 指定されたノートIDの会話スレッドを取得します。
 * `notes/conversation` エンドポイントを使用します。
 * Misskey APIは会話を時系列順に返すため、ルートノートを基準に祖先と子孫を正確に分類します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param noteId 会話の中心となるノートID
 * @returns 構造化されたスレッドオブジェクト
 */
export async function fetchConversation(host: string, token: string, noteId: string) {
  // 会話ノートとルートノートを並列で取得
  const [conversationRaw, rootNoteRaw] = await Promise.all([
    misskeyFetch(host, token, 'notes/conversation', { noteId }),
    misskeyFetch(host, token, 'notes/show', { noteId }),
  ]);

  // Zodでバリデーション
  const conversation = z.array(MisskeyNoteSchema).parse(conversationRaw);
  const rootNote = MisskeyNoteSchema.parse(rootNoteRaw);

  // ルートノートを除外した会話ノートを準備
  const filteredConversation = conversation.filter(note => note.id !== rootNote.id);

  // ルートノートの作成日時を基準に祖先と子孫を分類
  const ancestors = filteredConversation.filter(note => new Date(note.createdAt).getTime() < new Date(rootNote.createdAt).getTime());
  const descendants = filteredConversation.filter(note => new Date(note.createdAt).getTime() > new Date(rootNote.createdAt).getTime());

  // 祖先ノートは古い順、子孫ノートは新しい順にソート（APIから時系列順で返るとは限らないため）
  ancestors.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  descendants.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    root: rootNote,
    ancestors: ancestors,
    descendants: descendants,
  };
}

/**
 * 複数のノート配列をマージし、重複を排除して投稿日時 (createdAt) の降順でソートします。
 * @param notes 結合するノートの配列
 * @returns 重複排除され、ソートされたノートの配列
 */
function mergeAndSortNotes(notes: MisskeyNote[]): MisskeyNote[] {
  // 重複するノートを排除するためにMapを使用します。
  // MapのキーにノートIDを使用することで、ユニークなノートのみを保持できます。
  const uniqueNotes = Array.from(new Map(notes.map(note => [note.id, note])).values());

  // ノートを投稿日時 (createdAt) の降順でソートします。
  uniqueNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return uniqueNotes;
}

/**
 * 指定されたノートIDを中心に、その前後のタイムラインを取得します。
 * `notes/local-timeline` または `notes/timeline` エンドポイントを使用します。
 * `p-map` を使用して、前後のノート取得を並列で実行し、パフォーマンスを向上させています。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param noteId 基点となるノートID
 * @param scope タイムラインのスコープ ('global' or 'local')
 * @returns 基点ノートと、その前後のノートを含む配列 (createdAt降順)
 */
export async function getTimelineAround(host: string, token: string, noteId: string, scope: 'global' | 'local') {
  // スコープに応じて適切なタイムラインエンドポイントを選択
  const timelineEndpoint = scope === 'local' ? 'notes/local-timeline' : 'notes/timeline';

  // 1. 基点となるノートを取得 (`notes/show`)
  const centerNote = await misskeyFetch(host, token, 'notes/show', { noteId });
  const parsedCenterNote = MisskeyNoteSchema.parse(centerNote);

  // 2. 古いノート (基点ノートより前) を取得 (`untilId` を使用)
  const olderNotesPromise = misskeyFetch(host, token, timelineEndpoint, {
    untilId: noteId,
    limit: 10, // 前10件を取得
  }).then(notes => z.array(MisskeyNoteSchema).parse(notes));

  // 3. 新しいノート (基点ノートより後) を取得 (`sinceId` を使用)
  const newerNotesPromise = misskeyFetch(host, token, timelineEndpoint, {
    sinceId: noteId,
    limit: 10, // 後10件を取得
  }).then(notes => z.array(MisskeyNoteSchema).parse(notes));

  // `p-map` を使用して、古いノートと新しいノートの取得を並列で実行します。
  // `concurrency: 2` は同時に2つのPromiseを実行することを意味します。
  const [olderNotes, newerNotes] = await pMap([olderNotesPromise, newerNotesPromise], async (p) => await p, { concurrency: 2 });

  // 4. 全てのノートをマージし、重複を排除してcreatedAtの降順でソート
  const allNotes = [
    ...olderNotes,
    parsedCenterNote,
    ...newerNotes,
  ];

  return mergeAndSortNotes(allNotes);
}

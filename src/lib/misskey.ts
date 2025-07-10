import { z } from 'zod';
import pMap from 'p-map';

// Misskeyのノート情報を軽量化したZodスキーマ定義
// APIレスポンスから必要なフィールドのみを抽出し、型安全性を保証します。
export const MisskeyNoteSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  replyId: z.string().nullable(),
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
  reactions: z.record(z.number()).optional(),
  reactionEmojis: z.record(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
  // その他の必要なフィールドがあればここに追加
});

// ZodスキーマからTypeScriptの型を生成
export type MisskeyNote = z.infer<typeof MisskeyNoteSchema>;

// スレッド全体の構造を定義するZodスキーマ
export const ThreadSchema = z.object({
  root: MisskeyNoteSchema,      // スレッドの起点となるノート
  ancestors: z.array(MisskeyNoteSchema), // rootより前のノート（古い順）
  descendants: z.array(MisskeyNoteSchema), // rootより後のノート（新しい順）
});

export type Thread = z.infer<typeof ThreadSchema>;

/**
 * Misskey APIへのリクエストを共通化するヘルパー関数。
 * トークンを自動で注入し、エラーハンドリングを行います。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param endpoint APIエンドポイント (例: 'notes/show')
 * @param body リクエストボディ
 * @returns APIレスポンスのJSONデータ
 * @throws APIリクエストが失敗した場合
 */
async function misskeyFetch(host: string, token: string, endpoint: string, body: object = {}) {
  const response = await fetch(`${host}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, i: token }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = (errorBody as { error?: { message?: string } }).error?.message || response.statusText;
    const error = new Error(`Misskey APIエラー (${endpoint}): ${errorMessage}`) as Error & {
      statusCode?: number;
      retryAfter?: string | null;
    };
    error.statusCode = response.status;
    error.retryAfter = response.headers.get('Retry-After');
    throw error;
  }
  return response.json();
}

/**
 * 指定されたアンテナIDのノート一覧を取得します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param antennaId 取得対象のアンテナID
 * @param limit 取得件数（デフォルト30）
 * @returns MisskeyNoteの配列
 */
export async function fetchAntennaNotes(host: string, token: string, antennaId: string, limit: number = 30) {
  const notes = await misskeyFetch(host, token, 'antennas/notes', { antennaId, limit });
  return z.array(MisskeyNoteSchema).parse(notes);
}

/**
 * 指定されたノートIDの会話スレッドを取得します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param noteId 会話の中心となるノートID
 * @returns 構造化されたスレッドオブジェクト
 */
export async function fetchConversation(host: string, token: string, noteId: string) {
  const raw = await misskeyFetch(host, token, 'notes/conversation', { noteId });
  const notes = z.array(MisskeyNoteSchema).parse(raw);

  const map = new Map<string, MisskeyNote>();
  for (const n of notes) {
    map.set(n.id, n);
  }

  const root = map.get(noteId);
  if (!root) {
    throw new Error('Root note not found');
  }

  const ancestors: MisskeyNote[] = [];
  let current: MisskeyNote | undefined = root;
  const visited = new Set<string>();
  while (current && current.replyId && !visited.has(current.replyId)) {
    const parent = map.get(current.replyId);
    if (!parent) break;
    ancestors.unshift(parent);
    visited.add(parent.id);
    current = parent;
  }

  const descendants: MisskeyNote[] = [];
  const collect = (parentId: string) => {
    for (const note of notes) {
      if (note.replyId === parentId) {
        descendants.push(note);
        collect(note.id);
      }
    }
  };
  collect(root.id);
  descendants.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { root, ancestors, descendants };
}

/**
 * 指定されたノートIDを中心に、その前後のタイムラインを取得します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param noteId 基点となるノートID
 * @param scope タイムラインのスコープ ('global' or 'local')
 * @returns 基点ノートと、その前後のノートを含む配列 (createdAt降順)
 */
export async function getTimelineAround(host: string, token: string, noteId: string, scope: 'global' | 'local') {
  const timelineEndpoint = scope === 'local' ? 'notes/local-timeline' : 'notes/timeline';

  // 1. 基点となるノートを取得
  const centerNote = await misskeyFetch(host, token, 'notes/show', { noteId });
  const parsedCenterNote = MisskeyNoteSchema.parse(centerNote);

  // 2. 古いノート (基点ノートより前) を取得
  const olderNotesPromise = misskeyFetch(host, token, timelineEndpoint, {
    untilId: noteId,
    limit: 10,
  }).then(notes => z.array(MisskeyNoteSchema).parse(notes));

  // 3. 新しいノート (基点ノートより後) を取得
  const newerNotesPromise = misskeyFetch(host, token, timelineEndpoint, {
    sinceId: noteId,
    limit: 10,
  }).then(notes => z.array(MisskeyNoteSchema).parse(notes));

  const [olderNotes, newerNotes] = await pMap([olderNotesPromise, newerNotesPromise], async (p) => await p, { concurrency: 2 });

  // 4. 全てのノートをマージし、重複を排除してcreatedAtの降順でソート
  const allNotes = [
    ...olderNotes,
    parsedCenterNote,
    ...newerNotes,
  ];

  const uniqueNotes = Array.from(new Map(allNotes.map(note => [note.id, note])).values());

  uniqueNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return uniqueNotes;
}

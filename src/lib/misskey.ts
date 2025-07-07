import { z } from 'zod';

// Misskeyのノート情報を軽量化したZodスキーマ定義
// APIレスポンスから必要なフィールドのみを抽出し、型安全性を保証します。
export const MisskeyNoteSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  text: z.string().nullable(),
  cw: z.string().nullable(), // Contents Warningのテキスト
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    username: z.string(),
    avatarUrl: z.string().url(),
  }),
  files: z.array(z.object({
    thumbnailUrl: z.string().url(),
  })).optional(), // 添付ファイルのサムネイルURL
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
 * 指定されたアンテナIDのノート一覧を取得します。
 * @param host Misskeyインスタンスのホスト名
 * @param token 認証用APIトークン
 * @param antennaId 取得対象のアンテナID
 * @param limit 取得件数（デフォルト30）
 * @returns MisskeyNoteの配列
 */
export async function fetchAntennaNotes(host: string, token: string, antennaId: string, limit: number = 30) {
  const response = await fetch(`${host}/api/antennas/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ antennaId, limit, i: token }),
  });
  if (!response.ok) {
    throw new Error(`アンテナノートの取得に失敗しました: ${response.statusText}`);
  }
  const notes = await response.json();
  // Zodスキーマでレスポンスをパースし、型安全性を確保
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
  const response = await fetch(`${host}/api/notes/conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ noteId, i: token }),
  });
  if (!response.ok) {
    throw new Error(`会話の取得に失敗しました: ${response.statusText}`);
  }
  const conversation = await response.json();

  // Misskey APIのレスポンスはフラットなノート配列なので、アプリケーションで扱いやすいように
  // root, ancestors, descendants に分割・再構築する必要があります。
  // ここでは簡易的な実装例を示します。
  const rootNote = conversation.find((note: any) => note.id === noteId);
  return {
    root: rootNote,
    ancestors: [], // 本来はここにも適切なノートが入る
    descendants: conversation.filter((note: any) => note.id !== noteId), // root以外を子孫として仮置き
  };
}
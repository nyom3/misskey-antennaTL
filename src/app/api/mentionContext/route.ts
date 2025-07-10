import { NextResponse } from 'next/server';
import pMap from 'p-map';
import {
  fetchAntennaNotes,
  fetchConversation,
  ThreadSchema,
} from '@/lib/misskey';

// Vercel Edge Runtimeで実行されることを明示
export const runtime = 'edge';

/**
 * GET /api/mentionContext
 * MisskeyのアンテナTLと各ノートの会話スレッドを組み合わせて取得するAPIルート。
 * @param request Next.jsのRequestオブジェクト
 * @returns 成功時: スレッド情報の配列(JSON), 失敗時: エラー情報(JSON)
 */
export async function GET(request: Request) {
  // URLクエリパラメータからlimitを取得（デフォルトは30）
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  // 環境変数からMisskeyの接続情報を取得
  const host = process.env.MISSKEY_HOST;
  const token = process.env.MISSKEY_TOKEN;
  const antennaId = process.env.ANTENNA_ID;

  // 必要な環境変数が設定されているかチェック
  if (!host || !token || !antennaId) {
    return NextResponse.json({ error: '必要な環境変数が設定されていません' }, { status: 500 });
  }

  try {
    // 1. アンテナに登録されたノートの一覧を取得
    const antennaNotes = await fetchAntennaNotes(host, token, antennaId, limit);

    // 2. 各ノートの会話スレッドを並列で取得
    // p-mapを使い、同時に実行するリクエスト数を5に制限し、APIサーバーへの負荷を抑える
    const threads = await pMap(
      antennaNotes,
      async (note) => {
        const conversation = await fetchConversation(host, token, note.id);
        // lib/misskey.tsから返された会話データをスレッド構造に整形
        // 注: 現在の実装は簡易的なプレースホルダーです
        return {
          root: note,
          ancestors: [],
          descendants: conversation.descendants,
        };
      },
      { concurrency: 5 } // 同時実行数を5に制限
    );

    // 3. 取得したスレッドデータをZodスキーマで検証
    const validatedThreads = ThreadSchema.array().parse(threads);

    // 4. 検証済みのデータをJSON形式でレスポンスとして返す
    // CDNキャッシュを60秒間有効にするヘッダーを付与
    return NextResponse.json({
      threads: validatedThreads,
      instanceHost: host,
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
      },
    });
  } catch (error) {
    // エラーハンドリング
    console.error('Error in /api/mentionContext:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return NextResponse.json({ error: 'メンションコンテキストの取得に失敗しました', details: errorMessage }, { status: 500 });
  }
}

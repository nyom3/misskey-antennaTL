import { NextResponse } from 'next/server';
import { getTimelineAround } from '@/lib/misskey';

export const runtime = 'edge';

/**
 * GET /api/contextTL
 * 指定されたノートIDを中心に、その前後のタイムラインを取得するAPIルート。
 * @param request Next.jsのRequestオブジェクト
 * @returns 成功時: ノートの配列(JSON), 失敗時: エラー情報(JSON)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get('noteId');
  const scope = searchParams.get('scope') || 'global'; // 'global' or 'local'

  if (!noteId) {
    return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
  }

  if (scope !== 'global' && scope !== 'local') {
    return NextResponse.json({ error: 'Invalid scope. Must be "global" or "local".' }, { status: 400 });
  }

  const host = process.env.MISSKEY_HOST;
  const token = process.env.MISSKEY_TOKEN;

  if (!host || !token) {
    return NextResponse.json({ error: 'Missing environment variables (MISSKEY_HOST or MISSKEY_TOKEN)' }, { status: 500 });
  }

  try {
    const timeline = await getTimelineAround(host, token, noteId, scope as 'global' | 'local');
    return NextResponse.json(timeline, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error(error);
    const err = error as { statusCode?: number; message?: string; retryAfter?: string };
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || '不明なエラーが発生しました';
    const retryAfter = err.retryAfter;

    const headers: HeadersInit = {};
    if (retryAfter) {
      headers['Retry-After'] = retryAfter;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode, headers });
  }
}

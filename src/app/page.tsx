'use client';

import useSWR from 'swr';
import { Toaster, toast } from 'react-hot-toast';
import { Thread } from '@/lib/misskey';
import ThreadComponent from '@/components/Thread';

/**
 * SWRがデータフェッチに利用するfetcher関数。
 * 指定されたURLからデータを取得し、JSONとして返します。
 * @param url フェッチ対象のURL
 * @returns レスポンスのJSONデータ
 * @throws レスポンスがokでない場合にエラーをスローします。
 */
const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    const error = new Error('APIリクエスト中にエラーが発生しました。') as Error & { info?: unknown };
    res.json().then((body: unknown) => { error.info = body; });
    throw error;
  }
  return res.json();
});

/**
 * アプリケーションのメインページコンポーネント。
 * SWRを使用してAPIからメンションタイムラインを取得し、表示します。
 * 定期的なデータ再取得、ローディング状態、エラー状態のハンドリングを行います。
 */
export default function HomePage() {
  // スレッド一覧を取得
  const { data: threads, error, isLoading } = useSWR<Thread[]>(
    '/api/mentionContext',
    fetcher,
    {
      refreshInterval: 30000,
      onError: (err) => {
        toast.error(`アンテナノートの読込に失敗: ${err.message}`);
      }
    }
  );


  return (
    <div className="bg-white dark:bg-black min-h-screen">
      {/* react-hot-toast用のコンテナ */}
      <Toaster />
      <main className="container mx-auto max-w-2xl p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Misskey Mentions (Context TL)</h1>
        </header>
        
        {/* ローディング中の表示 */}
        {isLoading && (
          <div className="flex justify-center items-center p-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* エラー発生時の表示 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">エラー: </strong>
            <span className="block sm:inline">タイムラインの読込に失敗しました。接続またはAPIトークンを確認してください。</span>
          </div>
        )}

        {!isLoading && !error && threads && (
          <div className="space-y-6">
            {threads.map((thread) => (
              <ThreadComponent key={thread.root.id} thread={thread} />
            ))}
          </div>
        )}

        {!isLoading && !error && !threads && (
          <p className="text-center text-gray-500 dark:text-gray-400">アンテナノートがありません。</p>
        )}
      </main>
    </div>
  );
}

'use client';

import useSWR from 'swr';
import { Toaster, toast } from 'react-hot-toast';
import { Thread as ThreadType } from '@/lib/misskey';
import Thread from '@/components/Thread';

/**
 * SWRがデータフェッチに利用するfetcher関数。
 * 指定されたURLからデータを取得し、JSONとして返します。
 * @param url フェッチ対象のURL
 * @returns レスポンスのJSONデータ
 * @throws レスポンスがokでない場合にエラーをスローします。
 */
const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    const error = new Error('APIリクエスト中にエラーが発生しました。');
    // エラーオブジェクトに追加情報を付与
    res.json().then(body => { (error as any).info = body; });
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
  // useSWRフックでAPIからデータを取得
  const { data, error, isLoading } = useSWR<ThreadType[]>(
    '/api/mentionContext', // APIエンドポイント
    fetcher, // データ取得用の関数
    {
      refreshInterval: 30000, // 30秒ごとにデータを自動再取得
      onError: (err) => {
        // データ取得エラー時にトースト通知を表示
        toast.error(`タイムラインの読込に失敗: ${err.message}`);
      }
    }
  );

  return (
    <div className="bg-white dark:bg-black min-h-screen">
      {/* react-hot-toast用のコンテナ */}
      <Toaster />
      <main className="container mx-auto max-w-2xl p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Misskey Mentions</h1>
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

        {/* データ取得成功時の表示 */}
        {data && (
          <div className="space-y-6">
            {data.map((thread) => (
              <Thread key={thread.root.id} thread={thread} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
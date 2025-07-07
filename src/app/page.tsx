'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Toaster, toast } from 'react-hot-toast';
import { MisskeyNote, Thread } from '@/lib/misskey';
import NoteCard from '@/components/NoteCard';

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
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // アンテナノートを取得
  const { data: antennaData, error: antennaError, isLoading: isLoadingAntenna } = useSWR<Thread[]>(
    '/api/mentionContext',
    fetcher,
    {
      refreshInterval: 30000,
      onError: (err) => {
        toast.error(`アンテナノートの読込に失敗: ${err.message}`);
      }
    }
  );

  const timelineScope = 'global'; // 'global' または 'local'

  // コンテキストタイムラインを取得
  const { data: timelineData, error: timelineError, isLoading: isLoadingTimeline } = useSWR<MisskeyNote[]>(
    selectedNoteId ? `/api/contextTL?noteId=${selectedNoteId}&scope=${timelineScope}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      onError: (err) => {
        toast.error(`タイムラインの読込に失敗: ${err.message}`);
      }
    }
  );

  const isLoading = isLoadingAntenna || (selectedNoteId && isLoadingTimeline);
  const error = antennaError || timelineError;

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
  };

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

        {!isLoading && !error && !selectedNoteId && antennaData && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">アンテナノートを選択</h2>
            {antennaData.map((thread) => (
              <NoteCard 
                key={thread.root.id} 
                note={thread.root} 
                onClick={() => handleSelectNote(thread.root.id)}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              />
            ))}
          </div>
        )}

        {!isLoading && !error && selectedNoteId && timelineData && (
          <div className="space-y-6">
            <button 
              onClick={() => setSelectedNoteId(null)}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
            >
              アンテナノート選択に戻る
            </button>
            {timelineData.map((note) => (
              <NoteCard key={note.id} note={note} isAntennaRoot={note.id === selectedNoteId} />
            ))}
          </div>
        )}

        {!isLoading && !error && !antennaData && (
          <p className="text-center text-gray-500 dark:text-gray-400">アンテナノートがありません。</p>
        )}
      </main>
    </div>
  );
}

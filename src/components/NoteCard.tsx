'use client';

import Image from 'next/image';
import { MisskeyNote } from '@/lib/misskey';

// NoteCardコンポーネントのProps型定義
interface NoteCardProps {
  note: MisskeyNote;
}

/**
 * ISO 8601形式の日付文字列を日本のロケールに合わせた日時にフォーマットします。
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた日時文字列 (例: "2025/07/08 12:34:56")
 */
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP');
};

/**
 * Misskeyの単一ノートを表示するためのUIコンポーネント。
 * ユーザーのアバター、名前、本文、投稿日時などを表示します。
 * @param {NoteCardProps} props - noteオブジェクトを含むprops
 */
export default function NoteCard({ note }: NoteCardProps) {
  return (
    <div className="flex space-x-3 p-3 border-b border-gray-200 dark:border-gray-800">
      {/* アバター表示エリア */}
      <div className="flex-shrink-0">
        <Image
          src={note.user.avatarUrl}
          alt={`${note.user.name || note.user.username}'s avatar`}
          width={48}
          height={48}
          className="rounded-full"
        />
      </div>
      {/* ノート内容表示エリア */}
      <div className="flex-1">
        <div className="flex items-center space-x-2 text-sm">
          {/* ユーザー名 */}
          <span className="font-bold text-gray-900 dark:text-gray-100">{note.user.name}</span>
          {/* ユーザーID */}
          <span className="text-gray-500 dark:text-gray-400">@{note.user.username}</span>
          {/* 投稿日時 */}
          <span className="text-gray-500 dark:text-gray-400">· {formatTime(note.createdAt)}</span>
        </div>
        {/* ノート本文 */}
        <div className="mt-1 text-gray-800 dark:text-gray-200">
          {note.text}
        </div>
      </div>
    </div>
  );
}
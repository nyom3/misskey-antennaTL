'use client';

import Image from 'next/image';
import { MisskeyNote } from '@/lib/misskey';

// :emoji: の形式を実際の絵文字画像に置き換えるヘルパー
// Misskey APIでは絵文字一覧が Record<string, string> で返る
function renderTextWithEmoji(text?: string | null, emojis?: Record<string, string>) {
  if (!text) return null;
  const parts = text.split(/(:[a-zA-Z0-9_]+:)/g);
  return parts.map((part, idx) => {
    const match = part.match(/^:([a-zA-Z0-9_]+):$/);
    if (match) {
      const url = emojis ? emojis[match[1]] : undefined;
      if (url) {
        return (
          <Image
            key={idx}
            src={url}
            alt={match[0]}
            width={20}
            height={20}
            className="inline-block align-text-bottom"
          />
        );
      }
    }
    return <span key={idx}>{part}</span>;
  });
}

// NoteCardコンポーネントのProps型定義
interface NoteCardProps {
  note: MisskeyNote;
  isAntennaRoot?: boolean; // 新しく追加するプロパティ
  onClick?: () => void; // クリックイベントハンドラを追加
  className?: string; // カスタムクラス名を追加
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
export default function NoteCard({ note, isAntennaRoot, onClick, className }: NoteCardProps) {
  const cardClasses = `flex space-x-3 p-3 border-b border-gray-200 dark:border-gray-800 ${isAntennaRoot ? 'bg-yellow-100 dark:bg-yellow-900' : ''} ${className || ''}`;

  return (
    <div className={cardClasses} onClick={onClick}> {/* onClickとclassNameを適用 */}
      {/* アバター表示エリア */}
      <div className="flex-shrink-0">
        <Image
          src={note.user.avatarUrl}
          alt={`${note.user.name || note.user.username}'s avatar`}
          width={40} // アバターサイズを少し小さく
          height={40} // アバターサイズを少し小さく
          className="rounded-full"
        />
      </div>
      {/* ノート内容表示エリア */}
      <div className="flex-1">
        <div className="flex items-center space-x-2 text-xs"> {/* フォントサイズを小さく */}
          {/* ユーザー名 */}
          <span className="font-bold text-gray-900 dark:text-gray-100">{note.user.name}</span>
          {/* ユーザーID */}
          <span className="text-gray-500 dark:text-gray-400">@{note.user.username}</span>
          {/* 投稿日時 */}
          <span className="text-gray-500 dark:text-gray-400">· {formatTime(note.createdAt)}</span>
        </div>
        {/* ノート本文 */}
        <div className="mt-1 text-sm text-gray-800 dark:text-gray-200"> {/* フォントサイズを小さく */}
          {renderTextWithEmoji(note.text, note.emojis)}
        </div>
      </div>
    </div>
  );
}
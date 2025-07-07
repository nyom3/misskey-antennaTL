'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Thread as ThreadType } from '@/lib/misskey';
import NoteCard from './NoteCard';

// ThreadコンポーネントのProps型定義
interface ThreadProps {
  thread: ThreadType;
}

/**
 * 会話スレッド全体を表示するためのUIコンポーネント。
 * Ancestors, Root, Descendants の各ノートをNoteCardコンポーネントを使って描画します。
 * スレッドの折りたたみ/展開機能も提供します。
 * @param {ThreadProps} props - threadオブジェクトを含むprops
 */
export default function Thread({ thread }: ThreadProps) {
  // スレッドの展開状態を管理するstate (デフォルトは展開済み)
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* 折りたたみ/展開を制御するヘッダー部分 */}
      <div 
        className="bg-gray-50 dark:bg-gray-900 p-2 flex items-center cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Conversation</span>
      </div>

      {/* isExpandedがtrueの場合のみスレッド内容を表示 */}
      {isExpanded && (
        <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          {/* 祖先ノートの表示 */}
          {thread.ancestors.map(note => <NoteCard key={note.id} note={note} />)}
          
          {/* ルートノートの表示 (青い枠線で強調) */}
          <div className="border-2 border-blue-500 rounded-lg my-2">
            <NoteCard note={thread.root} />
          </div>

          {/* 子孫ノートの表示 */}
          {thread.descendants.map(note => <NoteCard key={note.id} note={note} />)}
        </div>
      )}
    </div>
  );
}
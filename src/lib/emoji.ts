import { LRUCache } from 'lru-cache';

// Emojiの型定義
interface Emoji {
  name: string;
  url: string;
  category: string;
  aliases?: string[];
}

// 絵文字データをキャッシュするためのLRU (Least Recently Used) キャッシュインスタンス。
// `max: 2000` は、キャッシュに保持する絵文字の最大数を指定します。
// Misskeyインスタンスから取得される絵文字の総数（約977個）を考慮し、
// キャッシュからデータが押し出されないように十分なサイズを設定しています。
const emojiCache = new LRUCache<string, string>({ max: 2000 });


/**
 * Misskeyインスタンスから絵文字を取得し、キャッシュに保存します。
 * この関数は、アプリケーションの起動時に一度だけ呼び出され、
 * 以降の絵文字変換処理で利用されるキャッシュを構築します。
 * @param instanceHost Misskeyインスタンスのホスト名
 */
export async function fetchAndCacheEmojis(instanceHost: string) {
  // キャッシュにすでにデータがある場合は、再取得の必要はないため処理を終了します。
  if (emojiCache.size > 0) {
    return;
  }

  try {
    // Misskey APIの /api/emojis エンドポイントにPOSTリクエストを送信して絵文字リストを取得します。
    // Misskey APIは絵文字リストの取得にPOSTメソッドを要求します。
    const response = await fetch(`${instanceHost}/api/emojis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // 空のJSONボディを送信
    });
    if (!response.ok) {
      throw new Error(`絵文字の取得に失敗しました。Status: ${response.status}`);
    }
    const data = await response.json();
    const emojis: Emoji[] = data.emojis;

    // 取得した絵文字データをキャッシュに保存します。
    // 絵文字の `name` をキーとして、その絵文字のURLを値として保存します。
    emojis.forEach(emoji => {
      emojiCache.set(emoji.name, emoji.url);
    });
    console.log(`${emojis.length}個の絵文字をキャッシュしました。`);
  } catch (error) {
    console.error('絵文字のキャッシュ中にエラー:', error);
  }
}

/**
 * ノートのテキストを解析し、絵文字コードを画像タグに置換します。
 * この関数は、ノートの本文が表示される際に呼び出されます。
 * @param text ノートのテキスト
 * @param instanceHost Misskeyインスタンスのホスト名 (現在この関数内では直接使用されていませんが、将来的な拡張のために残されています)
 * @returns HTML文字列
 */
export function parseNoteText(text: string, instanceHost: string): string {
  if (!text) return '';

  // :emoji_name: 形式の絵文字コードをマッチさせる正規表現。
  // `[a-zA-Z0-9_\-]+` は、絵文字名が英数字、アンダースコア、ハイフンで構成されることを意味します。
  // `g` フラグは、テキスト全体で全てのマッチを検索することを示します。
  const emojiRegex = /:([a-zA-Z0-9_\-]+):/g;

  // テキスト内の絵文字ショートコードを検索し、置換します。
  return text.replace(emojiRegex, (match, emojiName) => {
    // キャッシュから絵文字のURLを検索します。
    const emojiUrl = emojiCache.get(emojiName);
    if (emojiUrl) {
      // キャッシュに絵文字が見つかった場合、`<img>` タグを生成して返します。
      // `inline-block h-5 w-5` クラスは、Tailwind CSSでインライン表示とサイズ調整を行います。
      return `<img src="${emojiUrl}" alt="${emojiName}" class="inline-block h-5 w-5" />`;
    }
    // キャッシュに絵文字が見つからなかった場合、元のショートコードをそのまま返します。
    // MFM (Misskey Flavored Markdown) の他の構文（メンション、ハッシュタグなど）もここに追加可能です。
    return match; 
  });
}
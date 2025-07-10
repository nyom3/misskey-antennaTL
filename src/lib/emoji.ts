export function parseNoteText(
  text: string,
  instanceHost: string
): string {
  // カスタム絵文字の正規化表現
  // :name: または :name@host: の形式にマッチ
  const emojiRegex = /:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_.-]+))?:/g;

  // instanceHostを正規化: プロトコルと末尾のスラッシュを削除
  let normalizedInstanceHost = instanceHost.replace(/^https?:

  return text.replace(emojiRegex, (match, name, host) => {
    // emojiHostを正規化: プロトコルと末尾のスラッシュを削除
    let emojiHost = (host || normalizedInstanceHost).replace(/^https?:
    
    const emojiUrl = `https://${emojiHost}/emoji/${name}.png`; // Misskeyの絵文字URL形式

    // エラーハンドリングや存在しない絵文字の考慮は、必要に応じて追加
    return `<img src="${emojiUrl}" alt=":${name}:" class="emoji" />`;
  });
}

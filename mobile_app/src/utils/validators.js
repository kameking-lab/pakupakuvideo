/**
 * URL検証・ファイル名の安全化・サイズ表示のユーティリティ
 */

/**
 * 有効なURLかどうかを判定する（http/https のみ）
 * @param {string} url
 * @returns {boolean}
 */
export function validateUrl(url) {
  const s = (url || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** ファイル名に使えない文字（Windows/汎用） */
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * ファイル名として不正な文字を除去・置換する
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  const s = (name || '').trim();
  if (!s) return 'video';
  const base = s.includes('/') || s.includes('\\') ? s.replace(/^.*[/\\]/, '') : s;
  const safe = base.replace(INVALID_FILENAME_CHARS, '_').replace(/_+/g, '_').trim();
  const trimmed = safe.replace(/^[\s_]+|[\s_]+$/g, '');
  return trimmed || 'video';
}

/**
 * バイト数を人間が読みやすいサイズ表記に変換する
 * @param {number | null | undefined} sizeBytes
 * @returns {string}
 */
export function formatSize(sizeBytes) {
  if (sizeBytes == null) return '不明';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

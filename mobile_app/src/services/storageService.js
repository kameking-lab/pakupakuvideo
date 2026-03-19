/**
 * 履歴・お気に入りのローカル保存（AsyncStorage）
 * 項目: { id, title, url, createdAt }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_HISTORY = '@pakupakuvideo/history';
const KEY_FAVORITES = '@pakupakuvideo/favorites';
const MAX_HISTORY = 200;

/**
 * 履歴を取得する
 * @returns {Promise<Array<{ id: string, title: string, url: string, createdAt: number }>>}
 */
export async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY_HISTORY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * 履歴に1件追加する（重複は先頭に移動、最大件数で古いものを削除）
 * @param {{ title: string, url: string }} item
 */
export async function addHistory(item) {
  const list = await getHistory();
  const trimmed = { title: (item.title || '').trim() || item.url, url: (item.url || '').trim() };
  if (!trimmed.url) return;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newItem = { id, title: trimmed.title, url: trimmed.url, createdAt: Date.now() };
  const filtered = list.filter((x) => x.url !== trimmed.url);
  const next = [newItem, ...filtered].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(next));
}

/**
 * 履歴から1件削除する
 * @param {string} id
 */
export async function removeHistoryItem(id) {
  const list = await getHistory();
  const next = list.filter((x) => x.id !== id);
  await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(next));
}

/**
 * 履歴をすべて削除する
 */
export async function clearHistory() {
  await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify([]));
}

/**
 * お気に入りを取得する
 * @returns {Promise<Array<{ id: string, title: string, url: string, createdAt: number }>>}
 */
export async function getFavorites() {
  try {
    const raw = await AsyncStorage.getItem(KEY_FAVORITES);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * お気に入りに追加する（同じURLは上書き）
 * @param {{ title: string, url: string }} item
 */
export async function addFavorite(item) {
  const list = await getFavorites();
  const trimmed = { title: (item.title || '').trim() || item.url, url: (item.url || '').trim() };
  if (!trimmed.url) return false;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newItem = { id, title: trimmed.title, url: trimmed.url, createdAt: Date.now() };
  const filtered = list.filter((x) => x.url !== trimmed.url);
  await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify([newItem, ...filtered]));
  return true;
}

/**
 * お気に入りから削除する（URLで判定）
 * @param {string} url
 */
export async function removeFavoriteByUrl(url) {
  const list = await getFavorites();
  const next = list.filter((x) => x.url !== url);
  await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify(next));
}

/**
 * お気に入りに含まれるか
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isFavorite(url) {
  const list = await getFavorites();
  return list.some((x) => x.url === url);
}

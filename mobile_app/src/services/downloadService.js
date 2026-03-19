/**
 * 動画の取得・保存（通常DL + HLS/m3u8 の FFmpeg 結合・mp4 変換）
 * 保存先はアプリ内（documentDirectory/saved_videos/）のみ。
 * SDK 54 の非推奨警告を避けるため expo-file-system/legacy を使用。
 * HLS は ffmpeg-kit-react-native で -i URL -c copy 出力.mp4
 */

import * as FileSystem from 'expo-file-system/legacy';

const REQUEST_TIMEOUT_MS = 30000;
const VIDEO_CONTENT_TYPE_PREFIX = 'video/';
/** HLS 進捗用：総時間が取れない場合の仮の最大時間（ミリ秒） */
const DEFAULT_HLS_DURATION_MS = 600000;

/** 保存先フォルダ名（documentDirectory 直下） */
export const SAVED_VIDEOS_FOLDER = 'saved_videos';

/**
 * 保存済み動画用ディレクトリのフルパス
 * @returns {string}
 */
export function getSavedVideosDir() {
  return `${FileSystem.documentDirectory}${SAVED_VIDEOS_FOLDER}/`;
}

/**
 * 保存済み動画フォルダが無ければ作成する
 */
export async function ensureSavedVideosDir() {
  const dir = getSavedVideosDir();
  const info = await FileSystem.getInfoAsync(dir, { create: false });
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/**
 * ストリーミング（HLS/m3u8）かどうか
 * @param {string} url
 * @returns {boolean}
 */
export function isStreamingUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  return path.includes('.m3u8') || path.includes('m3u8');
}

/**
 * Content-Type が video/* かどうか
 */
export function isVideoContentType(contentType) {
  if (!contentType || !contentType.trim()) return false;
  return contentType.trim().toLowerCase().startsWith(VIDEO_CONTENT_TYPE_PREFIX);
}

/**
 * HEADリクエストで Content-Type と Content-Length を取得する
 */
export async function getContentInfo(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'PakupakuVideo/1.0' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentTypeRaw = res.headers.get('content-type');
    const contentType = contentTypeRaw ? contentTypeRaw.split(';')[0].trim().toLowerCase() : null;
    const cl = res.headers.get('content-length');
    const contentLength = cl != null ? parseInt(cl, 10) : null;
    return { contentType, contentLength, finalUrl: res.url };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return { contentType: null, contentLength: null, finalUrl: null };
    try {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'PakupakuVideo/1.0', Range: 'bytes=0-0' },
      });
      const contentTypeRaw = getRes.headers.get('content-type');
      const contentType = contentTypeRaw ? contentTypeRaw.split(';')[0].trim().toLowerCase() : null;
      const cl = getRes.headers.get('content-length');
      const contentLength = cl != null ? parseInt(cl, 10) : null;
      return { contentType, contentLength, finalUrl: getRes.url };
    } catch {
      return { contentType: null, contentLength: null, finalUrl: null };
    }
  }
}

/**
 * 通常の動画（mp4 等）を createDownloadResumable でダウンロードし、進捗をコールバックする
 * @param {string} url
 * @param {string} fileUri
 * @param {(p: number) => void} onProgress 0〜1
 * @returns {{ downloadResumable: import('expo-file-system').DownloadResumable, promise: Promise<{ success: boolean, message: string, localUri?: string }> }}
 */
export function createVideoDownload(url, fileUri, onProgress) {
  const callback = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    const p = totalBytesExpectedToWrite > 0
      ? Math.min(1, totalBytesWritten / totalBytesExpectedToWrite)
      : 0.5;
    onProgress(p);
  };
  const downloadResumable = FileSystem.createDownloadResumable(url, fileUri, {}, callback);
  const promise = (async () => {
    try {
      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) return { success: false, message: 'ダウンロードに失敗しました。' };
      return { success: true, message: 'アプリ内に保存しました。', localUri: result.uri };
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('cancel') || msg.includes('abort')) return { success: false, message: 'ユーザーによりキャンセルされました。' };
      return { success: false, message: `エラー: ${msg}` };
    }
  })();
  return { downloadResumable, promise };
}

/**
 * HLS/m3u8 を FFmpeg で結合・mp4 として保存する
 * FFmpegKit が利用できない環境（Expo Go 等）ではエラーを返す
 * @param {string} url m3u8 の URL
 * @param {string} fileUri 出力ファイル URI（.mp4）
 * @param {(p: number, phase?: string) => void} onProgress 0〜1、phase: 'connecting' | 'converting'
 * @returns {{ promise: Promise<{ success: boolean, message: string, localUri?: string }> }}
 */
export function createHlsDownload(url, fileUri, onProgress) {
  const promise = (async () => {
    let FFmpegKit;
    let FFmpegKitConfig;
    let ReturnCode;
    try {
      FFmpegKit = require('ffmpeg-kit-react-native').FFmpegKit;
      FFmpegKitConfig = require('ffmpeg-kit-react-native').FFmpegKitConfig;
      ReturnCode = require('ffmpeg-kit-react-native').ReturnCode;
    } catch (e) {
      return {
        success: false,
        message: 'HLS の結合にはネイティブビルド（EAS Build）が必要です。Expo Go では利用できません。',
      };
    }

    onProgress(0, 'connecting');

    const args = [
      '-i', url,
      '-c', 'copy',
      '-y',
      fileUri,
    ];

    let statisticsCallbackId;
    const durationMs = DEFAULT_HLS_DURATION_MS;
    try {
      statisticsCallbackId = FFmpegKitConfig.enableStatisticsCallback((statistics) => {
        try {
          const time = statistics.getTime();
          if (time > 0) {
            const p = Math.min(0.95, (time / durationMs));
            onProgress(p, 'converting');
          }
        } catch (_) {}
      });
    } catch (_) {}

    try {
      const session = await FFmpegKit.executeWithArguments(args);
      if (statisticsCallbackId != null) {
        try { FFmpegKitConfig.disableStatisticsCallback(statisticsCallbackId); } catch (_) {}
      }
      onProgress(1, 'converting');
      const returnCode = await session.getReturnCode();
      if (ReturnCode.isSuccess(returnCode)) {
        return { success: true, message: 'HLS を結合して mp4 で保存しました。', localUri: fileUri };
      }
      const logs = await session.getLogs();
      const last = logs && logs.length > 0 ? logs[logs.length - 1] : null;
      const errMsg = last ? last.getMessage() : `FFmpeg 終了コード: ${returnCode}`;
      return { success: false, message: `変換エラー: ${errMsg}` };
    } catch (e) {
      if (statisticsCallbackId != null) {
        try { FFmpegKitConfig.disableStatisticsCallback(statisticsCallbackId); } catch (_) {}
      }
      const msg = e?.message || String(e);
      return { success: false, message: `FFmpeg エラー: ${msg}` };
    }
  })();
  return { promise };
}

/**
 * ブラウザタブ：WebView + URLバー + 動画検知FAB → モーダルで一覧表示・選択DL
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  getContentInfo,
  isVideoContentType,
  isStreamingUrl,
  createVideoDownload,
  createHlsDownload,
  getSavedVideosDir,
  ensureSavedVideosDir,
} from '../services/downloadService';
import { addFavorite, isFavorite, removeFavoriteByUrl } from '../services/storageService';
import { addHistory } from '../services/storageService';
import { sanitizeFilename } from '../utils/validators';
import { injectedVideoDetectionScript } from '../utils/videoDetection';

const DEFAULT_HOME = 'https://www.google.com';

/** URLから表示用ラベル（ドメイン + パス末尾）を生成 */
function getVideoLabel(url) {
  if (!url || typeof url !== 'string') return url || '';
  try {
    if (url.startsWith('blob:')) return 'blob（再生のみ）';
    if (url.startsWith('mse:')) return 'MSE（ストリーム・HLS/DASH等）';
    const u = new URL(url);
    const path = u.pathname || '';
    const tail = path.split('/').filter(Boolean).pop() || path.slice(-36) || path;
    const domain = u.hostname || '';
    return domain + ' ... ' + (tail.length > 32 ? tail.slice(-32) : tail);
  } catch {
    return url.length > 48 ? url.slice(-48) : url;
  }
}

/** 検知ソース・URLから「通常動画」か「ストリーミング」かを判定 */
function isStreamingItem(item) {
  if (!item || typeof item !== 'object') return false;
  const { url, source } = item;
  if (isStreamingUrl(url)) return true;
  return source === 'mse' || source === 'network-content-type';
}

export default function BrowserScreen({ navigation, route }) {
  const [loadUri, setLoadUri] = useState(route.params?.url || DEFAULT_HOME);
  const [urlBar, setUrlBar] = useState(loadUri);
  const [currentUrl, setCurrentUrl] = useState(loadUri);
  const [title, setTitle] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectedVideos, setDetectedVideos] = useState([]); // [{ url, source }, ...]
  const [listModalVisible, setListModalVisible] = useState(false);
  const [isFavoritePage, setIsFavoritePage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadPhase, setDownloadPhase] = useState(''); // 'downloading' | 'converting' | ''
  const webRef = useRef(null);
  const downloadResumableRef = useRef(null);

  useEffect(() => {
    const paramUrl = route.params?.url;
    if (paramUrl && paramUrl.startsWith('http')) {
      setLoadUri(paramUrl);
      setUrlBar(paramUrl);
      setCurrentUrl(paramUrl);
      setDetectedVideos([]);
    }
  }, [route.params?.url]);

  const refreshFavoriteStatus = useCallback(async (url) => {
    const fav = await isFavorite(url || currentUrl);
    setIsFavoritePage(fav);
  }, [currentUrl]);

  const handleNavigationStateChange = useCallback(
    (navState) => {
      const u = navState.url || currentUrl;
      const t = navState.title || '';
      setCurrentUrl(u);
      setUrlBar(u);
      setTitle(t);
      setCanGoBack(navState.canGoBack);
      setCanGoForward(navState.canGoForward);
      if (u && u.startsWith('http')) {
        addHistory({ title: t, url: u });
        refreshFavoriteStatus(u);
      }
      setDetectedVideos([]);
    },
    [currentUrl, refreshFavoriteStatus]
  );

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleLoadStart = useCallback(() => setLoading(true), []);

  const handleMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type !== 'videos' || !Array.isArray(data.urls)) return;
        const source = data.source || 'dom';
        const base = currentUrl || urlBar;
        const resolve = (u) => {
          if (!u) return null;
          if (/^https?:/i.test(u) || /^blob:/.test(u) || /^mse:/.test(u)) return u;
          try {
            return new URL(u, base).href;
          } catch {
            return u;
          }
        };
        const resolved = data.urls.map(resolve).filter(Boolean);
        const logBySource = {
          dom: () => console.log('[動画検知][DOM] DOMスキャン/MutationObserver:', resolved.length, '件'),
          setter: () => console.log('[動画検知][Setter] HTMLMediaElement.src 代入:', resolved.length, '件', resolved[0] || ''),
          play: () => console.log('[動画検知][Play] video.play() 実行時:', resolved.length, '件', resolved[0] || ''),
          load: () => console.log('[動画検知][Load] video.load() 実行時:', resolved.length, '件', resolved[0] || ''),
          createelement: () => console.log('[動画検知][createElement] createElement(video/source) 生成要素:', resolved.length, '件', resolved[0] || ''),
          mse: () => console.log('[動画検知][MSE] MediaSource/SourceBuffer (HLS/DASH等):', resolved.length, '件', resolved[0] || ''),
          network: () => console.log('[動画検知][Network] Fetch/XHR 拡張子一致:', resolved.length, '件', resolved[0] || ''),
          'network-content-type': () => console.log('[動画検知][Network-CT] Content-Type video/* or mpegurl:', resolved.length, '件', resolved[0] || ''),
          blob: () => console.log('[動画検知][Blob] createObjectURL(video):', resolved.length, '件', resolved[0] || ''),
        };
        if (logBySource[source]) logBySource[source]();
        else console.log('[動画検知] 検知:', resolved.length, '件 (source:', source, ')', resolved[0] || '');
        const newEntries = resolved.map((u) => ({ url: u, source }));
        setDetectedVideos((prev) => {
          const byUrl = new Map(prev.map((e) => [e.url, e]));
          newEntries.forEach((e) => byUrl.set(e.url, e));
          return Array.from(byUrl.values());
        });
      } catch (_) {}
    },
    [currentUrl, urlBar]
  );

  const goToUrl = useCallback(() => {
    const u = urlBar.trim();
    if (!u) return;
    let target = u;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    setUrlBar(target);
    setCurrentUrl(target);
    setDetectedVideos([]);
    if (webRef.current) webRef.current.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
  }, [urlBar]);

  const toggleFavorite = useCallback(async () => {
    const u = currentUrl || urlBar;
    if (!u || !u.startsWith('http')) return;
    if (isFavoritePage) {
      await removeFavoriteByUrl(u);
      setIsFavoritePage(false);
      Alert.alert('お気に入り', 'お気に入りから削除しました。');
    } else {
      await addFavorite({ title: title || u, url: u });
      setIsFavoritePage(true);
      Alert.alert('お気に入り', 'お気に入りに追加しました。');
    }
  }, [currentUrl, urlBar, title, isFavoritePage]);

  const handleDownloadVideo = useCallback(
    async (item) => {
      if (downloading) return;
      const videoUrl = typeof item === 'string' ? item : item?.url;
      const source = typeof item === 'object' ? item?.source : undefined;
      if (!videoUrl) return;
      if (videoUrl.startsWith('blob:') || videoUrl.startsWith('mse:')) {
        Alert.alert('注意', 'この形式の動画はダウンロードできません。');
        return;
      }
      if (!/^https?:/i.test(videoUrl)) {
        Alert.alert('エラー', '有効な動画URLではありません。');
        return;
      }
      const useFfmpeg = isStreamingUrl(videoUrl) || source === 'mse' || source === 'network-content-type';
      await ensureSavedVideosDir();
      const baseName = sanitizeFilename(videoUrl.split('/').pop() || 'video');
      const filename = useFfmpeg ? `${baseName.replace(/\.m3u8$/i, '')}.mp4` : (baseName.includes('.') ? baseName : `${baseName}.mp4`);
      const fileUri = `${getSavedVideosDir()}${filename}`;
      setDownloading(true);
      setDownloadProgress(0);
      setDownloadPhase(useFfmpeg ? 'connecting' : 'downloading');

      if (useFfmpeg) {
        const { promise } = createHlsDownload(
          videoUrl,
          fileUri,
          (p, phase) => {
            setDownloadProgress(p);
            setDownloadPhase(phase || 'converting');
          }
        );
        const result = await promise;
        setDownloading(false);
        setDownloadPhase('');
        if (result.success) {
          setListModalVisible(false);
          Alert.alert('完了', result.message);
        } else {
          Alert.alert('エラー', result.message);
        }
        return;
      }

      const info = await getContentInfo(videoUrl);
      if (!isVideoContentType(info.contentType)) {
        setDownloading(false);
        setDownloadPhase('');
        Alert.alert('エラー', 'このURLは動画（video/*）ではありません。');
        return;
      }
      const { downloadResumable, promise } = createVideoDownload(
        info.finalUrl || videoUrl,
        fileUri,
        (p) => {
          setDownloadProgress(p);
          setDownloadPhase('downloading');
        }
      );
      downloadResumableRef.current = downloadResumable;
      const result = await promise;
      downloadResumableRef.current = null;
      setDownloading(false);
      setDownloadPhase('');
      if (result.success) {
        setListModalVisible(false);
        Alert.alert('完了', result.message);
      } else {
        Alert.alert('エラー', result.message);
      }
    },
    [downloading]
  );

  const renderVideoItem = useCallback(
    ({ item }) => {
      const streaming = isStreamingItem(item);
      const label = getVideoLabel(item.url);
      return (
        <TouchableOpacity
          style={styles.videoRow}
          onPress={() => handleDownloadVideo(item)}
          disabled={downloading}
          activeOpacity={0.7}
        >
          <View style={styles.videoRowLeft}>
            <View style={styles.badgeWrap}>
              <View style={[styles.badge, streaming ? styles.badgeHls : styles.badgeMp4]}>
                <Text style={styles.badgeText}>{streaming ? 'HLS' : 'MP4'}</Text>
              </View>
            </View>
            <Text style={styles.videoRowLabel} numberOfLines={2}>{label}</Text>
          </View>
          <Text style={styles.videoRowAction}>{downloading ? '...' : 'DL'}</Text>
        </TouchableOpacity>
      );
    },
    [handleDownloadVideo, downloading]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, !canGoBack && styles.toolBtnDisabled]}
          onPress={() => webRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <Text style={styles.toolBtnText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, !canGoForward && styles.toolBtnDisabled]}
          onPress={() => webRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <Text style={styles.toolBtnText}>→</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.urlInput}
          value={urlBar}
          onChangeText={setUrlBar}
          onSubmitEditing={goToUrl}
          placeholder="URLを入力"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity style={styles.toolBtn} onPress={() => webRef.current?.reload()}>
          <Text style={styles.toolBtnText}>↻</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, isFavoritePage && styles.toolBtnActive]}
          onPress={toggleFavorite}
        >
          <Text style={styles.toolBtnText}>{isFavoritePage ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#0a7ea4" />
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: loadUri }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        injectedJavaScript={injectedVideoDetectionScript}
        injectedJavaScriptForMainFrameOnly={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        originWhitelist={['*']}
        mixedContentMode="compatibility"
      />
      {detectedVideos.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setListModalVisible(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>{detectedVideos.length}件の動画を検知</Text>
        </TouchableOpacity>
      )}
      <Modal
        visible={listModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>検知した動画</Text>
              <TouchableOpacity onPress={() => setListModalVisible(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={detectedVideos}
              keyExtractor={(item, i) => (item?.url || '') + String(i)}
              renderItem={renderVideoItem}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>
      {downloading && (
        <View style={styles.downloadOverlay}>
          <ActivityIndicator size="large" color="#fff" style={styles.downloadSpinner} />
          <Text style={styles.downloadText}>
            {downloadPhase === 'converting' || downloadPhase === 'connecting'
              ? '結合・変換中…'
              : 'ダウンロード中…'}
            {' '}
            {Math.round(downloadProgress * 100)}%
          </Text>
          <View style={styles.downloadBarBg}>
            <View style={[styles.downloadBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  toolBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  toolBtnDisabled: { opacity: 0.4 },
  toolBtnActive: { backgroundColor: '#ffe066', borderRadius: 4 },
  toolBtnText: { fontSize: 18 },
  urlInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  loadingBar: { paddingVertical: 4, alignItems: 'center', backgroundColor: '#f0f0f0' },
  webview: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  modalClose: { paddingVertical: 8, paddingHorizontal: 12 },
  modalCloseText: { color: '#0a7ea4', fontSize: 16 },
  modalList: { padding: 12, paddingBottom: 24 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  videoRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  badgeWrap: { marginRight: 8 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMp4: { backgroundColor: '#0a7ea4' },
  badgeHls: { backgroundColor: '#e65100' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  videoRowLabel: { flex: 1, fontSize: 13, color: '#333' },
  videoRowAction: { color: '#0a7ea4', fontWeight: '600', fontSize: 14 },
  downloadOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  downloadSpinner: { marginBottom: 8 },
  downloadText: { color: '#fff', fontSize: 15, fontWeight: '500', marginBottom: 8 },
  downloadBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  downloadBarFill: {
    height: '100%',
    backgroundColor: '#4fc3f7',
    borderRadius: 3,
  },
});

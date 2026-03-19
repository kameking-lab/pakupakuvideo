/**
 * 保存済みタブ：アプリ内に保存した動画一覧。タップで再生、削除ボタン
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { getSavedVideosDir, ensureSavedVideosDir } from '../services/downloadService';

export default function DownloadsScreen({ navigation }) {
  const [files, setFiles] = useState([]);

  const loadFiles = useCallback(async () => {
    await ensureSavedVideosDir();
    const dir = getSavedVideosDir();
    try {
      const list = await FileSystem.readDirectoryAsync(dir);
      const withUri = list
        .filter((name) => /\.(mp4|webm|mov|m4v|ogg)$/i.test(name))
        .map((name) => ({ name, uri: dir + name }));
      setFiles(withUri);
    } catch (e) {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadFiles);
    return unsubscribe;
  }, [navigation, loadFiles]);

  const handlePlay = useCallback(
    (item) => {
      navigation.navigate('VideoPlayer', { uri: item.uri, title: item.name });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (item) => {
      Alert.alert('削除', `「${item.name}」を削除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
              loadFiles();
            } catch (_) {
              Alert.alert('エラー', '削除に失敗しました。');
            }
          },
        },
      ]);
    },
    [loadFiles]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowContent} onPress={() => handlePlay(item)} activeOpacity={0.7}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteBtnText}>削除</Text>
        </TouchableOpacity>
      </View>
    ),
    [handlePlay, handleDelete]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>保存済み</Text>
      </View>
      {files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>保存した動画はまだありません</Text>
          <Text style={styles.emptySub}>ブラウザで動画を検知してDLボタンから保存</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.uri}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  list: { padding: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowContent: { flex: 1 },
  title: { fontSize: 16, color: '#333' },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: '#c00', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#999' },
});

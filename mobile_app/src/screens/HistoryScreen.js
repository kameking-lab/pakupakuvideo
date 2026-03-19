/**
 * 履歴タブ：閲覧履歴一覧。タップでブラウザで開く、削除・一括削除
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
import { clearHistory, getHistory, removeHistoryItem } from '../services/storageService';

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const list = await getHistory();
    setItems(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const handleItemPress = useCallback(
    (item) => {
      navigation.navigate('Browser', { url: item.url });
    },
    [navigation]
  );

  const handleRemoveItem = useCallback(
    (item) => {
      Alert.alert('削除', `「${item.title}」を履歴から削除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await removeHistoryItem(item.id);
            load();
          },
        },
      ]);
    },
    [load]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('履歴を削除', 'すべての履歴を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          load();
        },
      },
    ]);
  }, [load]);

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowContent}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || item.url}
          </Text>
          <Text style={styles.url} numberOfLines={1}>
            {item.url}
          </Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleRemoveItem(item)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.deleteBtnText}>削除</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleItemPress, handleRemoveItem]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>履歴</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>すべて削除</Text>
          </TouchableOpacity>
        )}
      </View>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>履歴はまだありません</Text>
          <Text style={styles.emptySub}>ブラウザでページを開くとここに表示されます</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  clearBtnText: { color: '#c00', fontSize: 14 },
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
  rowContent: { flex: 1, marginRight: 8 },
  title: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 2 },
  url: { fontSize: 12, color: '#666', marginBottom: 2 },
  date: { fontSize: 11, color: '#999' },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: '#c00', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#999' },
});

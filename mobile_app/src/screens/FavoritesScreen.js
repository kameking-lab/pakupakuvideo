/**
 * お気に入りタブ：ブックマーク一覧。タップでブラウザで開く、スワイプまたはボタンで削除
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
import { getFavorites, removeFavoriteByUrl } from '../services/storageService';

export default function FavoritesScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const list = await getFavorites();
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

  const handleRemove = useCallback(
    (item) => {
      Alert.alert('削除', `「${item.title}」をお気に入りから削除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await removeFavoriteByUrl(item.url);
            load();
          },
        },
      ]);
    },
    [load]
  );

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
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleRemove(item)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.deleteBtnText}>削除</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleItemPress, handleRemove]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>お気に入り</Text>
      </View>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>お気に入りはまだありません</Text>
          <Text style={styles.emptySub}>ブラウザで☆をタップして追加</Text>
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
  rowContent: { flex: 1, marginRight: 8 },
  title: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 2 },
  url: { fontSize: 12, color: '#666' },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: '#c00', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#999' },
});

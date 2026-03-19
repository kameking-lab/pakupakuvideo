/**
 * 保存済み動画のアプリ内再生（expo-av）
 */

import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';
import { TouchableOpacity } from 'react-native';
import { Text } from 'react-native';

export default function VideoPlayerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const uri = route.params?.uri;
  const videoRef = useRef(null);

  if (!uri) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>動画のURIがありません</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 戻る</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.videoWrapper}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.video}
          useNativeControls
          resizeMode="contain"
          isLooping={false}
          shouldPlay={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  backBtnText: { color: '#fff', fontSize: 16 },
  videoWrapper: { flex: 1 },
  video: { flex: 1, width: '100%' },
  error: { color: '#fff', padding: 24, fontSize: 16 },
});

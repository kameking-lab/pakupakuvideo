/**
 * 保存済みタブ用スタック：一覧 → 再生画面
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DownloadsScreen from '../screens/DownloadsScreen';
import VideoPlayerScreen from '../screens/VideoPlayerScreen';

const Stack = createNativeStackNavigator();

export default function DownloadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DownloadsList" component={DownloadsScreen} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
    </Stack.Navigator>
  );
}

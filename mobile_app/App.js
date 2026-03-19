/**
 * ぱくぱくビデオ - アプリ内ブラウザで動画をダウンロード
 * ボトムタブ: ブラウザ / お気に入り / 履歴
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppTabs from './src/navigation/AppTabs';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppTabs />
    </NavigationContainer>
  );
}

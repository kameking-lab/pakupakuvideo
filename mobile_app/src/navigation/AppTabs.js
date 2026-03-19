/**
 * ボトムタブナビゲーション：ブラウザ / お気に入り / 履歴 / 保存済み
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import BrowserScreen from '../screens/BrowserScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import HistoryScreen from '../screens/HistoryScreen';
import DownloadsStack from './DownloadsStack';

const Tab = createBottomTabNavigator();

const tabLabel = {
  Browser: 'ブラウザ',
  Favorites: 'お気に入り',
  History: '履歴',
  Downloads: '保存済み',
};

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: tabLabel[route.name] ?? route.name,
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#666',
      })}
    >
      <Tab.Screen
        name="Browser"
        component={BrowserScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🌐</Text> }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⭐</Text> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🕐</Text> }}
      />
      <Tab.Screen
        name="Downloads"
        component={DownloadsStack}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📥</Text> }}
      />
    </Tab.Navigator>
  );
}

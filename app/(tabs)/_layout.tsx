import React from 'react';
import { Tabs } from 'expo-router';
import { BookOpen, ScanBarcode, Search } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.textMuted,
        tabBarStyle: {
          backgroundColor: colors.light.surface,
          borderTopColor: colors.light.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi Librero',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size }) => <ScanBarcode size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

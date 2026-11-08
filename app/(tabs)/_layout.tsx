import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, BookOpen, ScanBarcode, Search, BarChart3 } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Mi Librero',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Escanear',
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              onLongPress={props.onLongPress}
              testID={props.testID}
              style={[props.style, styles.scanTabButton]}
              accessibilityRole="button"
              accessibilityLabel="Escanear libro con la camara"
            >
              <View style={styles.scanElevatedCircle}>
                <ScanBarcode size={24} color="#ffffff" strokeWidth={2.2} />
              </View>
              <Text style={styles.scanTabLabel}>Escanear</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Metas y Stats',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.light.surface,
    borderTopColor: colors.light.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scanTabButton: {
    justifyContent: 'center',
    alignItems: 'center',
    top: -12,
  },
  scanElevatedCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  scanTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginTop: 3,
  },
});

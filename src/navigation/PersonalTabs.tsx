import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '../theme';
import { PersonalTabParamList } from './types';
import { NearbyScreen } from '../screens/personal/NearbyScreen';
import { SearchScreen } from '../screens/personal/SearchScreen';
import { CreatePostScreen } from '../screens/personal/CreatePostScreen';
import { ActivityScreen } from '../screens/personal/ActivityScreen';
import { ProfileScreen } from '../screens/personal/ProfileScreen';

const Tab = createBottomTabNavigator<PersonalTabParamList>();

const GLYPHS: Record<keyof PersonalTabParamList, string> = {
  Nearby: '◎',
  Search: '⌕',
  CreatePost: '+',
  Activity: '◔',
  Profile: '◍',
};

function screenOptions({ route }: { route: { name: keyof PersonalTabParamList } }) {
  return {
    headerShown: false,
    tabBarStyle: styles.bar,
    tabBarActiveTintColor: colors.clay,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '400' }]}>
        {route.name === 'CreatePost' ? 'Create' : route.name}
      </Text>
    ),
    tabBarIcon: ({ color }: { color: string }) => (
      <Text style={[styles.icon, { color }]}>{GLYPHS[route.name]}</Text>
    ),
  };
}

export function PersonalTabs() {
  const { messages, notifications } = useUnreadCounts();
  const total = messages + notifications;
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="CreatePost" component={CreatePostScreen} />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarBadge: total > 0 ? total : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.clay },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 28,
    height: 68,
    paddingTop: 8,
    paddingBottom: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { ...typography.caption, fontSize: 9 },
  icon: { fontSize: 20 },
});

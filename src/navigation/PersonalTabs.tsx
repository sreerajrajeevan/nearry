import React from 'react';
import { Text, StyleSheet } from 'react-native';
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
    tabBarActiveTintColor: colors.red,
    tabBarInactiveTintColor: colors.textFaint,
    tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '400' }]}>
        {route.name === 'CreatePost' ? 'POST' : route.name.toUpperCase()}
      </Text>
    ),
    tabBarIcon: ({ color }: { color: string }) => (
      <Text style={[styles.icon, { color }]}>{GLYPHS[route.name]}</Text>
    ),
  };
}

export function PersonalTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="CreatePost" component={CreatePostScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.black,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingTop: 6,
  },
  label: { ...typography.caption, fontSize: 9 },
  icon: { fontSize: 20 },
});

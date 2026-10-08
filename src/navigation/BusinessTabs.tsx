import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '../theme';
import { BusinessTabParamList } from './types';
import { DashboardScreen } from '../screens/business/DashboardScreen';
import { CreateOfferScreen } from '../screens/business/CreateOfferScreen';
import { BookingsScreen } from '../screens/business/BookingsScreen';
import { MessagesScreen } from '../screens/business/MessagesScreen';
import { BusinessProfileScreen } from '../screens/business/BusinessProfileScreen';

const Tab = createBottomTabNavigator<BusinessTabParamList>();

const GLYPHS: Record<keyof BusinessTabParamList, string> = {
  Dashboard: '▦',
  CreateOffer: '+',
  Bookings: '▤',
  Messages: '✉',
  Business: '◍',
};

const LABELS: Record<keyof BusinessTabParamList, string> = {
  Dashboard: 'DASHBOARD',
  CreateOffer: 'OFFER',
  Bookings: 'BOOKINGS',
  Messages: 'MESSAGES',
  Business: 'BUSINESS',
};

function screenOptions({ route }: { route: { name: keyof BusinessTabParamList } }) {
  return {
    headerShown: false,
    tabBarStyle: styles.bar,
    tabBarActiveTintColor: colors.red,
    tabBarInactiveTintColor: colors.textFaint,
    tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '400' }]}>
        {LABELS[route.name]}
      </Text>
    ),
    tabBarIcon: ({ color }: { color: string }) => (
      <Text style={[styles.icon, { color }]}>{GLYPHS[route.name]}</Text>
    ),
  };
}

export function BusinessTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="CreateOffer" component={CreateOfferScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Business" component={BusinessProfileScreen} />
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

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
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
  Dashboard: 'Dashboard',
  CreateOffer: 'Create Offer',
  Bookings: 'Bookings',
  Messages: 'Messages',
  Business: 'Business',
};

function screenOptions({ route }: { route: { name: keyof BusinessTabParamList } }) {
  return {
    headerShown: false,
    tabBarStyle: styles.bar,
    tabBarActiveTintColor: colors.clay,
    tabBarInactiveTintColor: colors.muted,
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
  const { messages } = useUnreadCounts();
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="CreateOffer" component={CreateOfferScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarBadge: messages > 0 ? messages : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.clay },
        }}
      />
      <Tab.Screen name="Business" component={BusinessProfileScreen} />
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
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { ...typography.caption, fontSize: 9 },
  icon: { fontSize: 20 },
});

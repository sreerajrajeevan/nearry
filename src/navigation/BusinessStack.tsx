import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { BusinessStackParamList } from './types';
import { BusinessTabs } from './BusinessTabs';
import { ConversationScreen } from '../screens/chat/ConversationScreen';
import { NotificationCenterScreen } from '../screens/NotificationCenterScreen';

const Stack = createNativeStackNavigator<BusinessStackParamList>();

/** Business experience: tab bar + pushable chat/notification screens above it. */
export function BusinessStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { PersonalStackParamList } from './types';
import { PersonalTabs } from './PersonalTabs';
import { PostDetailsScreen } from '../screens/personal/PostDetailsScreen';
import { VenueDetailsScreen } from '../screens/personal/VenueDetailsScreen';
import { EditPostScreen } from '../screens/personal/EditPostScreen';

const Stack = createNativeStackNavigator<PersonalStackParamList>();

/** Personal experience: tab bar + pushable detail screens above it. */
export function PersonalStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="PersonalTabs" component={PersonalTabs} />
      <Stack.Screen name="PostDetails" component={PostDetailsScreen} />
      <Stack.Screen name="VenueDetails" component={VenueDetailsScreen} />
      <Stack.Screen name="EditPost" component={EditPostScreen} />
    </Stack.Navigator>
  );
}

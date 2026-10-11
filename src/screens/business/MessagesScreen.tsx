import React from 'react';
import { ChatListScreen } from '../chat/ChatListScreen';

type Props = {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void };
};

/** Business Messages tab — real chat list. Tapping opens the conversation above the tabs. */
export function MessagesScreen({ navigation }: Props) {
  return <ChatListScreen navigation={navigation} />;
}

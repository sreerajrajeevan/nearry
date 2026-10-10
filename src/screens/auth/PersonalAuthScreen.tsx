import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthScreen } from './AuthScreen';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAuth'>;

/** Personal lane auth — thin wrapper over the shared OTP flow. */
export function PersonalAuthScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'login';
  return (
    <AuthScreen
      accountType="personal"
      kicker="PERSONAL"
      mode={mode}
      onSwitchMode={() => navigation.setParams({ mode: mode === 'login' ? 'signup' : 'login' })}
    />
  );
}

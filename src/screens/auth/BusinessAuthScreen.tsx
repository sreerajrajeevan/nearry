import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthScreen } from './AuthScreen';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessAuth'>;

/** Business lane auth — thin wrapper over the shared OTP flow. */
export function BusinessAuthScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'login';
  return (
    <AuthScreen
      accountType="business"
      kicker="BUSINESS"
      mode={mode}
      onSwitchMode={() => navigation.setParams({ mode: mode === 'login' ? 'signup' : 'login' })}
    />
  );
}

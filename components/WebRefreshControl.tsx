import React from 'react';
import { Platform, RefreshControl, RefreshControlProps } from 'react-native';

export default function WebRefreshControl(props: RefreshControlProps) {
  if (Platform.OS === 'web') {
    return null;
  }
  return <RefreshControl {...props} />;
}

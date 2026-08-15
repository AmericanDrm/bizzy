import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { useTheme } from '@/contexts/ThemeContext';
import WalkthroughSpotlight from './WalkthroughSpotlight';
import WalkthroughTooltip from './WalkthroughTooltip';

export default function AppWalkthrough() {
  const { isActive } = useWalkthrough();
  const { colors } = useTheme();

  if (!isActive) {
    return null;
  }

  return (
    <Modal visible={isActive} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        <WalkthroughSpotlight />
        <WalkthroughTooltip />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

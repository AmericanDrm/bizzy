import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useWalkthrough } from '@/contexts/WalkthroughContext';

export default function WalkthroughSpotlight() {
  const { currentStep } = useWalkthrough();

  if (!currentStep || currentStep.showSpotlight === false) {
    return <View style={styles.overlay} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
});

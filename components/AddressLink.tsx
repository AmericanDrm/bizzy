import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { openAddressInMaps } from '@/lib/mapsIntegrationService';

interface AddressLinkProps {
  address: string;
  textStyle?: TextStyle;
  style?: ViewStyle;
  numberOfLines?: number;
}

export default function AddressLink({ address, textStyle, style, numberOfLines }: AddressLinkProps) {
  return (
    <TouchableOpacity
      onPress={() => openAddressInMaps(address)}
      style={[styles.container, style]}
      activeOpacity={0.6}
    >
      <Text style={[styles.text, textStyle]} numberOfLines={numberOfLines}>
        {address}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  text: {
    textDecorationLine: 'underline',
  },
});

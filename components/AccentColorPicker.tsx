import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ACCENT_COLOR_PRESETS, accentLightFromAccent } from '@/lib/documentTemplateTypes';

interface AccentColorPickerProps {
  value: string;
  onChange: (accent: string, accentLight: string) => void;
}

export default function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const { colors } = useTheme();
  const [customHex, setCustomHex] = useState('');

  const handlePreset = (hex: string) => {
    onChange(hex, accentLightFromAccent(hex));
  };

  const handleCustomHex = (text: string) => {
    setCustomHex(text);
    const clean = text.startsWith('#') ? text : '#' + text;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean, accentLightFromAccent(clean));
    }
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Accent Color</Text>
      <View style={styles.presets}>
        {ACCENT_COLOR_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.color}
            style={[
              styles.swatch,
              { backgroundColor: preset.color },
              value === preset.color && styles.swatchSelected,
            ]}
            onPress={() => handlePreset(preset.color)}
          />
        ))}
      </View>
      <View style={styles.customRow}>
        <View style={[styles.previewSwatch, { backgroundColor: value }]} />
        <TextInput
          style={[styles.hexInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          value={customHex || value}
          onChangeText={handleCustomHex}
          placeholder="#1a3c5e"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          maxLength={7}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewSwatch: { width: 36, height: 36, borderRadius: 8 },
  hexInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
});

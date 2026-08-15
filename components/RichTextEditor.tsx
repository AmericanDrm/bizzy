import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Enter text...', minHeight = 120 }: RichTextEditorProps) {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
        <TextInput
          style={[styles.textArea, { color: colors.text, minHeight }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
      <TextInput
        style={[styles.textArea, { color: colors.text, minHeight }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  textArea: { padding: 12, fontSize: 14, lineHeight: 20 },
});

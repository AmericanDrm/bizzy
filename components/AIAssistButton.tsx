import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { generateLocalAIText } from '@/lib/localAIService';

interface AIAssistButtonProps {
  type: 'job_description' | 'included_items' | 'notes' | 'materials' | 'disclaimers' | 'estimate_notes' | 'invoice_summary' | 'client_message' | 'email_subject' | 'email_body';
  onGenerate: (text: string) => void;
  context?: Record<string, any>;
  jobTypeName?: string;
  existingContent?: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}

export default function AIAssistButton({
  type,
  onGenerate,
  context = {},
  jobTypeName,
  existingContent,
  label,
  compact = false,
  disabled = false,
}: AIAssistButtonProps) {
  const { colors } = useTheme();
  const [generating, setGenerating] = useState(false);

  const defaultLabels: Record<string, string> = {
    job_description: 'AI Generate',
    included_items: 'AI Suggest',
    notes: 'AI Draft',
    materials: 'AI Suggest',
    disclaimers: 'AI Generate',
    estimate_notes: 'AI Draft',
    invoice_summary: 'AI Summarize',
    client_message: 'AI Draft',
    email_subject: 'AI Suggest',
    email_body: 'AI Draft',
  };

  const handleGenerate = async () => {
    if (generating || disabled) return;

    setGenerating(true);
    try {
      const generatedText = await generateLocalAIText(type, {
        context,
        jobTypeName,
        existingContent,
      });

      onGenerate(generatedText);
    } catch (error) {
      console.error('AI generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactButton,
          { borderColor: colors.primary },
          disabled && styles.disabled,
        ]}
        onPress={handleGenerate}
        disabled={generating || disabled}
      >
        {generating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Sparkles size={14} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.primaryLight, borderColor: colors.primary },
        disabled && styles.disabled,
      ]}
      onPress={handleGenerate}
      disabled={generating || disabled}
    >
      {generating ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Sparkles size={16} color={colors.primary} />
      )}
      <Text style={[styles.buttonText, { color: colors.primary }]}>
        {label || defaultLabels[type] || 'AI Assist'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  compactButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

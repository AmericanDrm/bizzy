import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  MapPin,
  Coffee,
  ShoppingCart,
  AlertCircle,
  X,
  Play,
  CheckCircle,
  PlusCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface LocationContextPrompt {
  type: 'near_job' | 'unknown_location' | 'new_location';
  latitude: number;
  longitude: number;
  address?: string;
  nearbyJob?: {
    id: string;
    clientName: string;
    distance: number;
    isScheduled?: boolean;
    scheduledStartTime?: string;
  };
  durationMinutes: number;
}

interface LocationContextModalProps {
  visible: boolean;
  prompt: LocationContextPrompt | null;
  onDismiss: () => void;
  onStartWork?: (jobId: string) => void;
  onSetContext?: (context: 'on_break' | 'getting_supplies' | 'job_site' | 'stuck') => void;
  onAddJobSite?: (address: string, latitude: number, longitude: number) => void;
}

export default function LocationContextModal({
  visible,
  prompt,
  onDismiss,
  onStartWork,
  onSetContext,
  onAddJobSite,
}: LocationContextModalProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  if (!prompt) return null;

  const handleAction = async (action: () => void | Promise<void>) => {
    setLoading(true);
    try {
      await action();
      onDismiss();
    } finally {
      setLoading(false);
    }
  };

  const renderNearJobPrompt = () => {
    if (!prompt.nearbyJob) return null;
    const { isScheduled, clientName, distance, id, scheduledStartTime } = prompt.nearbyJob;

    if (isScheduled) {
      return (
        <View style={dynamicStyles.content}>
          <View style={dynamicStyles.iconContainer}>
            <MapPin size={48} color={colors.primary} />
          </View>

          <Text style={dynamicStyles.title}>You've arrived!</Text>
          <Text style={dynamicStyles.subtitle}>
            {clientName} is scheduled{scheduledStartTime ? ` at ${scheduledStartTime}` : ' for today'} — {Math.round(distance)}m away
          </Text>

          <TouchableOpacity
            style={[dynamicStyles.primaryButton, loading && dynamicStyles.buttonDisabled]}
            onPress={() => handleAction(() => onStartWork?.(id))}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Play size={20} color="#ffffff" />
                <Text style={dynamicStyles.primaryButtonText}>
                  Start time at {clientName}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.secondaryButton}
            onPress={onDismiss}
            disabled={loading}
          >
            <Text style={dynamicStyles.secondaryButtonText}>Not starting yet</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const unscheduledOptions = [
      {
        icon: MapPin,
        label: `At job site — ${clientName}`,
        sublabel: 'Log time at this location',
        context: 'job_site' as const,
        color: '#10b981',
      },
      {
        icon: Coffee,
        label: 'On Break',
        sublabel: 'Taking a break',
        context: 'on_break' as const,
        color: '#f59e0b',
      },
      {
        icon: ShoppingCart,
        label: 'Getting Supplies',
        sublabel: 'Picking up materials',
        context: 'getting_supplies' as const,
        color: '#3b82f6',
      },
    ];

    return (
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.iconContainer}>
          <MapPin size={48} color={colors.primary} />
        </View>

        <Text style={dynamicStyles.title}>Near {clientName}</Text>
        <Text style={dynamicStyles.subtitle}>
          Not on today's schedule — what are you doing here?
        </Text>

        <View style={dynamicStyles.optionsContainer}>
          {unscheduledOptions.map((option) => (
            <TouchableOpacity
              key={option.context}
              style={[dynamicStyles.optionButton, loading && dynamicStyles.buttonDisabled]}
              onPress={() => handleAction(() =>
                option.context === 'job_site'
                  ? onStartWork?.(id)
                  : onSetContext?.(option.context)
              )}
              disabled={loading}
            >
              <View style={[dynamicStyles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                <option.icon size={24} color={option.color} />
              </View>
              <View style={dynamicStyles.optionTextContainer}>
                <Text style={dynamicStyles.optionLabel}>{option.label}</Text>
                <Text style={dynamicStyles.optionSublabel}>{option.sublabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={dynamicStyles.secondaryButton}
          onPress={onDismiss}
          disabled={loading}
        >
          <Text style={dynamicStyles.secondaryButtonText}>Just passing by</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderUnknownLocationPrompt = () => {
    const options = [
      {
        icon: MapPin,
        label: 'At a job site',
        sublabel: 'Working at this location',
        context: 'job_site' as const,
        color: '#10b981',
      },
      {
        icon: Coffee,
        label: 'On Break',
        sublabel: 'Taking a break',
        context: 'on_break' as const,
        color: '#f59e0b',
      },
      {
        icon: ShoppingCart,
        label: 'Getting Supplies',
        sublabel: 'Picking up materials',
        context: 'getting_supplies' as const,
        color: '#3b82f6',
      },
      {
        icon: AlertCircle,
        label: 'Stuck in Traffic',
        sublabel: 'Delayed in transit',
        context: 'stuck' as const,
        color: '#ef4444',
      },
    ];

    return (
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.iconContainer}>
          <MapPin size={48} color={colors.primary} />
        </View>

        <Text style={dynamicStyles.title}>Stopped for {prompt.durationMinutes} min</Text>
        <Text style={dynamicStyles.subtitle}>
          What are you doing?
        </Text>

        <View style={dynamicStyles.optionsContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.context}
              style={[dynamicStyles.optionButton, loading && dynamicStyles.buttonDisabled]}
              onPress={() => handleAction(() => onSetContext?.(option.context))}
              disabled={loading}
            >
              <View style={[dynamicStyles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                <option.icon size={24} color={option.color} />
              </View>
              <View style={dynamicStyles.optionTextContainer}>
                <Text style={dynamicStyles.optionLabel}>{option.label}</Text>
                <Text style={dynamicStyles.optionSublabel}>{option.sublabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={dynamicStyles.secondaryButton}
          onPress={onDismiss}
          disabled={loading}
        >
          <Text style={dynamicStyles.secondaryButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewLocationPrompt = () => {
    return (
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.iconContainer}>
          <PlusCircle size={48} color={colors.primary} />
        </View>

        <Text style={dynamicStyles.title}>New Location Detected</Text>
        <Text style={dynamicStyles.subtitle}>
          {prompt.address || 'Unknown address'}
        </Text>

        <TouchableOpacity
          style={[dynamicStyles.primaryButton, loading && dynamicStyles.buttonDisabled]}
          onPress={() =>
            handleAction(() =>
              onAddJobSite?.(
                prompt.address || 'Unknown',
                prompt.latitude,
                prompt.longitude
              )
            )
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <CheckCircle size={20} color="#ffffff" />
              <Text style={dynamicStyles.primaryButtonText}>Add as Job Site</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={dynamicStyles.secondaryButton}
          onPress={onDismiss}
          disabled={loading}
        >
          <Text style={dynamicStyles.secondaryButtonText}>Not a job site</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <TouchableOpacity
            style={dynamicStyles.closeButton}
            onPress={onDismiss}
            disabled={loading}
          >
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {prompt.type === 'near_job' && renderNearJobPrompt()}
            {prompt.type === 'unknown_location' && renderUnknownLocationPrompt()}
            {prompt.type === 'new_location' && renderNewLocationPrompt()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      width: '100%',
      maxWidth: 500,
      maxHeight: '80%',
      padding: 24,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1,
      padding: 4,
    },
    content: {
      alignItems: 'center',
      paddingTop: 20,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      width: '100%',
      gap: 8,
      marginBottom: 12,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '500',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    optionsContainer: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionTextContainer: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    optionSublabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { CircleCheck as CheckCircle, Circle, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useRouter } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  route: string;
  completed: boolean;
}

const STEPS: Omit<ChecklistStep, 'completed'>[] = [
  {
    id: 'business_profile',
    label: 'Set up your business profile',
    description: 'Add your business name, logo, and contact info',
    route: '/(tabs)/index',
  },
  {
    id: 'add_first_client',
    label: 'Add your first client',
    description: 'Create a client record with contact details',
    route: '/(tabs)/clients',
  },
  {
    id: 'schedule_first_job',
    label: 'Schedule a job',
    description: 'Book a job on your calendar',
    route: '/(tabs)/schedule',
  },
  {
    id: 'create_invoice',
    label: 'Send your first invoice',
    description: 'Create and send an invoice to a client',
    route: '/(tabs)/invoices',
  },
  {
    id: 'clock_in',
    label: 'Use the time clock',
    description: 'Clock in and out to track work hours',
    route: '/(tabs)/time',
  },
  {
    id: 'log_expense',
    label: 'Log an expense',
    description: 'Track a business expense in Finances',
    route: '/(tabs)/finances',
  },
];

interface GettingStartedChecklistProps {
  onDismiss: () => void;
}

export default function GettingStartedChecklist({ onDismiss }: GettingStartedChecklistProps) {
  const [steps, setSteps] = useState<ChecklistStep[]>(STEPS.map(s => ({ ...s, completed: false })));
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const { colors, isDark } = useTheme();
  const { openSettings } = useSettings();
  const router = useRouter();

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;

  useEffect(() => {
    if (currentOrganization?.id) {
      loadProgress();
    }
  }, [currentOrganization?.id]);

  const loadProgress = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('getting_started_progress')
        .select('step_id, completed_at')
        .eq('organization_id', currentOrganization.id);

      const completedSet = new Set(
        (data || []).filter(r => r.completed_at).map(r => r.step_id)
      );

      setSteps(STEPS.map(s => ({ ...s, completed: completedSet.has(s.id) })));
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const markStep = useCallback(async (stepId: string) => {
    if (!currentOrganization?.id) return;

    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, completed: true } : s));

    await supabase
      .from('getting_started_progress')
      .upsert({
        organization_id: currentOrganization.id,
        step_id: stepId,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,step_id' });
  }, [currentOrganization?.id]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  const handleStepPress = (step: ChecklistStep) => {
    if (!step.completed) {
      markStep(step.id);
    }
    if (step.id === 'business_profile') {
      openSettings();
    } else {
      router.push(step.route as any);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBarBg: {
      height: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: 8,
    },
    progressBarFill: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    stepsList: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 4,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      gap: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    },
    stepCompleted: {
      opacity: 0.6,
    },
    stepContent: {
      flex: 1,
    },
    stepLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    stepLabelCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    stepDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    dismissBtn: {
      padding: 4,
    },
    expandBtn: {
      padding: 4,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
      marginHorizontal: 16,
    },
    allDoneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    allDoneText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });

  if (loading) return null;

  return (
    <View style={dynamicStyles.container}>
      <TouchableOpacity style={dynamicStyles.header} onPress={toggleExpanded} activeOpacity={0.8}>
        <View style={dynamicStyles.headerLeft}>
          <Text style={dynamicStyles.title}>Getting Started</Text>
          <Text style={dynamicStyles.subtitle}>{completedCount} of {totalCount} completed</Text>
          <View style={dynamicStyles.progressBarBg}>
            <View style={[dynamicStyles.progressBarFill, { width: `${progressPct * 100}%` }]} />
          </View>
        </View>
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity style={dynamicStyles.expandBtn} onPress={toggleExpanded}>
            {expanded
              ? <ChevronUp size={18} color={colors.textSecondary} />
              : <ChevronDown size={18} color={colors.textSecondary} />
            }
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.dismissBtn} onPress={onDismiss} accessibilityLabel="Dismiss getting started checklist">
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={dynamicStyles.divider} />
          {completedCount === totalCount ? (
            <View style={dynamicStyles.allDoneContainer}>
              <CheckCircle size={18} color={colors.primary} />
              <Text style={dynamicStyles.allDoneText}>You're all set! Your business is ready to go.</Text>
            </View>
          ) : (
            <View style={dynamicStyles.stepsList}>
              {steps.map(step => (
                <TouchableOpacity
                  key={step.id}
                  style={[dynamicStyles.step, step.completed && dynamicStyles.stepCompleted]}
                  onPress={() => handleStepPress(step)}
                  activeOpacity={0.7}
                >
                  {step.completed
                    ? <CheckCircle size={22} color={colors.primary} />
                    : <Circle size={22} color={colors.textSecondary} />
                  }
                  <View style={dynamicStyles.stepContent}>
                    <Text style={[dynamicStyles.stepLabel, step.completed && dynamicStyles.stepLabelCompleted]}>
                      {step.label}
                    </Text>
                    {!step.completed && (
                      <Text style={dynamicStyles.stepDesc}>{step.description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

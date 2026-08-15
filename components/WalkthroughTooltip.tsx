import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { useTheme } from '@/contexts/ThemeContext';
import { WALKTHROUGH_STEPS } from '@/constants/walkthroughSteps';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WalkthroughTooltip() {
  const { currentStep, currentStepIndex, nextStep, previousStep, stopWalkthrough } =
    useWalkthrough();
  const { colors } = useTheme();

  if (!currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WALKTHROUGH_STEPS.length - 1;
  const progress = ((currentStepIndex + 1) / WALKTHROUGH_STEPS.length) * 100;

  return (
    <View style={[styles.container, { top: SCREEN_HEIGHT * 0.3 }]}>
      <View style={[styles.tooltip, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.stepCounter, { color: colors.text }]}>
              Step {currentStepIndex + 1} of {WALKTHROUGH_STEPS.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => stopWalkthrough('skipped')}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{currentStep.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {currentStep.description}
        </Text>

        <View style={styles.actions}>
          {!isFirstStep && (
            <TouchableOpacity
              onPress={previousStep}
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
            >
              <ChevronLeft size={18} color={colors.text} />
              <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={styles.spacer} />
          <TouchableOpacity
            onPress={nextStep}
            style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>
              {isLastStep ? 'Done' : 'Next'}
            </Text>
            {!isLastStep && <ChevronRight size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  closeButton: {
    padding: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  spacer: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  primaryButton: {
    flex: 2,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

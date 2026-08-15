import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { getUserWalkthroughStatus, updateUserWalkthroughStatus } from '@/lib/analyticsService';
import { Sparkles, X } from 'lucide-react-native';
import { WALKTHROUGH_WELCOME_BENEFITS } from '@/constants/walkthroughSteps';
import * as Icons from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WalkthroughWelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WalkthroughWelcomeModal({
  visible,
  onClose,
}: WalkthroughWelcomeModalProps) {
  const { colors } = useTheme();
  const { startWalkthrough } = useWalkthrough();

  const handleTakeTour = async () => {
    await updateUserWalkthroughStatus('started');
    onClose();
    setTimeout(() => {
      startWalkthrough('first_time');
    }, 300);
  };

  const handleSkip = async () => {
    await updateUserWalkthroughStatus('skipped');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Sparkles size={48} color={colors.primary} />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              Welcome to Your Business Toolbox!
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Everything you need to manage your business, all in one place. Let us show you around!
            </Text>

            <View style={styles.benefits}>
              {WALKTHROUGH_WELCOME_BENEFITS.map((benefit, index) => {
                const IconComponent = (Icons as any)[benefit.icon];
                return (
                  <View key={index} style={styles.benefitItem}>
                    <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '15' }]}>
                      <IconComponent size={24} color={colors.primary} />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={[styles.benefitTitle, { color: colors.text }]}>
                        {benefit.title}
                      </Text>
                      <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                        {benefit.description}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleTakeTour}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>Take the Tour</Text>
                <Text style={styles.primaryButtonSubtext}>2 minutes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSkip}
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  benefits: {
    gap: 20,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: 16,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  primaryButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

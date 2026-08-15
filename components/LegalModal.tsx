import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export default function LegalModal({ visible, onClose, type }: LegalModalProps) {
  const { colors } = useTheme();
  const dynamicStyles = getDynamicStyles(colors);

  const renderTerms = () => (
    <>
      <Text style={dynamicStyles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={dynamicStyles.paragraph}>
        By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>2. Use License</Text>
      <Text style={dynamicStyles.paragraph}>
        Permission is granted to temporarily use this application for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
      </Text>
      <Text style={dynamicStyles.bulletPoint}>• Modify or copy the materials</Text>
      <Text style={dynamicStyles.bulletPoint}>• Use the materials for any commercial purpose</Text>
      <Text style={dynamicStyles.bulletPoint}>• Attempt to decompile or reverse engineer any software contained in the application</Text>
      <Text style={dynamicStyles.bulletPoint}>• Remove any copyright or other proprietary notations from the materials</Text>

      <Text style={dynamicStyles.sectionTitle}>3. Account Responsibilities</Text>
      <Text style={dynamicStyles.paragraph}>
        You are responsible for maintaining the confidentiality of your account and password and for restricting access to your device. You agree to accept responsibility for all activities that occur under your account.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>4. Data Storage and Backup</Text>
      <Text style={dynamicStyles.paragraph}>
        While we make efforts to ensure the safety and integrity of your data, you are responsible for maintaining your own backups of your business data. We recommend regular exports of your critical business information.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>5. Modifications</Text>
      <Text style={dynamicStyles.paragraph}>
        We may revise these terms of service at any time without notice. By using this application you are agreeing to be bound by the then current version of these terms of service.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>6. Limitation of Liability</Text>
      <Text style={dynamicStyles.paragraph}>
        In no event shall we be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use this application.
      </Text>
    </>
  );

  const renderPrivacy = () => (
    <>
      <Text style={dynamicStyles.sectionTitle}>1. Information We Collect</Text>
      <Text style={dynamicStyles.paragraph}>
        We collect information that you provide directly to us, including:
      </Text>
      <Text style={dynamicStyles.bulletPoint}>• Account information (email, name, business details)</Text>
      <Text style={dynamicStyles.bulletPoint}>• Client and customer information you enter</Text>
      <Text style={dynamicStyles.bulletPoint}>• Financial records (invoices, estimates, expenses)</Text>
      <Text style={dynamicStyles.bulletPoint}>• Location data (when you enable location tracking for jobs)</Text>

      <Text style={dynamicStyles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={dynamicStyles.paragraph}>
        We use the information we collect to:
      </Text>
      <Text style={dynamicStyles.bulletPoint}>• Provide, maintain, and improve our services</Text>
      <Text style={dynamicStyles.bulletPoint}>• Process your transactions and send related information</Text>
      <Text style={dynamicStyles.bulletPoint}>• Send you technical notices and support messages</Text>
      <Text style={dynamicStyles.bulletPoint}>• Respond to your comments and questions</Text>

      <Text style={dynamicStyles.sectionTitle}>3. Data Security</Text>
      <Text style={dynamicStyles.paragraph}>
        We use industry-standard security measures to protect your data. Your data is stored securely using encryption both in transit and at rest. However, no method of transmission over the Internet or electronic storage is 100% secure.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>4. Data Sharing</Text>
      <Text style={dynamicStyles.paragraph}>
        We do not sell, trade, or rent your personal information to third parties. We may share aggregated demographic information not linked to any personal identification information with our business partners.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>5. Your Data Rights</Text>
      <Text style={dynamicStyles.paragraph}>
        You have the right to:
      </Text>
      <Text style={dynamicStyles.bulletPoint}>• Access your personal data</Text>
      <Text style={dynamicStyles.bulletPoint}>• Correct inaccurate data</Text>
      <Text style={dynamicStyles.bulletPoint}>• Request deletion of your data</Text>
      <Text style={dynamicStyles.bulletPoint}>• Export your data in a portable format</Text>

      <Text style={dynamicStyles.sectionTitle}>6. Data Retention</Text>
      <Text style={dynamicStyles.paragraph}>
        We retain your data for as long as your account is active or as needed to provide you services. If you wish to delete your account or request that we no longer use your information, please contact us.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>7. Location Data</Text>
      <Text style={dynamicStyles.paragraph}>
        If you enable location tracking features, we collect and store location data to help you track job sites and travel. You can disable location tracking at any time in your settings.
      </Text>

      <Text style={dynamicStyles.sectionTitle}>8. Changes to Privacy Policy</Text>
      <Text style={dynamicStyles.paragraph}>
        We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "last modified" date.
      </Text>

      <Text style={dynamicStyles.lastModified}>
        Last Modified: February 1, 2026
      </Text>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>
            {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </Text>
          <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={dynamicStyles.content}>
          <View style={dynamicStyles.contentPadding}>
            {type === 'terms' ? renderTerms() : renderPrivacy()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      flex: 1,
    },
    contentPadding: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 24,
      marginBottom: 12,
    },
    paragraph: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: 16,
    },
    bulletPoint: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 24,
      marginLeft: 16,
      marginBottom: 8,
    },
    lastModified: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 24,
      marginBottom: 32,
    },
  });

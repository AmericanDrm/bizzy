import { StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY, CARD, CARD_SHADOW, FAB, HEADER, COLORS } from '@/constants/designSystem';

export const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...TYPOGRAPHY.screenTitle,
      color: colors.text,
    },
    card: {
      ...CARD,
      backgroundColor: colors.cardBackground,
      borderColor: colors.border,
      ...CARD_SHADOW,
    },
    fab: {
      width: FAB.size,
      height: FAB.size,
      borderRadius: FAB.borderRadius,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...(FAB as any),
    },
  });

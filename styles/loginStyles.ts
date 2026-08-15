import { Platform, StyleSheet } from 'react-native';

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    logoSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      paddingBottom: 40,
    },
    formSection: {
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      paddingTop: 32,
      backgroundColor: 'transparent',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
      textAlign: 'center',
    },
    form: {
      gap: 14,
      paddingBottom: 20,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    googleIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#4285F4',
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleIcon: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      paddingHorizontal: 16,
      color: colors.textSecondary,
      fontSize: 14,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    button: {
      borderRadius: 12,
      overflow: 'hidden' as const,
      marginTop: 4,
    },
    buttonGradient: {
      padding: 16,
      alignItems: 'center' as const,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    linkText: {
      color: colors.primary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 24,
    },
    forgotPasswordRow: {
      alignItems: 'flex-end',
      marginTop: -6,
      marginBottom: 4,
    },
    forgotPasswordText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '500',
    },
    errorContainer: {
      backgroundColor: colors.errorBackground,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
    },
  });

export default getDynamicStyles;

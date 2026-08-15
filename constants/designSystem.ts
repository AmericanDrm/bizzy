import { Platform } from 'react-native';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const TYPOGRAPHY = {
  screenTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  headingMedium: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 15,
  },
  captionStrong: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;

export const COLORS = {
  brand: '#1B4D6E',
  text: {
    primary: '#1a2332',
    secondary: '#5a6978',
    tertiary: '#9CA3AF',
  },
  border: {
    light: '#dce3ea',
    default: '#dce3ea',
  },
  background: {
    primary: '#ffffff',
    secondary: '#f4f6f8',
    tertiary: '#f0f3f6',
  },
  error: '#dc2626',
  success: '#2D8B57',
  warning: '#d4850a',
} as const;

/**
 * Layered shadow system: ambient (spread) + key light (directional)
 * Level 1 = default cards
 * Level 2 = raised / interactive cards
 * Level 3 = floating panels / bottom sheets
 */
export const ELEVATION = {
  1: Platform.select({
    web: {
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.03)',
    },
    default: {
      shadowColor: '#1a2e40',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
  }),
  2: Platform.select({
    web: {
      boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
    },
    default: {
      shadowColor: '#1a2e40',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 4,
    },
  }),
  3: Platform.select({
    web: {
      boxShadow: '0 4px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.07)',
    },
    default: {
      shadowColor: '#1a2e40',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 8,
    },
  }),
  dark1: Platform.select({
    web: {
      boxShadow: '0 1px 2px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.16)',
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.24,
      shadowRadius: 4,
      elevation: 3,
    },
  }),
  dark2: Platform.select({
    web: {
      boxShadow: '0 2px 4px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.22)',
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.32,
      shadowRadius: 8,
      elevation: 6,
    },
  }),
  dark3: Platform.select({
    web: {
      boxShadow: '0 4px 8px rgba(0,0,0,0.36), 0 8px 24px rgba(0,0,0,0.28)',
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
  }),
} as const;

export const getElevation = (level: 1 | 2 | 3, isDark: boolean) => {
  if (isDark) {
    return ELEVATION[`dark${level}` as 'dark1' | 'dark2' | 'dark3'];
  }
  return ELEVATION[level];
};

/**
 * Shared card shadow — single source of truth for all card elevations.
 * Use this instead of re-declaring per-style-file cardShadow constants.
 */
export const CARD_SHADOW = ELEVATION[1];

export const CARD = {
  padding: SPACING.lg,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.border.light,
  ...CARD_SHADOW,
} as const;

export const ICON = {
  size: {
    sm: 16,
    md: 18,
    lg: 20,
  },
  color: COLORS.text.secondary,
} as const;

export const SEARCH_BAR = {
  borderRadius: 12,
  paddingHorizontal: SPACING.lg,
  paddingVertical: SPACING.md,
  borderWidth: 0,
} as const;

export const FAB = {
  size: 56,
  borderRadius: 28,
  ...Platform.select({
    web: { boxShadow: '0 4px 12px rgba(27,77,110,0.3)' },
    default: {
      shadowColor: '#1B4D6E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  }),
} as const;

export const HEADER = {
  paddingHorizontal: SPACING.xl,
  paddingVertical: SPACING.lg,
} as const;

export const ICON_BUTTON = {
  size: 40,
  borderRadius: 20,
  borderWidth: 1,
} as const;

export const PRESS_OPACITY = 0.7;

export const ANIMATION = {
  fast: 150,
  medium: 220,
  slow: 320,
  spring: {
    damping: 20,
    stiffness: 300,
  },
  cardPress: {
    scale: 0.97,
  },
  listStagger: 60,
} as const;

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import Logo from '@/components/Logo';
import { Settings, GripVertical, Globe } from 'lucide-react-native';
import HRTabIcon from '@/components/HRTabIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 230;
const ANIMATION_DURATION = 200;

const TAB_IMAGES: Record<string, any> = {
  home: require('@/assets/images/hometab.png'),
  clients: require('@/assets/images/clientstab.png'),
  schedule: require('@/assets/images/schedulingtab.png'),
  time: require('@/assets/images/timeclocktab.png'),
  notes: require('@/assets/images/notestab.png'),
  finances: require('@/assets/images/financestab.png'),
  invoices: require('@/assets/images/Invoicestab.png'),
  routes: require('@/assets/images/RoutesTab.png'),
};

const TAB_IMAGES_LIGHT: Record<string, any> = {
  home: require('@/assets/images/HomeLightModeTab.png'),
  clients: require('@/assets/images/ClientsLightModeTab.png'),
  schedule: require('@/assets/images/ScheduleLightModeTab.png'),
  time: require('@/assets/images/TimeClockLightModeTab.png'),
  notes: require('@/assets/images/NotesLightModeTab.png'),
  finances: require('@/assets/images/FinancesLightModeTab.png'),
  invoices: require('@/assets/images/InvoiceLightModeTab.png'),
  routes: require('@/assets/images/RoutesLightModeTab.png'),
  camera: require('@/assets/images/QuickCameraLightModeIcon.png'),
};

const TAB_IMAGES_DARK: Record<string, any> = {
  home: require('@/assets/images/HomeDarkModeTab.png'),
  clients: require('@/assets/images/ClientsDarkModeTab.png'),
  finances: require('@/assets/images/FinancesDarkModeTab.png'),
  invoices: require('@/assets/images/InvoicesDarkModeTab.png'),
  schedule: require('@/assets/images/ScheduleDarkModeTab.png'),
  time: require('@/assets/images/TimeclockDarkModeTab.png'),
  notes: require('@/assets/images/NotesDarkModeTab.png'),
  routes: require('@/assets/images/RoutesDarkModeTab.png'),
  camera: require('@/assets/images/QuickCameraDarkModeIcon.png'),
};

const TAB_IMAGE_MAP: Record<string, string> = {
  index: 'home',
  clients: 'clients',
  schedule: 'schedule',
  time: 'time',
  invoices: 'invoices',
  notes: 'notes',
  finances: 'finances',
  routes: 'routes',
  camera: 'camera',
};

const TAB_LABEL_KEYS: Record<string, string> = {
  index: 'tab_home',
  clients: 'tab_clients',
  schedule: 'tab_schedule',
  time: 'tab_time',
  invoices: 'tab_invoices',
  notes: 'tab_notes',
  finances: 'tab_finances',
  routes: 'tab_routes',
  hr: 'tab_hr',
};

const TAB_CUSTOM_ICONS: Record<string, (props: { color: string; size: number; focused: boolean }) => React.ReactElement> = {
  hr: ({ color, size }) => React.createElement(HRTabIcon, { color, size }),
};

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenSettings?: () => void;
}

export default function WebSidebarStandalone({ currentRoute, onNavigate, onOpenSettings }: Props) {
  const { colors, isDark } = useTheme();
  const { tabs, reorderTabs, savePreferences } = useLayout();
  const { language, toggleLanguage, t } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const sidebarWidth = useSharedValue(COLLAPSED_WIDTH);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    sidebarWidth.value = withTiming(EXPANDED_WIDTH, { duration: ANIMATION_DURATION });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    sidebarWidth.value = withTiming(COLLAPSED_WIDTH, { duration: ANIMATION_DURATION });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ width: sidebarWidth.value }));

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number, e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragIndex]);

  const handleDrop = useCallback((targetIndex: number) => {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      reorderTabs(dragIndex, targetIndex);
      savePreferences();
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderTabs, savePreferences]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const dynamicStyles = getDynamicStyles(colors);
  const allTabs = tabs.filter(t => t.id !== 'camera');

  const isFocused = (tabId: string) => {
    if (tabId === 'index') return currentRoute === 'index' || currentRoute === '(tabs)' || currentRoute === '';
    return currentRoute === tabId;
  };

  return (
    <Animated.View
      style={[dynamicStyles.sidebar, animatedStyle]}
      // @ts-ignore
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="navigation"
    >
      <View style={dynamicStyles.logoContainer}>
        <Logo size="small" showText={false} showLightning={false} />
      </View>

      <ScrollView
        style={dynamicStyles.navScroll}
        contentContainerStyle={dynamicStyles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {allTabs.map((tabData, index) => {
          const focused = isFocused(tabData.id);
          const imageKey = TAB_IMAGE_MAP[tabData.id];
          const label = t(TAB_LABEL_KEYS[tabData.id] || tabData.id) || tabData.id;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <View
              key={tabData.id}
              style={[
                isDragOver && dynamicStyles.dragOver,
                isDragging && dynamicStyles.dragging,
              ]}
              // @ts-ignore
              draggable={isHovered ? true : undefined}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e: any) => handleDragOver(index, e)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <Pressable
                onPress={() => onNavigate(tabData.id)}
                style={({ hovered }: any) => [
                  dynamicStyles.navItem,
                  focused && dynamicStyles.navItemActive,
                  hovered && !focused && dynamicStyles.navItemHover,
                ]}
              >
                {isHovered && (
                  <View style={dynamicStyles.gripHandle}>
                    <GripVertical size={14} color={colors.textSecondary} />
                  </View>
                )}
                <View style={dynamicStyles.navIconContainer}>
                  {imageKey && TAB_IMAGES[imageKey] ? (
                    <Image
                      source={isDark && TAB_IMAGES_DARK[imageKey] ? TAB_IMAGES_DARK[imageKey] : !isDark && TAB_IMAGES_LIGHT[imageKey] ? TAB_IMAGES_LIGHT[imageKey] : TAB_IMAGES[imageKey]}
                      resizeMode="contain"
                      style={[
                        dynamicStyles.navIcon,
                        isDark && { borderRadius: 0 },
                        isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any },
                        { opacity: focused ? 1 : 0.6 },
                      ]}
                    />
                  ) : TAB_CUSTOM_ICONS[tabData.id] ? (
                    TAB_CUSTOM_ICONS[tabData.id]({
                      size: 28,
                      color: focused ? colors.primary : colors.textSecondary,
                      focused,
                    })
                  ) : null}
                </View>
                {isHovered && (
                  <Text
                    style={[
                      dynamicStyles.navLabel,
                      focused && dynamicStyles.navLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={dynamicStyles.bottomSection}>
        <Pressable
          onPress={toggleLanguage}
          style={({ hovered }: any) => [
            dynamicStyles.settingsButton,
            hovered && dynamicStyles.navItemHover,
          ]}
        >
          <View style={dynamicStyles.navIconContainer}>
            <View style={dynamicStyles.langBadgeWrap}>
              <Globe size={18} color={language === 'es' ? '#007AFF' : colors.textSecondary} />
              <View style={[dynamicStyles.langBadge, language === 'es' && dynamicStyles.langBadgeActive]}>
                <Text style={[dynamicStyles.langBadgeText, language === 'es' && dynamicStyles.langBadgeTextActive]}>
                  {language === 'es' ? 'ES' : 'EN'}
                </Text>
              </View>
            </View>
          </View>
          {isHovered && (
            <Text style={dynamicStyles.navLabel} numberOfLines={1}>
              {language === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish'}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={onOpenSettings}
          style={({ hovered }: any) => [
            dynamicStyles.settingsButton,
            hovered && dynamicStyles.navItemHover,
          ]}
        >
          <View style={dynamicStyles.navIconContainer}>
            <Settings size={22} color={colors.textSecondary} />
          </View>
          {isHovered && (
            <Text style={dynamicStyles.navLabel} numberOfLines={1}>
              {t('settings')}
            </Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    sidebar: {
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      overflow: 'hidden',
      flexDirection: 'column',
      flexShrink: 0,
      ...Platform.select({
        web: {
          boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 4,
        },
      }),
    },
    logoContainer: {
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navScroll: {
      flex: 1,
    },
    navContent: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 2,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      minHeight: 48,
      gap: 8,
    },
    navItemActive: {
      backgroundColor: colors.primaryLight || 'rgba(27, 77, 110, 0.1)',
    },
    navItemHover: {
      backgroundColor: colors.inputBackground || 'rgba(0,0,0,0.04)',
    },
    navItemHidden: {
      opacity: 0.45,
    },
    dragOver: {
      borderTopWidth: 2,
      borderTopColor: colors.primary || '#1B4D6E',
    },
    dragging: {
      opacity: 0.4,
    },
    gripHandle: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconContainer: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    navLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      flex: 1,
    },
    navLabelActive: {
      color: colors.primary || '#1B4D6E',
      fontWeight: '600',
    },
    navLabelHidden: {
      opacity: 0.5,
    },
    bottomSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    settingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      minHeight: 48,
      gap: 8,
    },
    langBadgeWrap: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    langBadge: {
      position: 'absolute',
      bottom: -4,
      right: -6,
      backgroundColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    langBadgeActive: {
      backgroundColor: '#007AFF',
    },
    langBadgeText: {
      fontSize: 8,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.3,
    },
    langBadgeTextActive: {
      color: '#fff',
    },
  });

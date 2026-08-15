import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal, ScrollView, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HapticPatterns } from '@/lib/haptics';
import { Eye, EyeOff, ChevronRight, Menu, X, CreditCard as Edit3, Settings, Globe } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

const TAB_HEIGHT = 80;
const GAP = 8;
const MAX_VISIBLE_TABS = 5;

export default function EditableTabBar({ state, descriptors, navigation, bottomInset = 0 }: BottomTabBarProps & { bottomInset?: number }) {
  const { colors } = useTheme();
  const { tabs, toggleTabVisibility, reorderTabs, savePreferences, visibleTabs } = useLayout();
  const { openSettings } = useSettings();
  const { language, toggleLanguage, t } = useLanguage();
  const [editMode, setEditMode] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleLongPress = () => {
    HapticPatterns.longPress();
    setEditMode(true);
  };

  const handleDone = async () => {
    await savePreferences();
    setEditMode(false);
  };

  const handleToggleVisibility = (id: string) => {
    if (id === 'index') return;
    const currentVisible = tabs.filter(t => t.visible).length;
    const isCurrentlyVisible = tabs.find(t => t.id === id)?.visible;

    if (!isCurrentlyVisible && currentVisible >= MAX_VISIBLE_TABS) {
      return;
    }

    toggleTabVisibility(id);
  };

  const handleMoveLeft = (index: number) => {
    if (index > 0) {
      reorderTabs(index, index - 1);
    }
  };

  const handleMoveRight = (index: number) => {
    if (index < tabs.length - 1) {
      reorderTabs(index, index + 1);
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  const hiddenTabs = tabs.filter(t => !t.visible);
  const hasMoreTab = hiddenTabs.length > 0;
  const maxMainTabs = hasMoreTab ? MAX_VISIBLE_TABS - 1 : MAX_VISIBLE_TABS;

  const mainTabs = visibleTabs.slice(0, maxMainTabs);

  if (editMode) {
    return (
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.editBanner}>
          <Text style={dynamicStyles.editBannerText}>
            Use arrows to reorder, tap eye to show/hide
          </Text>
          <TouchableOpacity style={dynamicStyles.doneButton} onPress={handleDone}>
            <Text style={dynamicStyles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={dynamicStyles.editContainer}>
          {tabs.map((tab, index) => {
            const route = state.routes.find(r => r.name === tab.id);
            if (!route) return null;

            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const isVisible = tab.visible;
            const isHome = tab.id === 'index';
            const currentVisible = tabs.filter(t => t.visible).length;
            const canToggle = (isVisible || currentVisible < MAX_VISIBLE_TABS) && !isHome;

            return (
              <View key={tab.id} style={dynamicStyles.tabWrapper}>
                <View
                  style={[
                    dynamicStyles.editTab,
                    !isVisible && dynamicStyles.editTabHidden,
                  ]}
                >
                  <View style={dynamicStyles.editTabContent}>
                    {options.tabBarIcon && options.tabBarIcon({ focused: false, color: colors.textSecondary, size: 20 })}
                    <Text style={dynamicStyles.editTabLabel} numberOfLines={1}>
                      {typeof label === 'string' ? label : tab.id}
                    </Text>
                  </View>
                  <View style={dynamicStyles.reorderButtons}>
                    <TouchableOpacity
                      style={[dynamicStyles.reorderButton, index === 0 && dynamicStyles.reorderButtonDisabled]}
                      onPress={() => handleMoveLeft(index)}
                      disabled={index === 0}
                    >
                      <Text style={[dynamicStyles.reorderArrow, index === 0 && { opacity: 0.3 }]}>{'‹'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dynamicStyles.reorderButton, index === tabs.length - 1 && dynamicStyles.reorderButtonDisabled]}
                      onPress={() => handleMoveRight(index)}
                      disabled={index === tabs.length - 1}
                    >
                      <Text style={[dynamicStyles.reorderArrow, index === tabs.length - 1 && { opacity: 0.3 }]}>{'›'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Pressable
                  style={[
                    dynamicStyles.visibilityButton,
                    isVisible && dynamicStyles.visibilityButtonActive,
                    !canToggle && dynamicStyles.visibilityButtonDisabled,
                  ]}
                  onPress={() => handleToggleVisibility(tab.id)}
                  disabled={!canToggle}
                >
                  {isVisible ? (
                    <Eye size={16} color={isHome ? colors.border : colors.primary} />
                  ) : (
                    <EyeOff size={16} color={canToggle ? colors.textSecondary : colors.border} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text style={dynamicStyles.editHint}>
          {visibleTabs.length} visible tab{visibleTabs.length !== 1 ? 's' : ''} • {hiddenTabs.length} hidden
          {hiddenTabs.length > 0 && ' (accessible via More tab)'}
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={[dynamicStyles.tabBar, bottomInset > 0 && { paddingBottom: 6 + bottomInset }]}>
        {mainTabs.map((tabData) => {
          const route = state.routes.find(r => r.name === tabData.id);
          if (!route) return null;

          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.routes[state.index]?.name === route.name;

          const onPress = () => {
            HapticPatterns.navigation();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const hoverHandlers = Platform.OS === 'web' ? {
            onMouseEnter: () => setHoveredTab(route.name),
            onMouseLeave: () => setHoveredTab(null),
          } : {};

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={handleLongPress}
              delayLongPress={500}
              style={[
                dynamicStyles.tab,
                isFocused ? dynamicStyles.tabFocused : dynamicStyles.tabUnfocused,
              ]}
              {...hoverHandlers}
            >
              {options.tabBarIcon && options.tabBarIcon({
                focused: isFocused,
                color: isFocused ? colors.primary : colors.textSecondary,
                size: isFocused ? 30 : 24,
              })}
              {isFocused && (
                <Text
                  style={[
                    dynamicStyles.tabLabel,
                    {
                      color: colors.primary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {typeof label === 'string' ? label : route.name}
                </Text>
              )}
            </Pressable>
          );
        })}

        {hasMoreTab && (() => {
          const hiddenTabIds = new Set(hiddenTabs.map(t => t.id));
          const currentRouteName = state.routes[state.index]?.name;
          const isMoreActive = currentRouteName ? hiddenTabIds.has(currentRouteName) : false;
          const moreColor = isMoreActive ? colors.primary : colors.textSecondary;

          const hoverHandlers = Platform.OS === 'web' ? {
            onMouseEnter: () => setHoveredTab('more'),
            onMouseLeave: () => setHoveredTab(null),
          } : {};

          return (
            <Pressable
              onPress={() => setMoreMenuVisible(true)}
              onLongPress={handleLongPress}
              delayLongPress={500}
              style={[
                dynamicStyles.tab,
                isMoreActive ? dynamicStyles.tabFocused : dynamicStyles.tabUnfocused,
              ]}
              {...hoverHandlers}
            >
              <Menu color={moreColor} size={isMoreActive ? 30 : 24} />
              {isMoreActive && (
                <Text style={[dynamicStyles.tabLabel, { color: moreColor, fontWeight: '600' }]}>
                  More
                </Text>
              )}
            </Pressable>
          );
        })()}
      </View>

      <Modal
        visible={moreMenuVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <Pressable
          style={dynamicStyles.modalOverlay}
          onPress={() => setMoreMenuVisible(false)}
        >
          <Pressable style={dynamicStyles.moreMenu} onPress={(e) => e.stopPropagation()}>
            <View style={dynamicStyles.moreMenuHeader}>
              <View>
                <Text style={dynamicStyles.moreMenuTitle}>More</Text>
                <Text style={dynamicStyles.moreMenuSubtitle}>
                  {hiddenTabs.length} additional tab{hiddenTabs.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMoreMenuVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.moreMenuScroll}>
              {hiddenTabs.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <EyeOff size={32} color={colors.textSecondary} />
                  <Text style={dynamicStyles.emptyStateText}>
                    No hidden tabs
                  </Text>
                  <Text style={dynamicStyles.emptyStateSubtext}>
                    Long press the tab bar to customize
                  </Text>
                </View>
              ) : (
                hiddenTabs.map((tabData) => {
                  const route = state.routes.find(r => r.name === tabData.id);
                  if (!route) return null;

                  const { options } = descriptors[route.key];
                  const label = options.tabBarLabel ?? options.title ?? route.name;
                  const isFocused = state.routes[state.index]?.name === route.name;

                  const onPress = () => {
                    setMoreMenuVisible(false);
                    navigation.navigate(route.name, route.params);
                  };

                  return (
                    <TouchableOpacity
                      key={route.key}
                      style={[
                        dynamicStyles.moreMenuItem,
                        isFocused && dynamicStyles.moreMenuItemActive,
                      ]}
                      onPress={onPress}
                    >
                      {options.tabBarIcon && options.tabBarIcon({
                        focused: isFocused,
                        color: isFocused ? colors.primary : colors.text,
                        size: 24,
                      })}
                      <Text
                        style={[
                          dynamicStyles.moreMenuItemText,
                          { color: isFocused ? colors.primary : colors.text, flex: 1 },
                        ]}
                      >
                        {typeof label === 'string' ? label : route.name}
                      </Text>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <View style={dynamicStyles.pillRow}>
              <TouchableOpacity
                style={dynamicStyles.pillButton}
                onPress={() => {
                  setMoreMenuVisible(false);
                  toggleLanguage();
                }}
              >
                <Globe size={15} color={colors.primary} />
                <Text style={dynamicStyles.pillButtonText}>
                  {language === 'es' ? 'EN' : 'ES'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.pillButton}
                onPress={() => {
                  setMoreMenuVisible(false);
                  openSettings();
                }}
              >
                <Settings size={15} color={colors.primary} />
                <Text style={dynamicStyles.pillButtonText}>{t('settings')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.pillButton}
                onPress={() => {
                  setMoreMenuVisible(false);
                  setEditMode(true);
                }}
              >
                <Edit3 size={15} color={colors.primary} />
                <Text style={dynamicStyles.pillButtonText}>Customize</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 4,
      height: 64,
      paddingBottom: 6,
      paddingTop: 6,
      paddingHorizontal: 8,
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      zIndex: 1,
    },
    tabFocused: {
      flex: 1.6,
    },
    tabUnfocused: {
      flex: 0.8,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.2,
      lineHeight: 14,
      marginTop: 2,
    },
    editBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.primary,
      padding: 12,
      paddingBottom: 8,
    },
    editBannerText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
      flex: 1,
    },
    doneButton: {
      backgroundColor: '#fff',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 6,
    },
    doneButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    editContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 8,
      gap: GAP,
      paddingBottom: 28,
    },
    tabWrapper: {
      position: 'relative',
      flexBasis: '31%',
      flexGrow: 1,
      maxWidth: '32%',
    },
    editTab: {
      width: '100%',
      backgroundColor: colors.cardBackground,
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
      minHeight: TAB_HEIGHT,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    editTabHidden: {
      opacity: 0.5,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    visibilityButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 6,
      borderRadius: 6,
      backgroundColor: colors.inputBackground,
      zIndex: 1001,
    },
    visibilityButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    visibilityButtonDisabled: {
      opacity: 0.5,
    },
    editTabContent: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
    },
    editTabLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
    reorderButtons: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 4,
    },
    reorderButton: {
      padding: 4,
      borderRadius: 4,
      backgroundColor: colors.inputBackground,
    },
    reorderButtonDisabled: {
      opacity: 0.4,
    },
    reorderArrow: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    editHint: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingBottom: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    moreMenu: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '60%',
      paddingBottom: 32,
    },
    moreMenuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    moreMenuTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    moreMenuSubtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      marginTop: 2,
    },
    moreMenuScroll: {
      maxHeight: 300,
    },
    moreMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    moreMenuItemActive: {
      backgroundColor: colors.primaryLight,
    },
    moreMenuItemText: {
      fontSize: 16,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 12,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    pillRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pillButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.primaryLight,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    pillButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });

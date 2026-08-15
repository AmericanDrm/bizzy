import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { X, GripVertical } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout, AVAILABLE_NOTES_TABS } from '../contexts/LayoutContext';

interface NotesTabsCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotesTabsCustomizationModal({
  visible,
  onClose,
}: NotesTabsCustomizationModalProps) {
  const { colors } = useTheme();
  const { notesTabs, toggleNotesTabVisibility, savePreferences } = useLayout();
  const [localTabs, setLocalTabs] = useState(notesTabs);

  useEffect(() => {
    if (visible) {
      setLocalTabs(notesTabs);
    }
  }, [visible, notesTabs]);

  const handleToggle = (id: string) => {
    toggleNotesTabVisibility(id);
  };

  const handleSave = async () => {
    try {
      await savePreferences();
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const visibleCount = notesTabs.filter(t => t.visible).length;

  const dynamicStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    content: {
      flex: 1,
    },
    tabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dragHandle: {
      marginRight: 12,
    },
    tabInfo: {
      flex: 1,
    },
    tabLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    tabDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    button: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.inputBackground,
    },
    saveButton: {
      overflow: 'hidden',
      padding: 0,
    },
    saveButtonGradient: {
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.text,
    },
    saveButtonText: {
      color: '#fff',
    },
    infoBox: {
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
  });

  const getTabDescription = (id: string) => {
    switch (id) {
      case 'notes':
        return 'Personal notes and memos';
      case 'todos':
        return 'Task checklist and to-do items';
      case 'team':
        return 'Team announcements and updates';
      case 'checklists':
        return 'Job-specific task checklists';
      case 'supplies':
        return 'Materials and supplies tracking';
      default:
        return '';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dynamicStyles.modalOverlay}>
        <View style={dynamicStyles.modalContent}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Customize Notes Tabs</Text>
            <TouchableOpacity style={dynamicStyles.closeButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.infoBox}>
            <Text style={dynamicStyles.infoText}>
              Select up to 2 tabs to display. Hidden tabs will appear in the More menu.
            </Text>
          </View>

          <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
            {notesTabs.map((tab) => {
              const config = AVAILABLE_NOTES_TABS.find(t => t.id === tab.id);
              const canToggleOff = !tab.visible || visibleCount > 1;
              const canToggleOn = tab.visible || visibleCount < 2;
              const canToggle = canToggleOff && canToggleOn;

              return (
                <View key={tab.id} style={dynamicStyles.tabItem}>
                  <GripVertical size={20} color={colors.textSecondary} style={dynamicStyles.dragHandle} />
                  <View style={dynamicStyles.tabInfo}>
                    <Text style={dynamicStyles.tabLabel}>{config?.label || tab.id}</Text>
                    <Text style={dynamicStyles.tabDescription}>
                      {getTabDescription(tab.id)}
                    </Text>
                  </View>
                  <Switch
                    value={tab.visible}
                    onValueChange={() => canToggle && handleToggle(tab.id)}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={tab.visible ? colors.primary : colors.textSecondary}
                    disabled={!canToggle}
                  />
                </View>
              );
            })}
          </ScrollView>

          <View style={dynamicStyles.footer}>
            <TouchableOpacity
              style={[dynamicStyles.button, dynamicStyles.cancelButton]}
              onPress={onClose}
            >
              <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.button, dynamicStyles.saveButton]}
              onPress={handleSave}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dynamicStyles.saveButtonGradient}
              >
                <Text style={[dynamicStyles.buttonText, dynamicStyles.saveButtonText]}>
                  Save Changes
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

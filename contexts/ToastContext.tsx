import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { X, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Info, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from './ThemeContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    ({ message, type = 'info', duration = 4000, action }: ToastConfig) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      let safeMessage = message;
      if (typeof safeMessage !== 'string') {
        safeMessage = String(safeMessage);
      } else {
        try {
          const parsed = JSON.parse(safeMessage);
          if (parsed && typeof parsed === 'object') {
            safeMessage = parsed.message || parsed.error || parsed.hint || safeMessage;
          }
        } catch {
        }
      }

      setToast({ visible: true, message: safeMessage, type, action });

      translateY.setValue(100);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          hideToast();
        }, duration);
      }
    },
    [translateY, opacity, hideToast]
  );

  const handleAction = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (toast.action) {
      toast.action.onPress();
    }
    hideToast();
  };

  const getToastColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          background: colors.successBackground,
          border: colors.success,
          text: colors.success,
        };
      case 'error':
        return {
          background: colors.errorBackground,
          border: colors.error,
          text: colors.error,
        };
      case 'warning':
        return {
          background: colors.background,
          border: colors.warning,
          text: colors.warning,
        };
      default:
        return {
          background: colors.surface,
          border: colors.primary,
          text: colors.primary,
        };
    }
  };

  const getIcon = () => {
    const toastColors = getToastColors();
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} color={toastColors.text} />;
      case 'error':
        return <AlertCircle size={20} color={toastColors.text} />;
      case 'warning':
        return <AlertTriangle size={20} color={toastColors.text} />;
      default:
        return <Info size={20} color={toastColors.text} />;
    }
  };

  const toastColors = getToastColors();

  const contextValue = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toast.visible && (
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: toastColors.background,
                borderColor: toastColors.border,
              },
            ]}
          >
            <View style={styles.iconContainer}>{getIcon()}</View>
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action && (
              <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
                <Text style={[styles.actionText, { color: toastColors.text }]}>
                  {toast.action.label}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={hideToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 20 : 100,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

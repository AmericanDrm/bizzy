import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleSignOutAndReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (
            key.startsWith('sb-') ||
            key.includes('supabase') ||
            key.includes('auth')
          ) {
            localStorage.removeItem(key);
          }
        }
      } catch {}
      window.location.href = '/login';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showSignOut = this.state.retryCount >= 1;

      return (
        <View style={styles.container}>
          <AlertTriangle size={48} color="#1B4D6E" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {showSignOut
              ? 'The error persists. Try signing out and back in.'
              : 'The app encountered an unexpected error. Please try again.'}
          </Text>
          {this.state.error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorDetailsTitle}>Error Details:</Text>
              <Text style={styles.errorDetailsText}>
                {this.state.error.message}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <RefreshCw size={18} color="#fff" />
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          {showSignOut && (
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={this.handleSignOutAndReload}
            >
              <LogOut size={18} color="#dc2626" />
              <Text style={styles.signOutButtonText}>Sign Out & Reload</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0071e3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  signOutButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  errorDetails: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: 350,
  },
  errorDetailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c00',
    marginBottom: 6,
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#900',
    fontFamily: 'monospace',
  },
});

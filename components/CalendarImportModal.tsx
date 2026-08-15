import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ExternalLink } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  fetchGoogleCalendarEvents,
  importCalendarEventsAsSchedule,
  ImportedCalendarEvent,
} from '@/lib/imports';
import { useAuth } from '@/contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_WEB_ID || '';

interface CalendarImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAST_RANGE_OPTIONS = [
  { label: '30 days', value: 30, description: 'Last month' },
  { label: '6 months', value: 182, description: 'Recent history' },
  { label: '1 year', value: 365, description: 'Past year' },
  { label: '2 years', value: 730, description: 'Recommended' },
  { label: '5 years', value: 1825, description: 'Maximum' },
];

const FUTURE_RANGE_OPTIONS = [
  { label: '30 days', value: 30, description: 'Next month' },
  { label: '6 months', value: 182, description: 'Short term' },
  { label: '1 year', value: 365, description: 'Next year' },
  { label: '2 years', value: 730, description: 'Medium term' },
  { label: '5 years', value: 1825, description: 'Maximum' },
];

export default function CalendarImportModal({
  visible,
  onClose,
  onSuccess,
}: CalendarImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    recurring: number;
  } | null>(null);
  const [selectedPastRange, setSelectedPastRange] = useState(730);
  const [selectedFutureRange, setSelectedFutureRange] = useState(365);
  const { user } = useAuth();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.OS === 'web' ? GOOGLE_CLIENT_WEB_ID : GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'bizzy',
      }),
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleImportFromGoogle(authentication.accessToken);
      }
    } else if (response?.type === 'error') {
      setError('Google authentication failed');
    }
  }, [response]);

  const handleImportFromGoogle = async (accessToken: string) => {
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const timeMin = new Date(
        now.getTime() - selectedPastRange * 24 * 60 * 60 * 1000
      ).toISOString();
      const timeMax = new Date(
        now.getTime() + selectedFutureRange * 24 * 60 * 60 * 1000
      ).toISOString();

      const events = await fetchGoogleCalendarEvents(accessToken, timeMin, timeMax);

      if (events.length === 0) {
        setError('No events found in your Google Calendar for the selected time period');
        setLoading(false);
        return;
      }

      setImporting(true);
      const result = await importCalendarEventsAsSchedule(events, user!.id);
      setImportResult(result);

      if (result.success > 0) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        setError('All events were duplicates or failed to import');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import calendar events');
    } finally {
      setLoading(false);
      setImporting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_WEB_ID) {
      setError('Google Calendar import is not configured. Please add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your environment variables.');
      return;
    }

    setError('');
    try {
      await promptAsync();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google');
    }
  };

  const handleClose = () => {
    setError('');
    setImportResult(null);
    setSelectedPastRange(730);
    setSelectedFutureRange(365);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Import Calendar</Text>
              <TouchableOpacity onPress={handleClose} disabled={importing || loading}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#c00" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.content}>
              {importResult ? (
                <View style={styles.resultContainer}>
                  <CheckCircle size={48} color="#34C759" />
                  <Text style={styles.resultTitle}>Import Complete</Text>
                  <Text style={styles.resultText}>
                    Successfully imported {importResult.success} events
                  </Text>
                  {importResult.recurring > 0 && (
                    <Text style={styles.resultRecurringText}>
                      {importResult.recurring} recurring events detected
                    </Text>
                  )}
                  {importResult.failed > 0 && (
                    <Text style={styles.resultFailedText}>
                      {importResult.failed} events failed or were skipped (duplicates)
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Calendar size={48} color="#007AFF" />
                  <Text style={styles.emptyTitle}>Import from Google Calendar</Text>
                  <Text style={styles.emptyText}>
                    Connect your Google Calendar to import upcoming events into your schedule
                  </Text>

                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>What will be imported:</Text>
                    <Text style={styles.infoItem}>• Event titles and descriptions</Text>
                    <Text style={styles.infoItem}>• Start and end times</Text>
                    <Text style={styles.infoItem}>• Event locations</Text>
                    <Text style={styles.infoItem}>• Recurring event detection</Text>
                  </View>

                  <View style={styles.rangeSection}>
                    <Text style={styles.rangeSectionTitle}>How far back to import?</Text>
                    <View style={styles.rangeOptions}>
                      {PAST_RANGE_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.rangeOption,
                            selectedPastRange === option.value && styles.rangeOptionSelected,
                          ]}
                          onPress={() => setSelectedPastRange(option.value)}
                          disabled={loading || importing}
                        >
                          <Text
                            style={[
                              styles.rangeOptionLabel,
                              selectedPastRange === option.value && styles.rangeOptionLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.rangeOptionDescription,
                              selectedPastRange === option.value &&
                                styles.rangeOptionDescriptionSelected,
                            ]}
                          >
                            {option.description}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.rangeSection}>
                    <Text style={styles.rangeSectionTitle}>How far ahead to import?</Text>
                    <View style={styles.rangeOptions}>
                      {FUTURE_RANGE_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.rangeOption,
                            selectedFutureRange === option.value && styles.rangeOptionSelected,
                          ]}
                          onPress={() => setSelectedFutureRange(option.value)}
                          disabled={loading || importing}
                        >
                          <Text
                            style={[
                              styles.rangeOptionLabel,
                              selectedFutureRange === option.value &&
                                styles.rangeOptionLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.rangeOptionDescription,
                              selectedFutureRange === option.value &&
                                styles.rangeOptionDescriptionSelected,
                            ]}
                          >
                            {option.description}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignIn}
                    disabled={loading || importing}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.googleButtonGradient}
                    >
                      {loading || importing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <ExternalLink size={20} color="#fff" />
                          <Text style={styles.googleButtonText}>Connect Google Calendar</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={styles.privacyNote}>
                    We only request read access to your calendar. Your data is never stored on Google's servers.
                  </Text>
                </View>
              )}
            </ScrollView>

            {!importResult && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={loading || importing}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    flex: 1,
  },
  content: {
    maxHeight: 500,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  rangeSection: {
    width: '100%',
    marginBottom: 24,
  },
  rangeSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  rangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  rangeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    minWidth: 80,
    alignItems: 'center',
  },
  rangeOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  rangeOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  rangeOptionLabelSelected: {
    color: '#fff',
  },
  rangeOptionDescription: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  rangeOptionDescriptionSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  googleButton: {
    overflow: 'hidden',
    borderRadius: 8,
    minWidth: 250,
  },
  googleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  resultContainer: {
    alignItems: 'center',
    padding: 40,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resultRecurringText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
  },
  resultFailedText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});

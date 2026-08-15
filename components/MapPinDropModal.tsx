import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, MapPin, Check, Navigation, Crosshair } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { reverseGeocode, AddressData, emptyAddressData } from '@/lib/addressService';

let Mapbox: any;

if (Platform.OS !== 'web') {
  try {
    Mapbox = require('@rnmapbox/maps').default;
  } catch {
    // Mapbox not available
  }
}

interface MapPinDropModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: AddressData) => void;
}

export default function MapPinDropModal({ visible, onClose, onSelect }: MapPinDropModalProps) {
  const { colors } = useTheme();
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const handlePinDrop = useCallback(async (lat: number, lng: number) => {
    setPin({ lat, lng });
    setLoading(true);
    setResolvedAddress(null);

    const result = await reverseGeocode(lat, lng);
    if (result) {
      setResolvedAddress(result);
    } else {
      setResolvedAddress({
        ...emptyAddressData(),
        latitude: lat,
        longitude: lng,
      });
    }
    setLoading(false);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      await handlePinDrop(coords.lat, coords.lng);
    } catch {
      // Location unavailable
    } finally {
      setLocating(false);
    }
  }, [handlePinDrop]);

  useEffect(() => {
    if (visible && initialLoad) {
      setInitialLoad(false);
      handleUseCurrentLocation();
    }
  }, [visible, initialLoad, handleUseCurrentLocation]);

  const handleConfirm = useCallback(() => {
    if (resolvedAddress) {
      onSelect(resolvedAddress);
      onClose();
    }
  }, [resolvedAddress, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setPin(null);
    setResolvedAddress(null);
    setInitialLoad(true);
    onClose();
  }, [onClose]);

  if (Platform.OS !== 'web' && Mapbox) {
      const MapView = Mapbox.MapView;
      const Camera = Mapbox.Camera;
      const PointAnnotation = Mapbox.PointAnnotation;

      return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
          <View style={[styles.fullContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>Drop a Pin</Text>
              <TouchableOpacity onPress={handleClose}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                styleURL="mapbox://styles/mapbox/streets-v12"
                onPress={(feature: any) => {
                  const coords = feature.geometry?.coordinates;
                  if (coords) {
                    handlePinDrop(coords[1], coords[0]);
                  }
                }}
              >
                <Camera
                  zoomLevel={17}
                  centerCoordinate={
                    pin ? [pin.lng, pin.lat] : userLocation ? [userLocation.lng, userLocation.lat] : [-98.5795, 39.8283]
                  }
                  animationDuration={500}
                />
                {pin && (
                  <PointAnnotation id="pin" coordinate={[pin.lng, pin.lat]}>
                    <View style={styles.pinMarker}>
                      <MapPin size={28} color="#fff" fill="#0071e3" />
                    </View>
                  </PointAnnotation>
                )}
              </MapView>

              <View style={styles.mapOverlay}>
                <TouchableOpacity
                  style={[styles.locateButton, { backgroundColor: colors.surface }]}
                  onPress={handleUseCurrentLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Navigation size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {!pin && !locating && (
                <View style={styles.instructionOverlay}>
                  <View style={[styles.instructionBadge, { backgroundColor: colors.surface }]}>
                    <Crosshair size={20} color={colors.primary} />
                    <Text style={[styles.instructionText, { color: colors.text }]}>
                      Tap anywhere on the map to drop a pin
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {renderBottomPanel(colors, pin, resolvedAddress, loading, handleConfirm)}
          </View>
        </Modal>
      );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.webOverlay]}>
        <View style={[styles.webModal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Choose Location</Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.webContent}>
            <View style={[styles.webInfoBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <MapPin size={32} color={colors.primary} />
              <Text style={[styles.webInfoTitle, { color: colors.text }]}>
                Pin-Drop Map
              </Text>
              <Text style={[styles.webInfoDesc, { color: colors.textSecondary }]}>
                Use your current GPS location or type an address manually.
                Full interactive map pin-drop is available in the mobile app.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.webLocateBtn, { overflow: 'hidden' }]}
              onPress={handleUseCurrentLocation}
              disabled={locating}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {locating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Navigation size={20} color="#fff" />
                  <Text style={styles.webLocateBtnText}>Use Current Location</Text>
                </>
              )}
            </TouchableOpacity>

            {resolvedAddress && (
              <View style={[styles.resolvedCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.resolvedTitle, { color: colors.text }]}>Detected Address</Text>
                <Text style={[styles.resolvedAddr, { color: colors.textSecondary }]}>
                  {resolvedAddress.fullAddress || `${resolvedAddress.latitude?.toFixed(5)}, ${resolvedAddress.longitude?.toFixed(5)}`}
                </Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, { overflow: 'hidden' }]}
                  onPress={handleConfirm}
                >
                  <LinearGradient
                    colors={['#2D8B57', '#34a065']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Check size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>Use This Location</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function renderBottomPanel(
  colors: any,
  pin: { lat: number; lng: number } | null,
  resolvedAddress: AddressData | null,
  loading: boolean,
  handleConfirm: () => void
) {
  if (!pin) return null;

  return (
    <View style={[styles.bottomPanel, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {loading ? (
        <View style={styles.bottomLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.bottomLoadingText, { color: colors.textSecondary }]}>
            Resolving address...
          </Text>
        </View>
      ) : resolvedAddress ? (
        <>
          <View style={styles.bottomAddr}>
            <Text style={[styles.bottomAddrMain, { color: colors.text }]} numberOfLines={1}>
              {resolvedAddress.street || 'Unknown street'}
            </Text>
            <Text style={[styles.bottomAddrSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {[resolvedAddress.city, resolvedAddress.state, resolvedAddress.postalCode].filter(Boolean).join(', ') || `${resolvedAddress.latitude?.toFixed(5)}, ${resolvedAddress.longitude?.toFixed(5)}`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.bottomConfirmBtn, { overflow: 'hidden' }]}
            onPress={handleConfirm}
          >
            <LinearGradient
              colors={['#2D8B57', '#34a065']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Check size={18} color="#fff" />
            <Text style={styles.bottomConfirmText}>Use</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  pinMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0071e3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 12,
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  instructionOverlay: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  bottomLoading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomLoadingText: {
    fontSize: 14,
  },
  bottomAddr: {
    flex: 1,
  },
  bottomAddrMain: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomAddrSub: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bottomConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webModal: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  webContent: {
    padding: 24,
    gap: 16,
  },
  webInfoBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  webInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  webInfoDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  webLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  webLocateBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resolvedCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  resolvedTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resolvedAddr: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

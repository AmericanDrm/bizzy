import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MapPin, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { RouteLocation } from '@/lib/routeOptimizationService';

interface RouteMapPreviewProps {
  locations: RouteLocation[];
}

export default function RouteMapPreview({ locations }: RouteMapPreviewProps) {
  const { colors } = useTheme();

  if (locations.length === 0) {
    return null;
  }

  const minLat = Math.min(...locations.map((l) => l.latitude));
  const maxLat = Math.max(...locations.map((l) => l.latitude));
  const minLng = Math.min(...locations.map((l) => l.longitude));
  const maxLng = Math.max(...locations.map((l) => l.longitude));

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latDelta = Math.max(maxLat - minLat, 0.01) * 1.4;
  const lngDelta = Math.max(maxLng - minLng, 0.01) * 1.4;

  const generateStaticMapUrl = () => {
    const width = 600;
    const height = 300;
    const zoom = 12;

    const markers = locations
      .map(
        (loc, idx) =>
          `pin-s-${idx + 1}+${colors.primary.replace('#', '')}(${loc.longitude},${loc.latitude})`
      )
      .join(',');

    if (Platform.OS === 'web') {
      const pathCoords = locations.map((l) => `${l.longitude},${l.latitude}`).join(',');
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path-5+${colors.primary.replace('#', '')}-0.8(${pathCoords})/${centerLng},${centerLat},${zoom}/${width}x${height}@2x?access_token=${process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'pk.your_token'}`;
    }

    return null;
  };

  const mapUrl = generateStaticMapUrl();

  return (
    <View style={[styles.container, { backgroundColor: colors.border }]}>
      {Platform.OS === 'web' && mapUrl ? (
        <img src={mapUrl} style={{ width: '100%', height: 200, borderRadius: 12 }} alt="Route map" />
      ) : (
        <View style={styles.placeholder}>
          <MapPin size={32} color={colors.textSecondary} />
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            Map preview available in web version
          </Text>
        </View>
      )}

      <View style={styles.stopsList}>
        {locations.map((location, index) => (
          <View key={location.id} style={[styles.stopItem, { borderLeftColor: colors.primary }]}>
            <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stopNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stopInfo}>
              <View style={styles.stopLabelRow}>
                <Text style={[styles.stopLabel, { color: colors.text }]} numberOfLines={1}>
                  {location.label}
                </Text>
                {location.serviceWindow && (
                  <View style={styles.windowBadge}>
                    <Lock size={8} color="#92400e" />
                    <Text style={styles.windowBadgeText}>{location.serviceWindow.start} - {location.serviceWindow.end}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.stopAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                {location.address}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
  },
  stopsList: {
    padding: 12,
    gap: 8,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  stopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stopAddress: {
    fontSize: 12,
  },
  stopLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  windowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  windowBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#92400e',
  },
});

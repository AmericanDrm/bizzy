import { Platform, Linking, Alert } from 'react-native';
import { RouteLocation, RouteEndpoint } from './routeOptimizationService';

export type MapsApp = 'apple' | 'google' | 'waze';

export interface MapDeepLinkOptions {
  app: MapsApp;
  stops: RouteLocation[];
  optimized: boolean;
  startEndpoint?: RouteEndpoint;
  endEndpoint?: RouteEndpoint;
}

function encodeAddress(address: string): string {
  return encodeURIComponent(address);
}

function encodeCoordinate(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function generateAppleMapsDeepLink(
  stops: RouteLocation[],
  startEndpoint?: RouteEndpoint,
  endEndpoint?: RouteEndpoint
): string {
  if (stops.length === 0) return '';

  if (startEndpoint) {
    const dest = endEndpoint && endEndpoint.latitude !== 0
      ? stops[stops.length - 1]
      : stops[stops.length - 1];

    const destEndpoint = endEndpoint && endEndpoint.latitude !== 0 ? endEndpoint : dest;
    const waypoints = (endEndpoint && endEndpoint.latitude !== 0 ? stops : stops.slice(0, -1))
      .map(s => encodeCoordinate(s.latitude, s.longitude))
      .join('|');

    let url = `http://maps.apple.com/?`;
    if (!startEndpoint.isCurrentLocation && startEndpoint.latitude !== 0) {
      url += `saddr=${encodeCoordinate(startEndpoint.latitude, startEndpoint.longitude)}&`;
    }
    url += `daddr=${encodeCoordinate(destEndpoint.latitude, destEndpoint.longitude)}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    url += '&dirflg=d';
    return url;
  }

  if (stops.length === 1) {
    const stop = stops[0];
    return `http://maps.apple.com/?daddr=${encodeCoordinate(stop.latitude, stop.longitude)}&dirflg=d`;
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];

  const waypoints = stops.slice(1, -1)
    .map(stop => encodeCoordinate(stop.latitude, stop.longitude))
    .join('|');

  let url = `http://maps.apple.com/?saddr=${encodeCoordinate(origin.latitude, origin.longitude)}`;
  url += `&daddr=${encodeCoordinate(destination.latitude, destination.longitude)}`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  url += '&dirflg=d';

  return url;
}

export function generateGoogleMapsDeepLink(
  stops: RouteLocation[],
  startEndpoint?: RouteEndpoint,
  endEndpoint?: RouteEndpoint
): string {
  if (stops.length === 0) return '';

  let url = `https://www.google.com/maps/dir/?api=1`;

  if (startEndpoint) {
    if (!startEndpoint.isCurrentLocation && startEndpoint.latitude !== 0) {
      url += `&origin=${encodeCoordinate(startEndpoint.latitude, startEndpoint.longitude)}`;
    }
    // When isCurrentLocation is true, omit origin — Google Maps defaults to device location

    const destEndpoint = endEndpoint && endEndpoint.latitude !== 0 ? endEndpoint : stops[stops.length - 1];
    url += `&destination=${encodeCoordinate(destEndpoint.latitude, destEndpoint.longitude)}`;

    const waypointStops = endEndpoint && endEndpoint.latitude !== 0 ? stops : stops.slice(0, -1);
    const waypoints = waypointStops.map(s => encodeCoordinate(s.latitude, s.longitude)).join('|');
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    url += '&travelmode=driving';
    return url;
  }

  if (stops.length === 1) {
    url += `&destination=${encodeCoordinate(stops[0].latitude, stops[0].longitude)}`;
    url += '&travelmode=driving';
    return url;
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];

  const waypoints = stops.slice(1, -1)
    .map(stop => encodeCoordinate(stop.latitude, stop.longitude))
    .join('|');

  url += `&origin=${encodeCoordinate(origin.latitude, origin.longitude)}`;
  url += `&destination=${encodeCoordinate(destination.latitude, destination.longitude)}`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  url += '&travelmode=driving';

  return url;
}

export function generateWazeDeepLink(stops: RouteLocation[]): string {
  if (stops.length === 0) return '';

  if (stops.length === 1) {
    const stop = stops[0];
    return `https://waze.com/ul?ll=${encodeCoordinate(stop.latitude, stop.longitude)}&navigate=yes`;
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];

  let url = `https://waze.com/ul?ll=${encodeCoordinate(destination.latitude, destination.longitude)}&navigate=yes`;

  return url;
}

export function generateMapDeepLink(options: MapDeepLinkOptions): string {
  const { app, stops, startEndpoint, endEndpoint } = options;

  switch (app) {
    case 'apple':
      return generateAppleMapsDeepLink(stops, startEndpoint, endEndpoint);
    case 'google':
      return generateGoogleMapsDeepLink(stops, startEndpoint, endEndpoint);
    case 'waze':
      return generateWazeDeepLink(stops);
    default:
      return generateGoogleMapsDeepLink(stops, startEndpoint, endEndpoint);
  }
}

export async function openInMaps(
  stops: RouteLocation[],
  preferredApp?: MapsApp,
  startEndpoint?: RouteEndpoint,
  endEndpoint?: RouteEndpoint
): Promise<void> {
  if (stops.length === 0) {
    Alert.alert('No Locations', 'Please add at least one location to the route.');
    return;
  }

  const app = preferredApp || (Platform.OS === 'ios' ? 'apple' : 'google');
  const url = generateMapDeepLink({ app, stops, optimized: true, startEndpoint, endEndpoint });

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Cannot Open Maps',
        'The selected maps app is not available on this device.',
        [
          {
            text: 'Try Google Maps',
            onPress: async () => {
              const googleUrl = generateGoogleMapsDeepLink(stops, startEndpoint, endEndpoint);
              await Linking.openURL(googleUrl);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  } catch (error) {
    console.error('Error opening maps:', error);
    Alert.alert('Error', 'Failed to open maps application.');
  }
}

export async function shareRoute(stops: RouteLocation[], routeName: string): Promise<void> {
  if (stops.length === 0) return;

  const googleUrl = generateGoogleMapsDeepLink(stops);
  const appleUrl = generateAppleMapsDeepLink(stops);

  const message = `${routeName}\n\nRoute with ${stops.length} stop${stops.length > 1 ? 's' : ''}:\n\n${stops.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\n\nGoogle Maps: ${googleUrl}\nApple Maps: ${appleUrl}`;

  try {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: routeName,
          text: message,
        });
      } else {
        await navigator.clipboard.writeText(message);
        Alert.alert('Copied', 'Route details copied to clipboard');
      }
    } else {
      const Share = require('react-native').Share;
      await Share.share({
        message,
        title: routeName,
      });
    }
  } catch (error) {
    console.error('Error sharing route:', error);
  }
}

export function getAvailableMapApps(): MapsApp[] {
  if (Platform.OS === 'ios') {
    return ['apple', 'google', 'waze'];
  } else if (Platform.OS === 'android') {
    return ['google', 'waze'];
  } else {
    return ['google', 'apple'];
  }
}

export function getDefaultMapApp(): MapsApp {
  if (Platform.OS === 'ios') return 'apple';
  return 'google';
}

export function buildAddressUrl(address: string, app: MapsApp): string {
  const encoded = encodeURIComponent(address);
  switch (app) {
    case 'apple':
      return `http://maps.apple.com/?daddr=${encoded}&dirflg=d`;
    case 'waze':
      return `https://waze.com/ul?q=${encoded}&navigate=yes`;
    case 'google':
    default:
      return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  }
}

export async function openAddressInMaps(address: string): Promise<void> {
  if (!address) return;

  if (Platform.OS === 'web') {
    const url = buildAddressUrl(address, 'google');
    window.open(url, '_blank');
    return;
  }

  const apps = getAvailableMapApps();
  const appLabels: Record<MapsApp, string> = {
    apple: 'Apple Maps',
    google: 'Google Maps',
    waze: 'Waze',
  };

  const options = apps.map((app) => ({
    text: appLabels[app],
    onPress: async () => {
      const url = buildAddressUrl(address, app);
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Error', 'Failed to open maps application.');
      }
    },
  }));

  Alert.alert('Open in Maps', address, [
    ...options,
    { text: 'Cancel', style: 'cancel' },
  ]);
}

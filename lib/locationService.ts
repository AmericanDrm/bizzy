import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ClientWithDistance {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
}

export interface LocationStatus {
  type: 'home' | 'job_site' | 'traveling' | 'unknown' | 'stopped' | 'idle' | 'home_base';
  clientId?: string;
  clientName?: string;
  distance?: number;
  stoppedMinutes?: number;
}

export class LocationService {
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  static getDistanceBetween(point1: Coordinates, point2: Coordinates): number {
    return this.calculateDistance(
      point1.latitude,
      point1.longitude,
      point2.latitude,
      point2.longitude
    );
  }

  static isWithinGeofence(
    currentLocation: Coordinates,
    targetLocation: Coordinates,
    radiusMeters: number
  ): boolean {
    const distance = this.getDistanceBetween(currentLocation, targetLocation);
    return distance <= radiusMeters;
  }

  static findNearbyClients(
    currentLocation: Coordinates,
    clients: Array<{
      id: string;
      name: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
    }>,
    radiusMeters: number = 100
  ): ClientWithDistance[] {
    const nearbyClients: ClientWithDistance[] = [];

    for (const client of clients) {
      if (
        client.latitude !== null &&
        client.longitude !== null &&
        !isNaN(client.latitude) &&
        !isNaN(client.longitude)
      ) {
        const distance = this.getDistanceBetween(currentLocation, {
          latitude: client.latitude,
          longitude: client.longitude,
        });

        if (distance <= radiusMeters) {
          nearbyClients.push({
            id: client.id,
            name: client.name,
            address: client.address || '',
            latitude: client.latitude,
            longitude: client.longitude,
            distance: Math.round(distance),
          });
        }
      }
    }

    return nearbyClients.sort((a, b) => a.distance - b.distance);
  }

  static determineLocationStatus(
    currentLocation: Coordinates,
    homeBase: Coordinates | null,
    clients: Array<{
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    }>,
    geofenceRadius: number = 100
  ): LocationStatus {
    if (homeBase) {
      const distanceFromHome = this.getDistanceBetween(
        currentLocation,
        homeBase
      );
      if (distanceFromHome <= geofenceRadius) {
        return {
          type: 'home',
          distance: Math.round(distanceFromHome),
        };
      }
    }

    for (const client of clients) {
      if (
        client.latitude !== null &&
        client.longitude !== null &&
        !isNaN(client.latitude) &&
        !isNaN(client.longitude)
      ) {
        const distance = this.getDistanceBetween(currentLocation, {
          latitude: client.latitude,
          longitude: client.longitude,
        });

        if (distance <= geofenceRadius) {
          return {
            type: 'job_site',
            clientId: client.id,
            clientName: client.name,
            distance: Math.round(distance),
          };
        }
      }
    }

    return { type: 'traveling' };
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        return false;
      }

      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      return backgroundStatus === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  static async getCurrentLocation(): Promise<Coordinates | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

 static async startLocationTracking(
  callback: (location: Coordinates) => void,
  onIdle: () => void, // NEW callback
  homeBase: Coordinates | null, // needed for geofence check
  clients: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>, // needed for geofence check
  interval: number = 30000
): Promise<Location.LocationSubscription | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      return null;
    }

    let lastMovementTime = Date.now();
    let lastKnownLocation: Coordinates | null = null;

    const SPEED_THRESHOLD = 1; // m/s (~2.2 mph)
    const IDLE_THRESHOLD_MINUTES = 5;
    let idleTriggered = false; // prevents repeated triggers

    // Start watching position
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: interval,
        distanceInterval: 10,
      },
      (location) => {
        const speed = location.coords.speed ?? 0;

        lastKnownLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        // Reset idle timer if moving
        if (speed > SPEED_THRESHOLD) {
          lastMovementTime = Date.now();
          idleTriggered = false; // allow future idle triggers
        }

        callback(lastKnownLocation);
      }
    );

    // Idle checker
    setInterval(() => {
      if (!lastKnownLocation) return;

      const minutesIdle =
        (Date.now() - lastMovementTime) / 1000 / 60;

      if (minutesIdle >= IDLE_THRESHOLD_MINUTES && !idleTriggered) {
        const status = LocationService.determineLocationStatus(
          lastKnownLocation,
          homeBase,
          clients
        );

        // Only trigger if NOT at job site
        if (status.type !== 'job_site') {
          onIdle();
          idleTriggered = true; // prevent repeated triggers
        }
      }
    }, 30000);

    return subscription;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return null;
  }
}

  static async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<{
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    formattedAddress?: string;
  } | null> {
    try {
      const accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      if (!accessToken) {
        console.error('Mapbox access token not found');
        return null;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}&types=address`
      );

      if (!response.ok) {
        throw new Error('Failed to reverse geocode');
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return null;
      }

      const feature = data.features[0];
      const context = feature.context || [];

      let street = feature.text;
      if (feature.address) {
        street = `${feature.address} ${feature.text}`;
      }

      const city = context.find((c: any) => c.id.startsWith('place'))?.text;
      const state = context.find((c: any) => c.id.startsWith('region'))?.text;
      const postalCode = context.find((c: any) => c.id.startsWith('postcode'))?.text;
      const country = context.find((c: any) => c.id.startsWith('country'))?.text;

      return {
        street,
        city,
        state,
        postalCode,
        country,
        formattedAddress: feature.place_name,
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

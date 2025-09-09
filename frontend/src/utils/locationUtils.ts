/**
 * Location utilities for handling browser geolocation API
 * Provides location permission management, accuracy levels, and error handling
 */

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  prompt: boolean;
  denied: boolean;
}

// Location accuracy levels
export enum LocationAccuracy {
  HIGH = 'high',       // GPS - best accuracy but high battery usage
  BALANCED = 'balanced', // WiFi + GPS - good balance
  LOW = 'low',         // Network/IP - fastest but least accurate
}

// Default location options for different accuracy levels
const LOCATION_OPTIONS: Record<LocationAccuracy, LocationOptions> = {
  [LocationAccuracy.HIGH]: {
    enableHighAccuracy: true,
    timeout: 15000, // 15 seconds
    maximumAge: 60000, // 1 minute
  },
  [LocationAccuracy.BALANCED]: {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 300000, // 5 minutes
  },
  [LocationAccuracy.LOW]: {
    enableHighAccuracy: false,
    timeout: 5000, // 5 seconds
    maximumAge: 600000, // 10 minutes
  },
};

/**
 * Checks if geolocation is supported by the browser
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Checks current location permission status
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (!('permissions' in navigator)) {
    return {
      granted: false,
      prompt: true,
      denied: false,
    };
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return {
      granted: permission.state === 'granted',
      prompt: permission.state === 'prompt',
      denied: permission.state === 'denied',
    };
  } catch (error) {
    console.warn('Failed to check location permission:', error);
    return {
      granted: false,
      prompt: true,
      denied: false,
    };
  }
}

/**
 * Requests location permission from the user
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (!isGeolocationSupported()) {
    throw new Error('Geolocation is not supported by this browser');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        resolve(true);
      },
      (error) => {
        if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
          resolve(false);
        } else {
          reject(createLocationError(error));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: Infinity,
      }
    );
  });
}

/**
 * Gets the current location with specified accuracy level
 */
export async function getCurrentLocation(
  accuracy: LocationAccuracy = LocationAccuracy.BALANCED
): Promise<LocationCoordinates> {
  if (!isGeolocationSupported()) {
    throw createLocationError(null, 'Geolocation is not supported', 'NOT_SUPPORTED');
  }

  const options = LOCATION_OPTIONS[accuracy];
  
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(convertGeolocationPosition(position));
      },
      (error) => {
        reject(createLocationError(error));
      },
      options
    );
  });
}

/**
 * Watches location changes (for real-time tracking)
 */
export function watchLocation(
  callback: (location: LocationCoordinates) => void,
  errorCallback: (error: LocationError) => void,
  accuracy: LocationAccuracy = LocationAccuracy.BALANCED
): number {
  if (!isGeolocationSupported()) {
    errorCallback(createLocationError(null, 'Geolocation is not supported', 'NOT_SUPPORTED'));
    return -1;
  }

  const options = LOCATION_OPTIONS[accuracy];

  return navigator.geolocation.watchPosition(
    (position) => {
      callback(convertGeolocationPosition(position));
    },
    (error) => {
      errorCallback(createLocationError(error));
    },
    options
  );
}

/**
 * Stops watching location changes
 */
export function stopWatchingLocation(watchId: number): void {
  if (watchId >= 0) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculates distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Formats distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0.1) {
    return 'Very close';
  } else if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m away`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km away`;
  } else {
    return `${Math.round(distanceKm)}km away`;
  }
}

/**
 * Checks if location is stale (older than specified minutes)
 */
export function isLocationStale(timestamp: number, maxAgeMinutes: number = 30): boolean {
  const ageMs = Date.now() - timestamp;
  return ageMs > maxAgeMinutes * 60 * 1000;
}

/**
 * Gets location from IP address as fallback
 * Note: This is less accurate and should only be used as a last resort
 */
export async function getLocationFromIP(): Promise<Partial<LocationCoordinates>> {
  try {
    // Use a free IP geolocation service
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: 10000, // IP-based location is very inaccurate (10km)
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.warn('Failed to get location from IP:', error);
  }
  
  throw new Error('Unable to determine location from IP');
}

/**
 * Storage key for location preferences
 */
const LOCATION_STORAGE_KEY = 'link_location_preferences';

export interface LocationPreferences {
  permissionGranted: boolean;
  defaultAccuracy: LocationAccuracy;
  allowBackgroundLocation: boolean;
  shareExactLocation: boolean;
  cacheLocationMinutes: number;
  lastUpdated: number;
}

/**
 * Gets stored location preferences
 */
export function getLocationPreferences(): LocationPreferences {
  const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
  
  const defaults: LocationPreferences = {
    permissionGranted: false,
    defaultAccuracy: LocationAccuracy.BALANCED,
    allowBackgroundLocation: false,
    shareExactLocation: false,
    cacheLocationMinutes: 5,
    lastUpdated: Date.now(),
  };
  
  if (!stored) {
    return defaults;
  }
  
  try {
    return { ...defaults, ...JSON.parse(stored) };
  } catch (error) {
    console.warn('Failed to parse location preferences:', error);
    return defaults;
  }
}

/**
 * Saves location preferences
 */
export function saveLocationPreferences(preferences: Partial<LocationPreferences>): void {
  const current = getLocationPreferences();
  const updated = {
    ...current,
    ...preferences,
    lastUpdated: Date.now(),
  };
  
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Clears stored location preferences
 */
export function clearLocationPreferences(): void {
  localStorage.removeItem(LOCATION_STORAGE_KEY);
}

// Helper functions

function convertGeolocationPosition(position: GeolocationPosition): LocationCoordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
  };
}

function createLocationError(
  error: GeolocationPositionError | null, 
  message?: string, 
  type?: LocationError['type']
): LocationError {
  if (error) {
    switch (error.code) {
      case GeolocationPositionError.PERMISSION_DENIED:
        return {
          code: error.code,
          message: 'Location permission denied by user',
          type: 'PERMISSION_DENIED',
        };
      case GeolocationPositionError.POSITION_UNAVAILABLE:
        return {
          code: error.code,
          message: 'Location information is unavailable',
          type: 'POSITION_UNAVAILABLE',
        };
      case GeolocationPositionError.TIMEOUT:
        return {
          code: error.code,
          message: 'Location request timed out',
          type: 'TIMEOUT',
        };
      default:
        return {
          code: error.code,
          message: error.message || 'Unknown location error',
          type: 'POSITION_UNAVAILABLE',
        };
    }
  }
  
  return {
    code: -1,
    message: message || 'Unknown error',
    type: type || 'NOT_SUPPORTED',
  };
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Hook for React components to manage location state
 */
export interface UseLocationState {
  location: LocationCoordinates | null;
  loading: boolean;
  error: LocationError | null;
  permissionStatus: LocationPermissionStatus;
  getCurrentLocation: (accuracy?: LocationAccuracy) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  startWatching: (accuracy?: LocationAccuracy) => void;
  stopWatching: () => void;
  clearError: () => void;
}

// This would typically be implemented as a React hook, but since we're in utils,
// we'll provide the interface for components to implement
export function createLocationManager(): {
  getCurrentLocation: typeof getCurrentLocation;
  requestPermission: typeof requestLocationPermission;
  watchLocation: typeof watchLocation;
  stopWatching: typeof stopWatchingLocation;
  getPermissionStatus: typeof getLocationPermissionStatus;
  calculateDistance: typeof calculateDistance;
  formatDistance: typeof formatDistance;
  isLocationStale: typeof isLocationStale;
} {
  return {
    getCurrentLocation,
    requestPermission: requestLocationPermission,
    watchLocation,
    stopWatching: stopWatchingLocation,
    getPermissionStatus: getLocationPermissionStatus,
    calculateDistance,
    formatDistance,
    isLocationStale,
  };
}
/**
 * Location service client for communicating with the discovery service location endpoints
 */

import { LocationCoordinates } from '../utils/locationUtils';

// Base URL for discovery service API
const DISCOVERY_API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api/v1/discovery' 
  : 'http://localhost:8083/api/v1';

export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  country?: string;
  privacy?: 'exact' | 'approximate' | 'city' | 'friends_only' | 'ghost';
  source?: 'gps' | 'wifi' | 'ip' | 'manual';
}

export interface LocationUpdateResponse {
  message: string;
  location: {
    id: string;
    user_id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    city?: string;
    country?: string;
    privacy: string;
    source: string;
    updated_at: string;
    created_at: string;
  };
}

export interface NearbyUsersRequest {
  lat: number;
  lng: number;
  radius?: number; // in kilometers
  limit?: number;
  exclude_users?: string[];
}

export interface NearbyUser {
  user_id: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
  city?: string;
  country?: string;
  privacy: string;
  distance_km?: number;
  is_stale: boolean;
  last_updated?: string;
  is_available: boolean;
  last_available_at?: string;
}

export interface NearbyUsersResponse {
  users: NearbyUser[];
  meta: {
    count: number;
    radius_km: number;
    center: {
      latitude: number;
      longitude: number;
    };
  };
}

export interface LocationPreferences {
  user_id: string;
  default_privacy: 'exact' | 'approximate' | 'city' | 'friends_only' | 'ghost';
  max_distance: number;
  auto_update_location: boolean;
  share_with_friends_only: boolean;
  notify_nearby_users: boolean;
  location_history_retain: number;
  created_at: string;
  updated_at: string;
}

export interface LocationPreferencesResponse {
  preferences: LocationPreferences;
}

export interface LocationHistoryEntry {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  privacy_level: string;
  source: string;
  created_at: string;
}

export interface LocationHistoryResponse {
  history: LocationHistoryEntry[];
  meta: {
    page: number;
    limit: number;
    count: number;
  };
}

export interface DistanceResponse {
  distance_km: number;
  from_user: string;
  to_user: string;
}

export interface LocationError extends Error {
  code?: string;
  status?: number;
}

/**
 * Location service client class
 */
export class LocationServiceClient {
  private baseURL: string;

  constructor(baseURL: string = DISCOVERY_API_BASE) {
    this.baseURL = baseURL;
  }

  /**
   * Updates the current user's location
   */
  async updateLocation(request: LocationUpdateRequest): Promise<LocationUpdateResponse> {
    const response = await this.fetch('/location/update', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Gets nearby users based on location
   */
  async getNearbyUsers(request: NearbyUsersRequest): Promise<NearbyUsersResponse> {
    const params = new URLSearchParams({
      lat: request.lat.toString(),
      lng: request.lng.toString(),
    });

    if (request.radius !== undefined) {
      params.append('radius', request.radius.toString());
    }
    if (request.limit !== undefined) {
      params.append('limit', request.limit.toString());
    }
    if (request.exclude_users && request.exclude_users.length > 0) {
      params.append('exclude_users', request.exclude_users.join(','));
    }

    const response = await this.fetch(`/users/nearby?${params}`);

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Gets the current user's location preferences
   */
  async getLocationPreferences(): Promise<LocationPreferencesResponse> {
    const response = await this.fetch('/preferences');

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Updates the current user's location preferences
   */
  async updateLocationPreferences(preferences: Partial<LocationPreferences>): Promise<void> {
    const response = await this.fetch('/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      throw await this.createError(response);
    }
  }

  /**
   * Gets the current user's location history
   */
  async getLocationHistory(page = 1, limit = 20): Promise<LocationHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await this.fetch(`/location/history?${params}`);

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Estimates distance between current user and another user
   */
  async estimateDistance(targetUserId: string): Promise<DistanceResponse> {
    const response = await this.fetch(`/distance/${targetUserId}`);

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Checks if the location service is healthy
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    const response = await this.fetch('/location/health');

    if (!response.ok) {
      throw await this.createError(response);
    }

    return response.json();
  }

  /**
   * Generic fetch wrapper with authentication and error handling
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get auth token from localStorage or context
    const token = localStorage.getItem('auth_token');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      return response;
    } catch (error) {
      throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a LocationError from a failed response
   */
  private async createError(response: Response): Promise<LocationError> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code = response.status.toString();

    try {
      const errorData = await response.json();
      if (errorData.error) {
        message = errorData.error;
      }
      if (errorData.code) {
        code = errorData.code;
      }
    } catch {
      // Ignore JSON parsing errors, use default message
    }

    const error = new Error(message) as LocationError;
    error.status = response.status;
    error.code = code;
    error.name = 'LocationError';

    return error;
  }
}

// Singleton instance
const locationClient = new LocationServiceClient();
export default locationClient;

// Convenience functions for direct use
export const updateUserLocation = (request: LocationUpdateRequest) => 
  locationClient.updateLocation(request);

export const getNearbyUsers = (request: NearbyUsersRequest) => 
  locationClient.getNearbyUsers(request);

export const getLocationPreferences = () => 
  locationClient.getLocationPreferences();

export const updateLocationPreferences = (preferences: Partial<LocationPreferences>) => 
  locationClient.updateLocationPreferences(preferences);

export const getLocationHistory = (page?: number, limit?: number) => 
  locationClient.getLocationHistory(page, limit);

export const estimateDistance = (targetUserId: string) => 
  locationClient.estimateDistance(targetUserId);

export const checkLocationServiceHealth = () => 
  locationClient.healthCheck();

// Utility functions

/**
 * Converts browser geolocation coordinates to location update request
 */
export function coordinatesToLocationUpdate(
  coords: LocationCoordinates,
  privacy: LocationUpdateRequest['privacy'] = 'approximate',
  source: LocationUpdateRequest['source'] = 'gps'
): LocationUpdateRequest {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    privacy,
    source,
  };
}

/**
 * Checks if location update is rate limited error
 */
export function isRateLimitedError(error: unknown): boolean {
  return error instanceof Error && 
    (error as LocationError).status === 429;
}

/**
 * Checks if location permission is denied error
 */
export function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof Error && 
    (error as LocationError).status === 403;
}

/**
 * Checks if location is not found error
 */
export function isLocationNotFoundError(error: unknown): boolean {
  return error instanceof Error && 
    (error as LocationError).status === 404;
}

/**
 * Gets user-friendly error message for location errors
 */
export function getLocationErrorMessage(error: unknown): string {
  if (!error || !(error instanceof Error)) {
    return 'An unknown error occurred';
  }

  const locationError = error as LocationError;

  switch (locationError.status) {
    case 400:
      return 'Invalid location data provided';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Location access denied';
    case 404:
      return 'Location not found';
    case 429:
      return 'Too many location updates. Please wait before trying again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return locationError.message || 'Location service error';
  }
}

/**
 * Validates location coordinates
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  );
}

/**
 * Formats location update response for display
 */
export function formatLocationUpdate(response: LocationUpdateResponse): string {
  const { location } = response;
  const accuracy = location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : '';
  const address = location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  
  return `Location updated: ${address}${accuracy}`;
}
// Broadcast service layer for API interactions
// Provides functions to create, update, and delete user broadcasts

import { apiClient, AuthServiceError, ApiError, getErrorMessage } from './authService';
import { User } from '../types';

// Base API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';

// API endpoints
const BROADCAST_ENDPOINTS = {
  createBroadcast: '/api/users/broadcast',
  updateBroadcast: '/api/users/broadcast',
  deleteBroadcast: '/api/users/broadcast',
} as const;

// Request/Response types
export interface CreateBroadcastRequest {
  message: string;
}

export interface UpdateBroadcastRequest {
  message: string;
}

export interface BroadcastResponse {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface UserWithBroadcast extends Omit<User, 'broadcast'> {
  broadcast: string;
}

// Broadcast service functions

/**
 * Create a new broadcast for the current user
 * @param broadcastData Broadcast message data
 * @returns Promise resolving to broadcast data and updated user info
 * @throws AuthServiceError with detailed error information
 */
export async function createBroadcast(broadcastData: CreateBroadcastRequest): Promise<BroadcastResponse> {
  try {
    const response = await apiClient.post<BroadcastResponse>(BROADCAST_ENDPOINTS.createBroadcast, {
      message: broadcastData.message.trim(),
    });
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to create broadcast due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Update an existing broadcast for the current user
 * @param broadcastData Updated broadcast message data
 * @returns Promise resolving to updated broadcast data
 * @throws AuthServiceError with detailed error information
 */
export async function updateBroadcast(broadcastData: UpdateBroadcastRequest): Promise<BroadcastResponse> {
  try {
    const response = await apiClient.post<BroadcastResponse>(BROADCAST_ENDPOINTS.updateBroadcast, {
      message: broadcastData.message.trim(),
    });
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to update broadcast due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Delete the current user's broadcast
 * @returns Promise resolving when deletion is complete
 * @throws AuthServiceError with detailed error information
 */
export async function deleteBroadcast(): Promise<void> {
  try {
    await apiClient.delete(BROADCAST_ENDPOINTS.deleteBroadcast);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to delete broadcast due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Helper function to check if error is broadcast-related
export function isBroadcastError(error: unknown): error is AuthServiceError {
  return error instanceof AuthServiceError;
}

// Helper function to get user-friendly broadcast error messages
export function getBroadcastErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      if (error.message.toLowerCase().includes('message')) {
        return 'Broadcast message is invalid. Please check the length and content.';
      }
      return getErrorMessage(error);
    case 'RATE_LIMIT_ERROR':
      return 'You\'re updating your broadcast too frequently. Please wait a moment before trying again.';
    default:
      return getErrorMessage(error);
  }
}

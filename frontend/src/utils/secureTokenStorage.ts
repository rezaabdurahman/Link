// secureTokenStorage.ts - JWT token persistence with encryption and SSR fallback
// Provides secure token storage with encryption and fallback to in-memory storage

import { AuthToken } from '../types';

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'link_auth_token',
  REFRESH_TOKEN: 'link_refresh_token',
} as const;

// In-memory storage fallback for SSR or private mode
interface InMemoryStorage {
  authToken: string | null;
  refreshToken: string | null;
}

const inMemoryStorage: InMemoryStorage = {
  authToken: null,
  refreshToken: null,
};

// Check if we're in a browser environment with localStorage support
const isLocalStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    // Test localStorage access (might fail in private mode)
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

// Check if Web Crypto API is available
const isCryptoAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 
           typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined';
  } catch {
    return false;
  }
};

// Encryption utilities using Web Crypto API
class TokenEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static encryptionKey: CryptoKey | null = null;

  /**
   * Generate or retrieve encryption key
   */
  private static async getOrCreateKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    try {
      // Try to get existing key from storage
      if (isLocalStorageAvailable()) {
        const keyData = localStorage.getItem('__token_key__');
        if (keyData) {
          const rawKey = new Uint8Array(JSON.parse(keyData));
          this.encryptionKey = await crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: this.ALGORITHM },
            false,
            ['encrypt', 'decrypt']
          );
          return this.encryptionKey;
        }
      }
    } catch {
      // Fall through to generate new key
    }

    // Generate new key
    this.encryptionKey = await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );

    // Store key for future use
    try {
      if (isLocalStorageAvailable()) {
        const rawKey = await crypto.subtle.exportKey('raw', this.encryptionKey);
        localStorage.setItem('__token_key__', JSON.stringify(Array.from(new Uint8Array(rawKey))));
      }
    } catch {
      // Key storage failed, but we can still use the in-memory key
    }

    return this.encryptionKey;
  }

  /**
   * Encrypt a token string
   */
  static async encrypt(data: string): Promise<string> {
    if (!isCryptoAvailable()) {
      return data; // Fallback to plain text if crypto is not available
    }
    
    try {
      const key = await this.getOrCreateKey();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
      const encodedData = new TextEncoder().encode(data);

      const encryptedData = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        encodedData
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Return base64 encoded result
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn('Token encryption failed, storing in plain text:', error);
      return data; // Fallback to plain text
    }
  }

  /**
   * Decrypt a token string
   */
  static async decrypt(encryptedData: string): Promise<string> {
    if (!isCryptoAvailable()) {
      return encryptedData; // Return as-is if crypto is not available
    }
    
    try {
      const key = await this.getOrCreateKey();
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decryptedData = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.warn('Token decryption failed, assuming plain text:', error);
      return encryptedData; // Fallback to assuming plain text
    }
  }
}

// Internal class for token operations
class SecureTokenStorageImpl {
  /**
   * Store authentication token securely
   * @param token - The authentication token to store
   */
  static async setToken(token: AuthToken): Promise<void> {
    try {
      const tokenData = {
        ...token,
        storedAt: new Date().toISOString(),
      };
      
      const stringifiedToken = JSON.stringify(tokenData);
      const secureToken = await TokenEncryption.encrypt(stringifiedToken);
      
      if (isLocalStorageAvailable()) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, secureToken);
      } else {
        inMemoryStorage.authToken = secureToken;
      }
    } catch (error) {
      console.error('Failed to store authentication token:', error);
      // Continue without storage if fails
    }
  }

  /**
   * Retrieve authentication token with automatic expiry validation
   * @returns Valid token or null if expired/invalid
   */
  static async getToken(): Promise<AuthToken | null> {
    try {
      let tokenJson: string | null = null;
      
      if (isLocalStorageAvailable()) {
        tokenJson = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      } else {
        tokenJson = inMemoryStorage.authToken;
      }
      
      if (!tokenJson) return null;
      
      // Decrypt token if encrypted
      const decryptedToken = await TokenEncryption.decrypt(tokenJson);
      const tokenData = JSON.parse(decryptedToken);
      
      // Validate token structure
      if (!tokenData.token || !tokenData.expiresAt) {
        this.clearToken();
        return null;
      }

      // Check if token is expired (with 5-minute buffer)
      const expirationTime = new Date(tokenData.expiresAt).getTime();
      const currentTime = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes

      if (expirationTime <= (currentTime + bufferTime)) {
        this.clearToken();
        return null;
      }

      // Return valid token
      return {
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        tokenType: tokenData.tokenType || 'Bearer',
        issuedAt: tokenData.issuedAt,
      };
    } catch (error) {
      console.error('Failed to retrieve authentication token:', error);
      this.clearToken();
      return null;
    }
  }

  /**
   * Check if the token is expired
   * @returns True if token is expired or invalid
   */
  static async isExpired(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return true;

    const expirationTime = new Date(token.expiresAt).getTime();
    const currentTime = Date.now();
    
    return expirationTime <= currentTime;
  }

  /**
   * Clear authentication token from storage
   */
  static clearToken(): void {
    try {
      if (isLocalStorageAvailable()) {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
      inMemoryStorage.authToken = null;
    } catch (error) {
      console.error('Failed to clear authentication token:', error);
    }
  }

  /**
   * Clear refresh token from storage
   */
  static clearRefreshToken(): void {
    try {
      if (isLocalStorageAvailable()) {
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
      inMemoryStorage.refreshToken = null;
    } catch (error) {
      console.error('Failed to clear refresh token:', error);
    }
  }

  /**
   * Clear all authentication data from storage
   */
  static clearAll(): void {
    this.clearToken();
    this.clearRefreshToken();
  }
}

// Export the required functions as specified in the task
/**
 * Store authentication token securely with encryption
 * @param token - The authentication token to store
 */
export const setToken = (token: AuthToken): Promise<void> => {
  return SecureTokenStorageImpl.setToken(token);
};

/**
 * Retrieve authentication token with automatic expiry validation
 * @returns Valid token or null if expired/invalid
 */
export const getToken = (): Promise<AuthToken | null> => {
  return SecureTokenStorageImpl.getToken();
};

/**
 * Clear authentication token from storage
 */
export const clearToken = (): void => {
  SecureTokenStorageImpl.clearToken();
};

/**
 * Check if the token is expired
 * @returns True if token is expired or invalid
 */
export const isExpired = (): Promise<boolean> => {
  return SecureTokenStorageImpl.isExpired();
};

/**
 * Clear all authentication data from storage
 */
export const clearAll = (): void => {
  SecureTokenStorageImpl.clearAll();
};

// Default export with the four main functions
export default {
  setToken,
  getToken,
  clearToken,
  isExpired,
  clearAll,
};

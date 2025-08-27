// Montage types matching backend API response structure

/**
 * Widget metadata for different types of montage items
 */
export interface MontageWidgetMetadata {
  // Media widget metadata
  media_url?: string;
  media_type?: 'image' | 'video';
  thumbnail_url?: string;
  duration?: number; // For videos, duration in seconds
  
  // Common metadata
  tags?: string[];
  description?: string;
  location?: string;
  timestamp?: string; // ISO string format
  
  // Additional metadata fields that might be added later
  [key: string]: unknown;
}

/**
 * Individual montage item representing a widget from a check-in
 */
export interface MontageItem {
  readonly checkin_id: string;
  readonly widget_type: 'media' | 'text' | 'location' | 'activity' | 'mood';
  readonly widget_metadata: MontageWidgetMetadata;
  readonly created_at: string; // ISO string format
}

/**
 * Montage metadata with generation and pagination info
 */
export interface MontageMetadata {
  readonly total_count: number;
  readonly page_size: number;
  readonly generated_at: string; // ISO string format
  readonly next_cursor?: string; // For cursor-based pagination
  readonly has_more: boolean;
}

/**
 * Complete montage response from the API
 */
export interface MontageResponse {
  readonly type: 'general' | 'interest';
  readonly items: MontageItem[];
  readonly metadata: MontageMetadata;
  readonly user_id: string;
  readonly interest?: string; // Present for interest-based montages
}

/**
 * Montage regeneration response
 */
export interface MontageRegenerateResponse {
  readonly message: string;
  readonly user_id: string;
  readonly timestamp: string; // ISO string format
}

/**
 * Montage deletion response
 */
export interface MontageDeleteResponse {
  readonly message: string;
  readonly user_id: string;
}

/**
 * Options for fetching montages
 */
export interface MontageOptions {
  readonly interest?: string; // Filter by specific interest
  readonly cursor?: string; // For pagination
  readonly limit?: number; // Page size (default: backend defined)
}

/**
 * SWR key structure for montage data
 * Used internally by the useMontage hook
 */
export interface MontageKey {
  readonly type: 'montage';
  readonly userId: string;
  readonly interest?: string;
  readonly cursor?: string;
}

/**
 * Extended montage data with loading/error states for the hook
 */
export interface MontageHookData {
  readonly items: MontageItem[];
  readonly metadata: MontageMetadata | null;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

/**
 * Error response structure for montage operations
 */
export interface MontageErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Type guards for montage data validation
 */
export function isMontageResponse(data: unknown): data is MontageResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'items' in data &&
    'metadata' in data &&
    'user_id' in data &&
    Array.isArray((data as any).items)
  );
}

export function isMontageItem(item: unknown): item is MontageItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'checkin_id' in item &&
    'widget_type' in item &&
    'widget_metadata' in item &&
    'created_at' in item
  );
}

/**
 * Helper to create a montage SWR key
 */
export function createMontageKey(userId: string, options?: Omit<MontageOptions, 'limit'>): MontageKey {
  return {
    type: 'montage',
    userId,
    ...(options?.interest && { interest: options.interest }),
    ...(options?.cursor && { cursor: options.cursor }),
  };
}

/**
 * Helper to serialize montage key for SWR
 */
export function serializeMontageKey(key: MontageKey): string {
  const parts = [key.type, key.userId];
  
  if (key.interest) {
    parts.push('interest', key.interest);
  }
  
  if (key.cursor) {
    parts.push('cursor', key.cursor);
  }
  
  return parts.join(':');
}

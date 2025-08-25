// File upload service for handling media, files, and voice notes
// Provides secure upload functionality with progress tracking

import { /* apiClient, */ AuthServiceError, ApiError, getErrorMessage } from './authClient';  // TODO: apiClient will be used for future upload API integration

// Extended API error type for upload-specific errors
export type UploadApiError = ApiError | {
  type: 'UPLOAD_ERROR';
  message: string;
  code: 'UPLOAD_FAILED' | 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'EMPTY_FILE' | 'INVALID_RESPONSE' | 'TIMEOUT';
};

// Helper to create upload-specific errors
function createUploadError(code: 'UPLOAD_FAILED' | 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'EMPTY_FILE' | 'INVALID_RESPONSE' | 'TIMEOUT', message: string): AuthServiceError {
  return new AuthServiceError({
    type: 'UPLOAD_ERROR' as any,
    message,
    code: code as any,
  });
}

// Upload endpoints
const UPLOAD_ENDPOINTS = {
  media: '/uploads/media',
  files: '/uploads/files', 
  voice: '/uploads/voice',
  avatar: '/uploads/avatar',
} as const;

// Types for upload responses
export interface UploadResponse {
  id: string;
  file_name: string;
  file_url: string;
  thumbnail_url?: string;
  file_size: number;
  mime_type: string;
  upload_timestamp: string;
}

export interface MediaUploadResponse extends UploadResponse {
  media_type: 'image' | 'video';
  duration_seconds?: number; // For videos
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface VoiceUploadResponse extends UploadResponse {
  duration_seconds: number;
  waveform_data?: number[]; // Audio waveform for visualization
}

// Upload progress callback type
export type UploadProgressCallback = (progress: number) => void;

// Upload options
export interface UploadOptions {
  onProgress?: UploadProgressCallback;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[]; // MIME types
  generateThumbnail?: boolean; // For images/videos
}

// Default options
const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
  maxFileSize: 50 * 1024 * 1024, // 50MB default
  generateThumbnail: true,
};

/**
 * Upload media file (image or video)
 * @param file - The file to upload
 * @param options - Upload configuration options
 * @returns Promise resolving to upload response with media metadata
 */
export async function uploadMedia(
  file: File,
  options: UploadOptions = {}
): Promise<MediaUploadResponse> {
  try {
    // Merge with default options
    const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
    
    // Validate file
    await validateFile(file, opts);
    
    // Determine media type
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    
    if (opts.generateThumbnail) {
      formData.append('generate_thumbnail', 'true');
    }
    
    // Upload with progress tracking
    const response = await uploadWithProgress<MediaUploadResponse>(
      UPLOAD_ENDPOINTS.media,
      formData,
      opts.onProgress
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw createUploadError('UPLOAD_FAILED', 'Failed to upload media file');
  }
}

/**
 * Upload general file attachment
 * @param file - The file to upload
 * @param options - Upload configuration options
 * @returns Promise resolving to upload response
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResponse> {
  try {
    // Merge with default options
    const opts = { 
      ...DEFAULT_UPLOAD_OPTIONS, 
      maxFileSize: 10 * 1024 * 1024, // 10MB for general files
      ...options 
    };
    
    // Validate file
    await validateFile(file, opts);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Upload with progress tracking
    const response = await uploadWithProgress<UploadResponse>(
      UPLOAD_ENDPOINTS.files,
      formData,
      opts.onProgress
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw createUploadError('UPLOAD_FAILED', 'Failed to upload file');
  }
}

/**
 * Upload voice note
 * @param file - The audio file to upload
 * @param options - Upload configuration options
 * @returns Promise resolving to voice upload response with audio metadata
 */
export async function uploadVoiceNote(
  file: File,
  options: UploadOptions = {}
): Promise<VoiceUploadResponse> {
  try {
    // Merge with default options
    const opts = { 
      ...DEFAULT_UPLOAD_OPTIONS,
      maxFileSize: 5 * 1024 * 1024, // 5MB for voice notes
      allowedTypes: ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg'],
      ...options 
    };
    
    // Validate file
    await validateFile(file, opts);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('generate_waveform', 'true'); // Generate waveform for UI
    
    // Upload with progress tracking
    const response = await uploadWithProgress<VoiceUploadResponse>(
      UPLOAD_ENDPOINTS.voice,
      formData,
      opts.onProgress
    );
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    
    throw createUploadError('UPLOAD_FAILED', 'Failed to upload voice note');
  }
}

/**
 * Upload multiple files concurrently with individual progress tracking
 * @param files - Array of files to upload
 * @param uploadFn - Upload function to use for each file
 * @param onProgress - Progress callback that receives (fileIndex, progress)
 * @returns Promise resolving to array of upload responses
 */
export async function uploadMultipleFiles<T extends UploadResponse>(
  files: File[],
  uploadFn: (file: File, options?: UploadOptions) => Promise<T>,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<T[]> {
  const uploads = files.map((file, index) => {
    const options: UploadOptions = {
      onProgress: onProgress ? (progress) => onProgress(index, progress) : undefined,
    };
    
    return uploadFn(file, options);
  });
  
  try {
    const results = await Promise.all(uploads);
    return results;
  } catch (error) {
    // If any upload fails, we still return partial results
    // The UI should handle individual file failures
    throw error;
  }
}

// Utility functions

/**
 * Generic upload function with progress tracking
 */
async function uploadWithProgress<T>(
  endpoint: string,
  formData: FormData,
  onProgress?: UploadProgressCallback
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Set up progress tracking
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });
    }
    
    // Set up response handlers
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new AuthServiceError({
            type: 'SERVER_ERROR',
            message: 'Invalid response format from upload service',
            code: 'INTERNAL_SERVER_ERROR',
          }));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          reject(new AuthServiceError({
            type: 'SERVER_ERROR',
            message: errorResponse.message || 'Upload failed',
            code: errorResponse.code || 'INTERNAL_SERVER_ERROR',
          }));
        } catch (error) {
          reject(new AuthServiceError({
            type: 'SERVER_ERROR',
            message: `Upload failed with status ${xhr.status}`,
            code: 'INTERNAL_SERVER_ERROR',
          }));
        }
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new AuthServiceError({
        type: 'NETWORK_ERROR',
        message: 'Network error during upload',
        code: 'CONNECTION_FAILED',
      }));
    });
    
    xhr.addEventListener('timeout', () => {
      reject(new AuthServiceError({
        type: 'NETWORK_ERROR',
        message: 'Upload timed out',
        code: 'TIMEOUT',
      }));
    });
    
    // Configure and send request
    xhr.timeout = 60000; // 60 second timeout
    xhr.open('POST', endpoint);
    
    // Add auth header if available
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.send(formData);
  });
}

/**
 * Validate file before upload
 */
async function validateFile(file: File, options: UploadOptions): Promise<void> {
  // Check file size
  if (options.maxFileSize && file.size > options.maxFileSize) {
    throw createUploadError('FILE_TOO_LARGE', `File size exceeds maximum limit of ${formatFileSize(options.maxFileSize)}`);
  }
  
  // Check file type
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw createUploadError('INVALID_FILE_TYPE', `File type ${file.type} is not allowed`);
  }
  
  // Check if file is empty
  if (file.size === 0) {
    throw createUploadError('EMPTY_FILE', 'Cannot upload empty file');
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create a preview URL for a file (for images)
 */
export function createFilePreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Clean up preview URLs to prevent memory leaks
 */
export function revokeFilePreview(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Get file type category
 */
export function getFileCategory(file: File): 'image' | 'video' | 'audio' | 'document' | 'other' {
  const type = file.type.toLowerCase();
  
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ];
  
  if (documentTypes.includes(type)) return 'document';
  
  return 'other';
}

// Error handling helpers
export function getUploadErrorMessage(error: UploadApiError): string {
  // Handle upload-specific errors
  if (error.type === 'UPLOAD_ERROR') {
    switch (error.code) {
      case 'FILE_TOO_LARGE':
        return 'File is too large to upload';
      case 'INVALID_FILE_TYPE':
        return 'This file type is not supported';
      case 'EMPTY_FILE':
        return 'Cannot upload empty file';
      case 'UPLOAD_FAILED':
        return 'Upload failed. Please try again.';
      case 'INVALID_RESPONSE':
        return 'Upload failed due to server error. Please try again.';
      case 'TIMEOUT':
        return 'Upload timed out. Please try again with a smaller file.';
    }
  }
  
  // Handle standard API errors
  switch (error.code) {
    case 'CONNECTION_FAILED':
      return 'Network error. Please check your connection.';
    case 'TIMEOUT':
      return 'Upload timed out. Please try again with a smaller file.';
    default:
      return getErrorMessage(error as ApiError);
  }
}

// Re-export shared utilities
export { AuthServiceError, getErrorMessage } from './authClient';
export type { ApiError } from './authClient';
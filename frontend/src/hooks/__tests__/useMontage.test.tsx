// Unit tests for the useMontage hook
// Tests SWR integration, pagination, error handling, and actions

import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import { useMontage, useMontagePreview } from '../useMontage';
import * as montageClient from '../../services/montageClient';
import { MontageResponse, MontageItem } from '../../types/montage';
import { AuthServiceError } from '../../services/authClient';

// Mock the montage client
jest.mock('../../services/montageClient');

const mockMontageClient = montageClient as jest.Mocked<typeof montageClient>;

// Mock data
const mockMontageItem: MontageItem = {
  checkin_id: 'checkin-123',
  widget_type: 'media',
  widget_metadata: {
    media_url: 'https://example.com/image.jpg',
    media_type: 'image',
    tags: ['coffee', 'morning'],
    timestamp: '2024-01-15T08:00:00Z',
  },
  created_at: '2024-01-15T08:00:00Z',
};

const mockMontageResponse: MontageResponse = {
  type: 'general',
  items: [mockMontageItem],
  metadata: {
    total_count: 25,
    page_size: 20,
    generated_at: '2024-01-15T09:00:00Z',
    next_cursor: 'cursor-123',
    has_more: true,
  },
  user_id: 'user-123',
};

const mockSecondPageResponse: MontageResponse = {
  type: 'general',
  items: [{
    ...mockMontageItem,
    checkin_id: 'checkin-456',
  }],
  metadata: {
    total_count: 25,
    page_size: 20,
    generated_at: '2024-01-15T09:00:00Z',
    has_more: false,
  },
  user_id: 'user-123',
};

// SWR Provider wrapper for tests
const createWrapper = () => ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
    {children}
  </SWRConfig>
);

describe('useMontage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMontageClient.fetchMontage.mockResolvedValue(mockMontageResponse);
  });

  describe('Initial data fetching', () => {
    it('should fetch montage data for a user', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.items).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockMontageClient.fetchMontage).toHaveBeenCalledWith('user-123', {});
      expect(result.current.items).toEqual([mockMontageItem]);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should fetch montage data with interest filter', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123', 'coffee'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockMontageClient.fetchMontage).toHaveBeenCalledWith('user-123', { interest: 'coffee' });
      expect(result.current.items).toEqual([mockMontageItem]);
    });

    it('should not fetch when userId is empty', () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage(''),
        { wrapper }
      );

      expect(mockMontageClient.fetchMontage).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const mockError = new AuthServiceError({
        type: 'SERVER_ERROR',
        message: 'Failed to fetch montage',
        code: 'INTERNAL_SERVER_ERROR',
      });

      mockMontageClient.fetchMontage.mockRejectedValue(mockError);
      mockMontageClient.getMontageErrorMessage.mockReturnValue('Failed to fetch montage');

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch montage');
      expect(result.current.items).toEqual([]);
    });

    it('should identify permission errors', async () => {
      const mockError = new AuthServiceError({
        type: 'AUTHORIZATION_ERROR',
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      });

      mockMontageClient.fetchMontage.mockRejectedValue(mockError);
      mockMontageClient.isMontagePermissionError.mockReturnValue(true);
      mockMontageClient.getMontageErrorMessage.mockReturnValue('Access denied');

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isPermissionError).toBe(true);
      expect(result.current.error).toBe('Access denied');
    });
  });

  describe('Pagination (loadMore)', () => {
    it('should load more items when available', async () => {
      mockMontageClient.fetchMontage
        .mockResolvedValueOnce(mockMontageResponse)
        .mockResolvedValueOnce(mockSecondPageResponse);

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);

      // Load more
      act(() => {
        result.current.loadMore();
      });

      expect(result.current.isLoadingMore).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });

      expect(mockMontageClient.fetchMontage).toHaveBeenCalledTimes(2);
      expect(mockMontageClient.fetchMontage).toHaveBeenLastCalledWith('user-123', {
        cursor: 'cursor-123',
        limit: 20,
      });
      
      expect(result.current.items).toHaveLength(2);
      expect(result.current.hasMore).toBe(false);
    });

    it('should not load more when no more items available', async () => {
      const noMoreResponse = {
        ...mockMontageResponse,
        metadata: {
          ...mockMontageResponse.metadata,
          has_more: false,
          next_cursor: undefined,
        },
      };

      mockMontageClient.fetchMontage.mockResolvedValue(noMoreResponse);

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false);

      // Try to load more (should not make API call)
      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockMontageClient.fetchMontage).toHaveBeenCalledTimes(1);
      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  describe('Actions', () => {
    it('should refresh data', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear the mock to count fresh calls
      mockMontageClient.fetchMontage.mockClear();

      await act(async () => {
        await result.current.refresh();
      });

      // Should refetch data
      expect(mockMontageClient.fetchMontage).toHaveBeenCalledWith('user-123', {});
    });

    it('should regenerate montage', async () => {
      mockMontageClient.regenerateMontage.mockResolvedValue({
        message: 'Montage regenerated successfully',
        user_id: 'user-123',
        timestamp: '2024-01-15T10:00:00Z',
      });

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.regenerate();
      });

      expect(mockMontageClient.regenerateMontage).toHaveBeenCalledWith('user-123', undefined);
      expect(result.current.isRegenerating).toBe(false);
    });

    it('should delete montage', async () => {
      mockMontageClient.deleteMontage.mockResolvedValue({
        message: 'Montage deleted successfully',
        user_id: 'user-123',
      });

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMontage('user-123'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.remove();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual([]);
        expect(result.current.hasMore).toBe(false);
      });

      expect(mockMontageClient.deleteMontage).toHaveBeenCalledWith('user-123', undefined);
      expect(result.current.isDeleting).toBe(false);
    });
  });
});

describe('useMontagePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    const manyItems: MontageItem[] = Array.from({ length: 10 }, (_, i) => ({
      ...mockMontageItem,
      checkin_id: `checkin-${i}`,
    }));

    mockMontageClient.fetchMontage.mockResolvedValue({
      ...mockMontageResponse,
      items: manyItems,
    });
  });

  it('should limit items to specified count', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useMontagePreview('user-123', undefined, 3),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(3);
    expect(mockMontageClient.fetchMontage).toHaveBeenCalledWith('user-123', {});
  });

  it('should use default limit of 5', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useMontagePreview('user-123'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(5);
  });
});

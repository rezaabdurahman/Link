// Mock helpers and utilities
import { jest } from '@jest/globals';

/**
 * Mock localStorage for tests
 */
export const mockLocalStorage = (): void => {
  const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: jest.fn((key: string) => localStorageMock.store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      localStorageMock.store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete localStorageMock.store[key];
    }),
    clear: jest.fn(() => {
      localStorageMock.store = {};
    })
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
};

/**
 * Mock window.matchMedia for tests
 */
export const mockMatchMedia = (): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

/**
 * Mock IntersectionObserver for tests
 */
export const mockIntersectionObserver = (): void => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
};

/**
 * Setup common mocks for all tests
 */
export const setupCommonMocks = (): void => {
  mockLocalStorage();
  mockMatchMedia();
  mockIntersectionObserver();
};

/**
 * Create a mock function with TypeScript support
 */
export const createMockFn = <T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> => {
  return jest.fn(implementation) as unknown as jest.MockedFunction<T>;
};

/**
 * Wait for async operations to complete
 */
export const waitForAsync = (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 0));
};
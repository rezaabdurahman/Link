// Test utilities with proper React Router configuration and act() wrapping
// This file provides standardized testing helpers to avoid common pitfalls

import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Router configuration with future flags to suppress warnings
const routerConfig = {
  future: {
    v7_relativeSplatPath: true,
  },
};

interface TestRouterOptions {
  initialEntries?: string[];
  initialIndex?: number;
}

/**
 * Creates a test router with proper future flags configuration
 */
export function createTestRouter(
  routes: Array<{ path: string; element: React.ReactElement }>,
  options: TestRouterOptions = {}
) {
  return createMemoryRouter(routes, {
    ...routerConfig,
    initialEntries: options.initialEntries || ['/'],
    initialIndex: options.initialIndex || 0,
  });
}

/**
 * Test wrapper component that provides all necessary context providers
 */
export const TestWrapper: React.FC<{
  children: React.ReactNode;
  routerOptions?: TestRouterOptions;
}> = ({ children, routerOptions = {} }) => {
  const router = createTestRouter(
    [{ 
      path: '*', 
      element: (
        <AuthProvider>
          {children}
        </AuthProvider>
      )
    }],
    routerOptions
  );

  return (
    <RouterProvider router={router} />
  );
};

/**
 * Custom render function that wraps components with test providers
 */
export function renderWithProviders(
  component: React.ReactElement,
  options: {
    routerOptions?: TestRouterOptions;
  } = {}
): RenderResult {
  return render(
    <TestWrapper routerOptions={options.routerOptions}>
      {component}
    </TestWrapper>
  );
}

/**
 * Async helper to wait for auth initialization to complete
 * This helps avoid act() warnings by properly waiting for async state updates
 */
export const waitForAuthInitialization = async (): Promise<void> => {
  // Wait for auth context initialization (longer timeout for slow systems)
  await new Promise(resolve => setTimeout(resolve, 150));
};

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Render helpers for different testing scenarios
import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { TestWrapper } from '../test-utils';

export interface TestRenderOptions {
  initialRoute?: string;
  preloadedState?: any;
  withAuth?: boolean;
  withRouter?: boolean;
}

/**
 * Render component with minimal providers (for unit tests)
 */
export function renderComponent(
  component: React.ReactElement,
  options: Omit<TestRenderOptions, 'withAuth' | 'withRouter'> = {}
): RenderResult {
  return render(component);
}

/**
 * Render component with all providers (for integration tests)
 */
export function renderWithAllProviders(
  component: React.ReactElement,
  options: TestRenderOptions = {}
): RenderResult {
  const routerOptions = options.initialRoute 
    ? { initialEntries: [options.initialRoute] }
    : undefined;

  return render(
    <TestWrapper routerOptions={routerOptions}>
      {component}
    </TestWrapper>
  );
}

/**
 * Helper to create a test component wrapper
 */
export const createTestWrapper = (options: TestRenderOptions = {}) => {
  return ({ children }: { children: React.ReactNode }) => {
    const routerOptions = options.initialRoute 
      ? { initialEntries: [options.initialRoute] }
      : undefined;

    return (
      <TestWrapper routerOptions={routerOptions}>
        {children}
      </TestWrapper>
    );
  };
};
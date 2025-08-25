import { render, screen } from '@testing-library/react';
import { FeatureToggle } from '../FeatureToggle';
import { FeatureProvider } from '../../contexts/FeatureContext';

const mockFeatureService = {
  evaluateFlag: jest.fn(),
  evaluateExperiment: jest.fn(),
  trackEvent: jest.fn(),
};

jest.mock('../../services/featureService', () => ({
  featureService: mockFeatureService,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <FeatureProvider>{children}</FeatureProvider>
);

describe('FeatureToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when feature is enabled', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: true,
      value: true,
      variant: null,
      reason: 'FLAG_ENABLED',
    });

    render(
      <TestWrapper>
        <FeatureToggle feature="dark_mode">
          <div data-testid="feature-content">Dark mode enabled</div>
        </FeatureToggle>
      </TestWrapper>
    );

    expect(await screen.findByTestId('feature-content')).toBeInTheDocument();
  });

  it('should not render children when feature is disabled', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: false,
      value: false,
      variant: null,
      reason: 'FLAG_DISABLED',
    });

    render(
      <TestWrapper>
        <FeatureToggle feature="dark_mode">
          <div data-testid="feature-content">Dark mode enabled</div>
        </FeatureToggle>
      </TestWrapper>
    );

    expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
  });

  it('should render fallback when feature is disabled', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: false,
      value: false,
      variant: null,
      reason: 'FLAG_DISABLED',
    });

    render(
      <TestWrapper>
        <FeatureToggle
          feature="dark_mode"
          fallback={<div data-testid="fallback-content">Light mode</div>}
        >
          <div data-testid="feature-content">Dark mode enabled</div>
        </FeatureToggle>
      </TestWrapper>
    );

    expect(await screen.findByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
  });

  it('should render loading state initially', () => {
    mockFeatureService.evaluateFlag.mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
        <FeatureToggle feature="dark_mode" loading={<div data-testid="loading">Loading...</div>}>
          <div data-testid="feature-content">Content</div>
        </FeatureToggle>
      </TestWrapper>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperimentProvider } from '../ExperimentProvider';
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

const MockVariantA = () => <div data-testid="variant-a">Variant A</div>;
const MockVariantB = () => <div data-testid="variant-b">Variant B</div>;
const MockControl = () => <div data-testid="control">Control</div>;

describe('ExperimentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render control variant when not in experiment', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'control',
      inExperiment: false,
      reason: 'NOT_IN_EXPERIMENT',
    });

    render(
      <TestWrapper>
        <ExperimentProvider
          experiment="discovery_algorithm_test"
          variants={{
            control: MockControl,
            variant_a: MockVariantA,
            variant_b: MockVariantB,
          }}
        />
      </TestWrapper>
    );

    expect(await screen.findByTestId('control')).toBeInTheDocument();
  });

  it('should render treatment variant when in experiment', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'variant_a',
      inExperiment: true,
      reason: 'USER_IN_EXPERIMENT',
    });

    render(
      <TestWrapper>
        <ExperimentProvider
          experiment="discovery_algorithm_test"
          variants={{
            control: MockControl,
            variant_a: MockVariantA,
            variant_b: MockVariantB,
          }}
        />
      </TestWrapper>
    );

    expect(await screen.findByTestId('variant-a')).toBeInTheDocument();
  });

  it('should track conversion events', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'variant_a',
      inExperiment: true,
      reason: 'USER_IN_EXPERIMENT',
    });

    const MockVariantWithTracking = () => (
      <div data-testid="variant-tracking">
        <button
          data-testid="conversion-button"
          onClick={() => {
            mockFeatureService.trackEvent({
              eventType: 'experiment_conversion',
              experimentKey: 'discovery_algorithm_test',
              variant: 'variant_a',
              conversionType: 'button_click',
              userId: 'test-user',
              timestamp: new Date(),
            });
          }}
        >
          Click me
        </button>
      </div>
    );

    render(
      <TestWrapper>
        <ExperimentProvider
          experiment="discovery_algorithm_test"
          variants={{
            control: MockControl,
            variant_a: MockVariantWithTracking,
            variant_b: MockVariantB,
          }}
        />
      </TestWrapper>
    );

    const button = await screen.findByTestId('conversion-button');
    fireEvent.click(button);

    expect(mockFeatureService.trackEvent).toHaveBeenCalledWith({
      eventType: 'experiment_conversion',
      experimentKey: 'discovery_algorithm_test',
      variant: 'variant_a',
      conversionType: 'button_click',
      userId: 'test-user',
      timestamp: expect.any(Date),
    });
  });

  it('should render fallback for unknown variant', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'unknown_variant',
      inExperiment: true,
      reason: 'USER_IN_EXPERIMENT',
    });

    render(
      <TestWrapper>
        <ExperimentProvider
          experiment="discovery_algorithm_test"
          variants={{
            control: MockControl,
            variant_a: MockVariantA,
          }}
        />
      </TestWrapper>
    );

    expect(await screen.findByTestId('control')).toBeInTheDocument();
  });
});
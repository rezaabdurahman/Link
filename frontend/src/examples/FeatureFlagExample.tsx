import React from 'react';
import { 
  FeatureGate, 
  VariantGate, 
  FeatureEnabled, 
  FeatureDisabled 
} from '../components/FeatureGate';
import { 
  ExperimentGate, 
  ExperimentVariantGate, 
  SimpleABTest 
} from '../components/ExperimentGate';
import { 
  useFeatureFlag, 
  useFeatureValue, 
  useFeatureVariant 
} from '../hooks/useFeatureFlag';
import { 
  useExperiment, 
  useExperimentTracking, 
  useABTest 
} from '../hooks/useExperiment';

// Example component showing different ways to use feature flags
export const FeatureFlagExamples: React.FC = () => {
  // Using hooks directly
  const isDarkModeEnabled = useFeatureFlag('dark_mode');
  const discoveryAlgorithm = useFeatureValue('new_discovery_algorithm', 'standard');
  const chatUIVariant = useFeatureVariant('enhanced_chat_ui');
  
  // Using experiment hooks
  const onboardingExperiment = useExperiment('onboarding_flow_test');
  const { trackConversion } = useExperimentTracking('onboarding_flow_test');
  
  // A/B test hook with variants
  const profileComponent = useABTest('profile_layout_test', {
    control: <StandardProfileCard />,
    centered: <CenteredProfileCard />,
    minimal: <MinimalProfileCard />,
  });

  const handleOnboardingComplete = () => {
    trackConversion('onboarding_completed', {
      completion_time: Date.now(),
      steps_completed: 4,
    });
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-6">Feature Flag & A/B Testing Examples</h1>

      {/* Basic Feature Flag Examples */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Basic Feature Flags</h2>
        
        {/* Using hook directly */}
        <div className="mb-4">
          <p>Dark mode is {isDarkModeEnabled ? 'enabled' : 'disabled'}</p>
          <p>Discovery algorithm: {discoveryAlgorithm}</p>
          <p>Chat UI variant: {chatUIVariant || 'default'}</p>
        </div>

        {/* Using FeatureGate component */}
        <FeatureGate flagKey="dark_mode">
          <div className="bg-gray-800 text-white p-4 rounded">
            🌙 Dark mode content is visible!
          </div>
        </FeatureGate>

        <FeatureGate 
          flagKey="dark_mode" 
          fallback={
            <div className="bg-white text-black p-4 rounded border">
              ☀️ Light mode fallback content
            </div>
          }
        >
          <div className="bg-gray-800 text-white p-4 rounded">
            🌙 Dark mode content
          </div>
        </FeatureGate>
      </section>

      {/* Convenience Components */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Convenience Components</h2>
        
        <FeatureEnabled flagKey="ai_conversation_summary">
          <div className="bg-blue-100 p-4 rounded">
            🤖 AI conversation summaries are available!
          </div>
        </FeatureEnabled>

        <FeatureDisabled flagKey="ai_conversation_summary">
          <div className="bg-gray-100 p-4 rounded">
            AI summaries are not yet available.
          </div>
        </FeatureDisabled>
      </section>

      {/* Variant-based Feature Flags */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Variant-based Flags</h2>
        
        <VariantGate
          flagKey="enhanced_chat_ui"
          variants={{
            control: <div className="p-4 bg-gray-100 rounded">Standard Chat UI</div>,
            variant_a: <div className="p-4 bg-blue-100 rounded">Enhanced Chat UI - Variant A</div>,
            variant_b: <div className="p-4 bg-green-100 rounded">Enhanced Chat UI - Variant B</div>,
          }}
          fallback={<div className="p-4 bg-red-100 rounded">Chat UI disabled</div>}
        />
      </section>

      {/* A/B Testing Examples */}
      <section>
        <h2 className="text-xl font-semibold mb-4">A/B Testing</h2>
        
        {/* Simple A/B test */}
        <SimpleABTest
          experimentKey="onboarding_flow_test"
          control={
            <div className="p-4 bg-white border rounded">
              <h3 className="font-bold">Standard Onboarding</h3>
              <p>Welcome! Please complete these 4 steps to get started.</p>
              <button 
                onClick={handleOnboardingComplete}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
              >
                Start Standard Onboarding
              </button>
            </div>
          }
          treatment={
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h3 className="font-bold text-green-800">Quick Setup</h3>
              <p>Get started in just 2 simple steps!</p>
              <button 
                onClick={handleOnboardingComplete}
                className="mt-2 px-4 py-2 bg-green-500 text-white rounded"
              >
                Quick Start
              </button>
            </div>
          }
        />

        {/* Multi-variant experiment */}
        <ExperimentVariantGate
          experimentKey="profile_layout_test"
          variants={{
            control: <StandardProfileCard />,
            centered: <CenteredProfileCard />,
            minimal: <MinimalProfileCard />,
          }}
          fallback={<div>Profile experiment not running</div>}
        />

        {/* Using A/B test hook result */}
        <div className="mt-4">
          <h3 className="font-semibold">Profile Layout (via hook):</h3>
          {profileComponent}
        </div>
      </section>

      {/* Experiment Status Display */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Experiment Status</h2>
        
        <ExperimentGate 
          experimentKey="onboarding_flow_test"
          fallback={<p>You're not in the onboarding experiment.</p>}
        >
          <div className="bg-yellow-100 p-4 rounded">
            <p>You're part of the onboarding flow experiment!</p>
            {onboardingExperiment && (
              <div className="text-sm text-gray-600 mt-2">
                <p>Variant: {onboardingExperiment.variant}</p>
                <p>Status: {onboardingExperiment.in_experiment ? 'Active' : 'Inactive'}</p>
              </div>
            )}
          </div>
        </ExperimentGate>
      </section>

      {/* Premium Features Example */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Premium Features</h2>
        
        <FeatureGate
          flagKey="premium_features"
          fallback={
            <div className="p-4 bg-gray-100 rounded border-2 border-dashed border-gray-300">
              <h3 className="font-semibold text-gray-600">Premium Feature</h3>
              <p className="text-gray-500">Upgrade to access advanced analytics and insights.</p>
              <button className="mt-2 px-4 py-2 bg-purple-500 text-white rounded">
                Upgrade Now
              </button>
            </div>
          }
        >
          <div className="p-4 bg-purple-50 border border-purple-200 rounded">
            <h3 className="font-semibold text-purple-800">✨ Premium Analytics</h3>
            <p>View detailed insights about your connections and activity.</p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded shadow">
                <div className="text-2xl font-bold text-purple-600">142</div>
                <div className="text-sm text-gray-600">Total Connections</div>
              </div>
              <div className="bg-white p-3 rounded shadow">
                <div className="text-2xl font-bold text-purple-600">89%</div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
              <div className="bg-white p-3 rounded shadow">
                <div className="text-2xl font-bold text-purple-600">24</div>
                <div className="text-sm text-gray-600">New This Week</div>
              </div>
            </div>
          </div>
        </FeatureGate>
      </section>
    </div>
  );
};

// Example profile card components for A/B testing
const StandardProfileCard: React.FC = () => (
  <div className="bg-white border rounded-lg p-4 max-w-md">
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
      <div>
        <h3 className="font-bold">Standard Layout</h3>
        <p className="text-gray-600">Traditional sidebar layout</p>
      </div>
    </div>
    <div className="mt-4">
      <button className="w-full py-2 bg-blue-500 text-white rounded">Connect</button>
    </div>
  </div>
);

const CenteredProfileCard: React.FC = () => (
  <div className="bg-white border rounded-lg p-6 max-w-md text-center">
    <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto mb-4"></div>
    <h3 className="font-bold text-lg">Centered Layout</h3>
    <p className="text-gray-600 mb-4">Modern centered design</p>
    <div className="space-y-2">
      <button className="w-full py-2 bg-green-500 text-white rounded">Connect</button>
      <button className="w-full py-2 border border-gray-300 rounded">View Profile</button>
    </div>
  </div>
);

const MinimalProfileCard: React.FC = () => (
  <div className="bg-white rounded-lg p-3 max-w-md border-l-4 border-purple-500">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gray-300 rounded"></div>
        <div>
          <h3 className="font-semibold text-sm">Minimal Layout</h3>
          <p className="text-gray-500 text-xs">Clean & simple</p>
        </div>
      </div>
      <button className="px-3 py-1 bg-purple-500 text-white text-sm rounded">
        Connect
      </button>
    </div>
  </div>
);

export default FeatureFlagExamples;
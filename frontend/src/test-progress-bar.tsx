// Test component to verify OnboardingProgressBar works with aqua styling
import React from 'react';
import OnboardingProgressBar from './components/onboarding/OnboardingProgressBar';

const TestProgressBar: React.FC = () => {
  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-8">Testing OnboardingProgressBar with Aqua Theme</h1>
      
      {/* Test different progress values */}
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress: 0%</h2>
          <OnboardingProgressBar progress={0} />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress: 25%</h2>
          <OnboardingProgressBar progress={25} />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress: 50%</h2>
          <OnboardingProgressBar progress={50} />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress: 75%</h2>
          <OnboardingProgressBar progress={75} />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress: 100% (Complete with Aqua Success Indicator)</h2>
          <OnboardingProgressBar progress={100} />
        </div>
      </div>
    </div>
  );
};

export default TestProgressBar;

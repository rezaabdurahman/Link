import React from 'react';

const GradientTest: React.FC = () => {
  return (
    <div className="p-8 space-y-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold">Gradient Test Page</h1>
      
      {/* Test direct inline styles first */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Inline Style Test (should work)</h2>
        <div 
          className="w-32 h-16 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #d2b48c 50%, #b45309 100%)'
          }}
        />
      </div>

      {/* Test Tailwind backgroundImage classes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tailwind backgroundImage Test</h2>
        <div className="w-32 h-16 bg-gradient-aqua-copper rounded-lg" />
        <div className="w-32 h-16 bg-gradient-aqua-sand rounded-lg" />
        <div className="w-32 h-16 bg-gradient-aqua-purple rounded-lg" />
      </div>

      {/* Test gradient button classes from CSS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">CSS Class Test</h2>
        <button className="gradient-btn">Gradient Button</button>
        <button className="gradient-btn-sm">Small Gradient Button</button>
      </div>

      {/* Test text gradients */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Text Gradient Test</h2>
        <div className="text-gradient-aqua-copper text-2xl font-bold">
          Aqua Sand Copper Text
        </div>
        <div className="text-gradient-aqua-sand text-2xl font-bold">
          Aqua Sand Text
        </div>
      </div>

      {/* Test border gradients */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Border Gradient Test</h2>
        <div className="border-gradient-aqua-copper w-48 h-24 rounded-lg bg-white p-4">
          <p>This should have a gradient border</p>
        </div>
      </div>

      {/* Test avatar ring */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Avatar Ring Test</h2>
        <div className="avatar-ring">
          <img 
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face"
            alt="Test Avatar"
            className="w-20 h-20 object-cover"
          />
        </div>
      </div>

      {/* Debug info */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Debug Info</h2>
        <div className="bg-gray-100 p-4 rounded text-sm">
          <p>If you don't see gradients, check:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Is the CSS being imported correctly?</li>
            <li>Are the Tailwind classes being generated?</li>
            <li>Is there a CSS cache issue?</li>
            <li>Check the dev tools for CSS errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GradientTest;

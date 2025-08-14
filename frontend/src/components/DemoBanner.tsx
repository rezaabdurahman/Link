// DemoBanner - Shows a banner indicating the app is in demo mode
// Provides context to users that they're viewing a demo version

import React from 'react';
import { shouldShowDemoBanner, APP_CONFIG } from '../config';

/**
 * DemoBanner component that displays a demo mode indicator
 */
const DemoBanner: React.FC = () => {
  if (!shouldShowDemoBanner()) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-accent-copper to-accent-copper-dark text-white text-center py-2 px-4 text-sm font-medium shadow-sm z-50 relative">
      <div className="flex items-center justify-center gap-2">
        <span role="img" aria-label="rocket">🚀</span>
        <span>{APP_CONFIG.demo.bannerText}</span>
      </div>
    </div>
  );
};

export default DemoBanner;

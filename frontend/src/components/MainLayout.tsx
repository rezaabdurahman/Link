import React from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import { shouldShowDemoBanner, APP_CONFIG } from '../config';

const MainLayout: React.FC = (): JSX.Element => {
  return (
    <div className="app">
      {/* Conditional Demo Banner */}
      {shouldShowDemoBanner() && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2">
          <p className="text-sm text-yellow-800 text-center">
            {APP_CONFIG.demo.bannerText}
          </p>
        </div>
      )}
      
      <div className="app-content">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
};

export default MainLayout;

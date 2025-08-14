import React from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import DemoBanner from './DemoBanner';

const MainLayout: React.FC = (): JSX.Element => {
  return (
    <div className="app flex flex-col min-h-screen">
      <DemoBanner />
      
      <div className="app-content flex-1">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
};

export default MainLayout;

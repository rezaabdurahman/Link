import React from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';

const MainLayout: React.FC = (): JSX.Element => {
  return (
    <div className="app">
      <div className="app-content">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
};

export default MainLayout;

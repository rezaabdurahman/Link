import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DiscoveryPage from './pages/DiscoveryPage';
import ChatPage from './pages/ChatPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import ProfilePage from './pages/ProfilePage';
import TabBar from './components/TabBar';
import './App.css';

const App: React.FC = (): JSX.Element => {
  return (
    <Router>
      <div className="app">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<DiscoveryPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </div>
        <TabBar />
      </div>
    </Router>
  );
};

export default App;

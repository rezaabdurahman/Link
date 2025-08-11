import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DiscoveryPage from 'frontend/src/pages/DiscoveryPage';
import ChatPage from './pages/ChatPage';
import CheckinPage from './pages/CheckinPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MainLayout from './components/MainLayout';
import RequireAuth from './components/RequireAuth';
import GuestOnly from './components/GuestOnly';
import AuthExample from './examples/AuthExample';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

const App: React.FC = (): JSX.Element => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Development Route (remove in production) */}
          <Route path="/dev" element={<AuthExample />} />
          
          {/* Guest-only Auth Routes */}
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/register" element={<SignupPage />} />
          </Route>
          
          {/* Protected App Routes with MainLayout */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<DiscoveryPage />} />
              <Route path="discovery" element={<DiscoveryPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="checkin" element={<CheckinPage />} />
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;

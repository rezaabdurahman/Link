import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DiscoveryPage from './pages/DiscoveryPage';
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
import { OnboardingProvider } from './contexts/OnboardingContext';
import OnboardingPage from './pages/OnboardingPage';
import './App.css';

const App: React.FC = (): JSX.Element => {
  return (
    <Router>
      <AuthProvider>
        <OnboardingProvider>
          <Routes>
            {/* Development Route (remove in production) */}
            <Route path="/dev" element={<AuthExample />} />
            
            {/* Guest-only Auth Routes */}
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/register" element={<SignupPage />} />
            </Route>
            
            {/* Onboarding Route (authenticated users only) */}
            <Route element={<RequireAuth />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
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
        </OnboardingProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;

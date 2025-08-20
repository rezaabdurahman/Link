import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DiscoveryPage from './pages/DiscoveryPage';
import ChatPage from './pages/ChatPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import FriendRequestsPage from './pages/FriendRequestsPage';
import MainLayout from './components/MainLayout';
import RequireAuth from './components/RequireAuth';
import GuestOnly from './components/GuestOnly';
import AuthExample from './examples/AuthExample';
import UserCardDemo from './pages/UserCardDemo';
import { AuthProvider } from './contexts/AuthContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import OnboardingPage from './pages/OnboardingPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import DemoInitializer from './components/DemoInitializer';
import './App.css';

const App: React.FC = (): JSX.Element => {
  return (
    <Router>
      <AuthProvider>
        <DemoInitializer>
          <OnboardingProvider>
            <Routes>
            {/* Development Routes (remove in production) */}
            <Route path="/dev" element={<AuthExample />} />
            <Route path="/demo/usercard" element={<UserCardDemo />} />
            
            {/* Public Legal Routes */}
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            
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
                <Route path="opportunities" element={<OpportunitiesPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              {/* Friend Requests - separate layout */}
              <Route path="friend-requests" element={<FriendRequestsPage />} />
            </Route>
            </Routes>
          </OnboardingProvider>
        </DemoInitializer>
      </AuthProvider>
    </Router>
  );
};

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AsyncErrorBoundary from './components/ErrorBoundary/AsyncErrorBoundary';
import GlobalErrorBoundary from './components/ErrorBoundary/GlobalErrorBoundary';
import RouteErrorBoundary from './components/ErrorBoundary/RouteErrorBoundary';
import DemoInitializer from './components/DemoInitializer';
import GuestOnly from './components/GuestOnly';
import MainLayout from './components/MainLayout';
import RequireAuth from './components/RequireAuth';

import { AuthProvider } from './contexts/AuthContext';
import { CueProvider } from './contexts/CueContext';
import { FeatureProvider } from './contexts/FeatureContext';
import { OnboardingProvider } from './contexts/OnboardingContext';

import AuthExample from './examples/AuthExample';

import ChatPage from './pages/ChatPageRefactored';
import DiscoveryPage from './pages/DiscoveryPage';
import FriendRequestsPage from './pages/FriendRequestsPageRefactored';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import ProfilePage from './pages/ProfilePageRefactored';
import SettingsPage from './pages/SettingsPage';
import SignupPage from './pages/SignupPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import UserCardDemo from './pages/UserCardDemo';

import './App.css';

const App: React.FC = (): JSX.Element => {
  return (
    <GlobalErrorBoundary level="global">
      <AsyncErrorBoundary>
        <Router>
          <AuthProvider>
            <FeatureProvider>
              <DemoInitializer>
                <OnboardingProvider>
                  <CueProvider>
                <Routes>
                {/* Development Routes (remove in production) */}
                <Route path="/dev" element={
                  <RouteErrorBoundary routeName="Development">
                    <AuthExample />
                  </RouteErrorBoundary>
                } />
                <Route path="/demo/usercard" element={
                  <RouteErrorBoundary routeName="User Card Demo">
                    <UserCardDemo />
                  </RouteErrorBoundary>
                } />
                <Route path="/debug-onboarding" element={
                  <RouteErrorBoundary routeName="Debug Onboarding">
                    <OnboardingPage />
                  </RouteErrorBoundary>
                } />
                
                {/* Public Legal Routes */}
                <Route path="/privacy-policy" element={
                  <RouteErrorBoundary routeName="Privacy Policy">
                    <PrivacyPolicyPage />
                  </RouteErrorBoundary>
                } />
                <Route path="/terms-of-service" element={
                  <RouteErrorBoundary routeName="Terms of Service">
                    <TermsOfServicePage />
                  </RouteErrorBoundary>
                } />
                
                {/* Guest-only Auth Routes */}
                <Route element={<GuestOnly />}>
                  <Route path="/login" element={
                    <RouteErrorBoundary routeName="Login">
                      <LoginPage />
                    </RouteErrorBoundary>
                  } />
                  <Route path="/signup" element={
                    <RouteErrorBoundary routeName="Sign Up">
                      <SignupPage />
                    </RouteErrorBoundary>
                  } />
                  <Route path="/register" element={
                    <RouteErrorBoundary routeName="Register">
                      <SignupPage />
                    </RouteErrorBoundary>
                  } />
                </Route>
                
                {/* Onboarding Route - Separate RequireAuth to avoid conflicts */}
                <Route element={<RequireAuth />}>
                  <Route path="/onboarding" element={
                    <RouteErrorBoundary routeName="Onboarding">
                      <OnboardingPage />
                    </RouteErrorBoundary>
                  } />
                </Route>
                
                {/* Main App Routes (authenticated users only) */}
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={
                      <RouteErrorBoundary routeName="Discovery">
                        <DiscoveryPage />
                      </RouteErrorBoundary>
                    } />
                    <Route path="discovery" element={
                      <RouteErrorBoundary routeName="Discovery">
                        <DiscoveryPage />
                      </RouteErrorBoundary>
                    } />
                    <Route path="chat" element={
                      <RouteErrorBoundary routeName="Chat">
                        <ChatPage />
                      </RouteErrorBoundary>
                    } />
                    <Route path="opportunities" element={
                      <RouteErrorBoundary routeName="Opportunities">
                        <OpportunitiesPage />
                      </RouteErrorBoundary>
                    } />
                    <Route path="profile" element={
                      <RouteErrorBoundary routeName="Profile">
                        <ProfilePage />
                      </RouteErrorBoundary>
                    } />
                    <Route path="settings" element={
                      <RouteErrorBoundary routeName="Settings">
                        <SettingsPage />
                      </RouteErrorBoundary>
                    } />
                  </Route>
                  {/* Settings sub-pages - separate layout */}
                  <Route path="settings/privacy" element={
                    <RouteErrorBoundary routeName="Privacy Settings">
                      <PrivacySettingsPage />
                    </RouteErrorBoundary>
                  } />
                  {/* Friend Requests - separate layout */}
                  <Route path="friend-requests" element={
                    <RouteErrorBoundary routeName="Friend Requests">
                      <FriendRequestsPage />
                    </RouteErrorBoundary>
                  } />
                </Route>
                </Routes>
                </CueProvider>
              </OnboardingProvider>
            </DemoInitializer>
            </FeatureProvider>
          </AuthProvider>
        </Router>
      </AsyncErrorBoundary>
    </GlobalErrorBoundary>
  );
};

export default App;

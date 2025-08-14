// Example component demonstrating AuthContext usage
// Shows how to use authentication state and methods

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequest, RegisterRequest } from '../services/authClient';

/**
 * Example component showing how to use the AuthContext
 * This demonstrates all available authentication methods and state
 */
export function AuthExample(): JSX.Element {
  const { 
    user, 
    isLoading, 
    error, 
    isInitialized,
    login, 
    register, 
    logout, 
    refresh,
    updateUser,
    clearError 
  } = useAuth();

  // Local state for forms
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState<RegisterRequest>({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginForm);
      console.log('Login successful!');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(registerForm);
      console.log('Registration successful!');
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      console.log('Logout successful!');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle token refresh
  const handleRefresh = async () => {
    try {
      await refresh();
      console.log('Token refreshed successfully!');
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  // Handle user update
  const handleUpdateUser = () => {
    updateUser({
      first_name: 'Updated',
      last_name: 'Name',
      profile_picture: 'https://example.com/new-avatar.jpg',
    });
  };

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Initializing authentication...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">AuthContext Example</h1>

      {/* Authentication Status */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Authentication Status</h2>
        <div className="space-y-2">
          <p><strong>User:</strong> {user ? `${user.first_name} ${user.last_name}` : 'Not authenticated'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Initialized:</strong> {isInitialized ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {error || 'None'}</p>
        </div>
        
        {error && (
          <button
            onClick={clearError}
            className="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Error
          </button>
        )}
      </div>

      {!user ? (
        // Show login/register forms when not authenticated
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Login Form */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>

          {/* Register Form */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Register</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={registerForm.first_name}
                  onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={registerForm.last_name}
                  onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword || ''}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-aqua text-white rounded hover:bg-aqua-dark disabled:opacity-50"
              >
                {isLoading ? 'Registering...' : 'Register'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        // Show authenticated user actions
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Authenticated Actions</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Refreshing...' : 'Refresh Token'}
              </button>
              
              <button
                onClick={handleUpdateUser}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Update User
              </button>
              
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {isLoading ? 'Logging out...' : 'Logout'}
              </button>
            </div>
            
            {user && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-2">User Details:</h3>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Usage Instructions</h2>
        <div className="space-y-2 text-sm">
          <p><strong>1.</strong> Wrap your app with <code>AuthProvider</code></p>
          <p><strong>2.</strong> Use <code>useAuth()</code> hook to access authentication state and methods</p>
          <p><strong>3.</strong> Available methods: <code>login, register, logout, refresh, updateUser, clearError</code></p>
          <p><strong>4.</strong> Available state: <code>user, isLoading, error, isInitialized, token</code></p>
          <p><strong>5.</strong> Tokens are automatically persisted and refreshed</p>
        </div>
      </div>
    </div>
  );
}

export default AuthExample;

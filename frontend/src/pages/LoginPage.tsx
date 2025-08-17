import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import AuthFormField from '../components/AuthFormField';
import AnimatedCyclingText from '../components/AnimatedCyclingText';

// Validation schema using Zod
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = (): JSX.Element => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error'>('error');
  
  const { login, isLoading, error, clearError, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract intended route from location state
  const from = location.state?.from || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  // Handle auth error changes
  useEffect(() => {
    if (error) {
      setToastMessage(error);
      setToastType('error');
      setShowToast(true);
      clearError();
    }
  }, [error, clearError]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  // Watch form values to determine if form is valid and filled
  const watchedFields = watch();
  const formIsFilled = watchedFields.email && watchedFields.password;
  const isFormValid = isValid && formIsFilled;

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      await login(data);
      // Success toast
      setToastMessage('Welcome back!');
      setToastType('success');
      setShowToast(true);
      
      // Navigate to intended route after short delay
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);
    } catch (err) {
      // Error handling is done via useEffect watching auth context error
      console.error('Login failed:', err);
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };

  const handleCloseToast = (): void => {
    setShowToast(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header */}
      <div className="pt-16 pb-8 px-6">
        <div className="text-center mb-8">
          <div className="mb-4">
            <h1 className="text-4xl font-bold text-gradient-aqua mb-3">
              Link
            </h1>
            <div className="text-gray-700 text-base leading-relaxed">
              <div className="flex flex-wrap items-center justify-center gap-0">
                <span>Make</span>
                <AnimatedCyclingText
                  words={['connects', 'friends', 'vibes', 'networks']}
                  className="text-aqua font-semibold inline-block w-24 text-center"
                  duration={1500}
                  animationDuration={100}
                />
                <span>with people around you</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6">
        <div className="max-w-md mx-auto">
          {/* Error Banner */}
          {error && (
            <div className="bg-surface-card rounded-2xl border border-red-200 mb-6 overflow-hidden">
              <div className="px-4 py-3 bg-red-50">
                <p className="text-red-800 text-sm font-medium text-center">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <AuthFormField
              label="Email Address"
              name="email"
              type="email"
              placeholder="Enter your email"
              icon={Mail}
              error={errors.email?.message}
              disabled={isLoading}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              register={register}
            />

            {/* Password Field */}
            <AuthFormField
              label="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
              icon={Lock}
              error={errors.password?.message}
              disabled={isLoading}
              autoComplete="current-password"
              showPasswordToggle={true}
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
              register={register}
              rightElement={
                showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )
              }
            />

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  // Stub - would navigate to forgot password flow
                  console.log('Forgot password clicked');
                }}
                className="text-aqua text-sm font-semibold hover:text-aqua-dark transition-colors duration-200"
                disabled={isLoading}
              >
                Forgot your password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={`
                w-full py-4 px-6 rounded-2xl font-semibold text-base
                flex items-center justify-center gap-3
                transition-all duration-200
                ${isFormValid && !isLoading
                  ? 'bg-gradient-aqua-copper text-white hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-[1.02] hover-gradient-glow'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-aqua font-semibold hover:text-aqua-dark transition-colors duration-200"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="text-gray-500 text-xs leading-relaxed">
            By signing in, you agree to our{' '}
            <button className="text-gray-600 underline">Terms of Service</button>{' '}
            and{' '}
            <button className="text-gray-600 underline">Privacy Policy</button>
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={handleCloseToast}
        duration={3000}
      />
    </div>
  );
};

export default LoginPage;

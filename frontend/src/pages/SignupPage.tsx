import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Mail, Lock, UserPlus, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import AuthFormField from '../components/AuthFormField';

// Validation schema using Zod
const signupSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  username: z
    .string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

const SignupPage: React.FC = (): JSX.Element => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error'>('error');
  
  const { register, isLoading, error, clearError, user } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

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
    register: formRegister,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  // Watch form values to determine if form is valid and filled
  const watchedFields = watch();
  const formIsFilled = watchedFields.firstName && 
    watchedFields.lastName && 
    watchedFields.username &&
    watchedFields.email && 
    watchedFields.password && 
    watchedFields.confirmPassword;
  const isFormValid = isValid && formIsFilled;

  const onSubmit = async (data: SignupFormData): Promise<void> => {
    try {
      // Transform the form data to match the RegisterRequest interface
      const registerData = {
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      };

      await register(registerData);
      
      // Success toast
      setToastMessage('Account created successfully! Welcome to Link!');
      setToastType('success');
      setShowToast(true);
      
      // Redirect to onboarding after successful registration
      // The auth context already handles setting the user state
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1500);
    } catch (err) {
      // Error handling is done via useEffect watching auth context error
      console.error('Registration failed:', err);
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = (): void => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleCloseToast = (): void => {
    setShowToast(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header */}
      <div className="pt-16 pb-8 px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join Link
          </h1>
          <p className="text-gray-600 text-base">
            Create your account and start connecting
          </p>
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

          {/* Signup Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name Fields Row */}
            <div className="grid grid-cols-2 gap-4">
              <AuthFormField
                label="First Name"
                name="firstName"
                type="text"
                placeholder="Enter your first name"
                icon={User}
                error={errors.firstName?.message}
                disabled={isLoading}
                autoComplete="given-name"
                autoCapitalize="words"
                register={formRegister}
              />
              <AuthFormField
                label="Last Name"
                name="lastName"
                type="text"
                placeholder="Enter your last name"
                icon={User}
                error={errors.lastName?.message}
                disabled={isLoading}
                autoComplete="family-name"
                autoCapitalize="words"
                register={formRegister}
              />
            </div>

            {/* Username Field */}
            <AuthFormField
              label="Username"
              name="username"
              type="text"
              placeholder="Choose a username"
              icon={UserPlus}
              error={errors.username?.message}
              disabled={isLoading}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              register={formRegister}
            />

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
              register={formRegister}
            />

            {/* Password Field */}
            <AuthFormField
              label="Password"
              name="password"
              type="password"
              placeholder="Create a password"
              icon={Lock}
              error={errors.password?.message}
              disabled={isLoading}
              autoComplete="new-password"
              showPasswordToggle={true}
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
              register={formRegister}
              rightElement={
                showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )
              }
            />

            {/* Confirm Password Field */}
            <AuthFormField
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              icon={Lock}
              error={errors.confirmPassword?.message}
              disabled={isLoading}
              autoComplete="new-password"
              showPasswordToggle={true}
              showPassword={showConfirmPassword}
              onTogglePassword={toggleConfirmPasswordVisibility}
              register={formRegister}
              rightElement={
                showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )
              }
            />

            {/* Submit Button */}
            <div className="pt-4">
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
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-aqua font-semibold hover:text-aqua-dark transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="text-gray-500 text-xs leading-relaxed">
            By creating an account, you agree to our{' '}
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

export default SignupPage;

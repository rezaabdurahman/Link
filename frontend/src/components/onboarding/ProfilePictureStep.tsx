// ProfilePictureStep - First step of onboarding flow
// Allows users to upload or skip adding a profile picture

import React, { useState, useCallback } from 'react';
import { Upload, Camera, User, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingStepHeader from './ui/OnboardingStepHeader';

const ProfilePictureStep: React.FC = (): JSX.Element => {
  const { user } = useAuth();
  const {
    goToNextStep,
    updateUserProfile,
    currentStepData,
    setStepData,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentStepData.profile_picture || user?.profile_picture || null
  );
  const [isUploading, setIsUploading] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image smaller than 5MB.');
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreviewUrl(url);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    // Create a synthetic event to reuse handleFileSelect logic
    const input = document.createElement('input');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    
    const syntheticEvent = {
      target: input,
      currentTarget: input,
      nativeEvent: new Event('change'),
      bubbles: false,
      cancelable: false,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      preventDefault: () => {},
      isDefaultPrevented: () => false,
      stopPropagation: () => {},
      isPropagationStopped: () => false,
      persist: () => {},
      timeStamp: Date.now(),
      type: 'change',
    } as React.ChangeEvent<HTMLInputElement>;

    handleFileSelect(syntheticEvent);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // Handle continue action - now requires profile picture
  const handleContinue = async (): Promise<void> => {
    try {
      clearError();

      // Check if profile picture is required
      if (!selectedFile && !previewUrl) {
        alert('Please select a profile picture to continue.');
        return;
      }

      if (selectedFile) {
        setIsUploading(true);

        // In a real implementation, you would upload to a file storage service
        // For now, we'll use a placeholder URL
        const uploadedUrl = `https://example.com/uploads/${selectedFile.name}`;

        // Update profile with new picture
        await updateUserProfile({
          profile_picture: uploadedUrl,
        });

        // Store in step data
        setStepData({
          profile_picture: uploadedUrl,
        });
      }

      // Proceed to next step
      await goToNextStep();
    } catch (error) {
      console.error('Failed to update profile picture:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Skip this step

  // Remove selected image
  const handleRemove = (): void => {
    setSelectedFile(null);
    setPreviewUrl(user?.profile_picture || null);
  };

  return (
    <div className="w-full space-y-10">
      <OnboardingStepHeader
        stepNumber={1}
        totalSteps={7}
        title="Let's add your profile picture"
        subtitle="A great profile picture helps others recognize you and makes a strong first impression. Don't worry - you can always change it later."
      />

      {/* Error Message */}
      {error && (
        <ErrorMessage
          error={error}
          onRetry={clearError}
          className="mb-4"
        />
      )}

      {/* Upload Area */}
      <div className="max-w-4xl mx-auto">
        <div
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-16 text-center hover:border-aqua hover:bg-aqua/10 transition-all duration-300 bg-gradient-to-b from-gray-50 to-white"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {previewUrl ? (
            // Preview
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className="w-32 h-32 rounded-full object-cover mx-auto"
                />
                <button
                  onClick={handleRemove}
                  className="absolute top-0 right-1/2 transform translate-x-16 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {selectedFile ? 'New image selected' : 'Current profile picture'}
              </p>
            </div>
          ) : (
            // Upload Prompt
            <div className="space-y-4">
              <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <User className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-2">
                  Drop an image here, or
                </p>
                <label className="cursor-pointer text-aqua hover:text-aqua-dark font-medium">
                  browse files
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading || isUploading}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Camera Option (for mobile) */}
          <div className="mt-4 sm:hidden">
            <label className="flex items-center justify-center space-x-2 text-aqua hover:text-aqua-dark cursor-pointer">
              <Camera className="w-5 h-5" />
              <span className="text-sm font-medium">Take Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading || isUploading}
              />
            </label>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-2">
          Supported formats: JPG, PNG, GIF (max 5MB)
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center items-center pt-8">
        <button
          onClick={handleContinue}
          disabled={isLoading || isUploading || (!selectedFile && !previewUrl)}
          className="ios-button flex items-center space-x-3 px-8 py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProfilePictureStep;

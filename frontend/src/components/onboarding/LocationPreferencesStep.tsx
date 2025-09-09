// LocationPreferencesStep - Location preferences step of onboarding flow
// Implements real location functionality with permission handling

import React, { useState, useEffect } from 'react';
import { ArrowRight, MapPin, Shield, Users, Settings } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import OnboardingCard from './ui/OnboardingCard';
import OnboardingStepHeader from './ui/OnboardingStepHeader';
import LocationPermissionModal from '../LocationPermissionModal';
import {
  LocationAccuracy,
  getLocationPermissionStatus,
  getCurrentLocation,
  LocationPermissionStatus,
  LocationCoordinates,
  getLocationPreferences,
  saveLocationPreferences,
  formatDistance
} from '../../utils/locationUtils';
import {
  updateUserLocation,
  coordinatesToLocationUpdate,
  getLocationErrorMessage,
  LocationUpdateRequest
} from '../../services/locationClient';

const LocationPreferencesStep: React.FC = (): JSX.Element => {
  const {
    goToNextStep,
    skipCurrentStep,
    isLoading,
    error,
    clearError,
  } = useOnboarding();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedPrivacy, setSelectedPrivacy] = useState<'approximate' | 'exact' | 'friends_only'>('approximate');
  const [maxDistance, setMaxDistance] = useState(10);
  const [notifyNearbyUsers, setNotifyNearbyUsers] = useState(true);

  useEffect(() => {
    checkLocationStatus();
    loadSavedPreferences();
  }, []);

  const checkLocationStatus = async () => {
    try {
      const status = await getLocationPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Failed to check location permission:', error);
    }
  };

  const loadSavedPreferences = () => {
    const prefs = getLocationPreferences();
    if (prefs.defaultAccuracy === LocationAccuracy.HIGH) {
      setSelectedPrivacy('exact');
    } else if (prefs.shareExactLocation) {
      setSelectedPrivacy('exact');
    } else {
      setSelectedPrivacy('approximate');
    }
  };

  const handleContinue = async (): Promise<void> => {
    try {
      clearError();
      setLocationError(null);
      setIsSubmitting(true);

      // If location is granted, try to update location on backend
      if (permissionStatus?.granted && currentLocation) {
        await updateBackendLocation();
      }

      await goToNextStep();
    } catch (error) {
      console.error('Failed to update location preferences:', error);
      setLocationError('Failed to save location preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    try {
      clearError();
      await skipCurrentStep();
    } catch (error) {
      console.error('Failed to skip location preferences step:', error);
    }
  };

  const handleEnableLocation = () => {
    setShowPermissionModal(true);
  };

  const handlePermissionGranted = async (accuracy: LocationAccuracy) => {
    setShowPermissionModal(false);
    
    try {
      // Update permission status
      await checkLocationStatus();
      
      // Get current location
      const location = await getCurrentLocation(accuracy);
      setCurrentLocation(location);
      
      // Save preferences
      saveLocationPreferences({
        permissionGranted: true,
        defaultAccuracy: accuracy,
        shareExactLocation: selectedPrivacy === 'exact',
      });
      
      setLocationError(null);
    } catch (error) {
      console.error('Failed to get location:', error);
      setLocationError('Failed to get your location. Please try again.');
    }
  };

  const handlePermissionDenied = () => {
    setShowPermissionModal(false);
    saveLocationPreferences({
      permissionGranted: false,
    });
    checkLocationStatus();
  };

  const updateBackendLocation = async () => {
    if (!currentLocation) return;

    try {
      const locationUpdate: LocationUpdateRequest = coordinatesToLocationUpdate(
        currentLocation,
        selectedPrivacy,
        'gps'
      );

      await updateUserLocation(locationUpdate);
    } catch (error) {
      console.warn('Failed to update backend location:', error);
      // Don't block onboarding flow for backend location update failures
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-aqua/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-aqua" />
          </div>
        </div>
        
        <OnboardingStepHeader
          stepNumber={4}
          totalSteps={7}
          title="Location Settings"
          subtitle="Set your location preferences for connecting with nearby people."
        />

        {(error || locationError) && (
          <ErrorMessage
            error={error || locationError}
            onRetry={() => {
              clearError();
              setLocationError(null);
            }}
            className="mb-4"
          />
        )}

        <OnboardingCard>
          {!permissionStatus?.granted ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Enable Location Services
                </h3>
                <p className="text-gray-600 mb-4">
                  Share your location to discover people nearby and enhance your experience on Link.
                </p>
              </div>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-700">Discover people nearby</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-700">Get location-based recommendations</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-gray-700">Your privacy is protected</span>
                </div>
              </div>

              <button
                onClick={handleEnableLocation}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Enable Location Access
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Location Enabled
                </h3>
                {currentLocation && (
                  <p className="text-sm text-gray-600">
                    Current location: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                    {currentLocation.accuracy && ` (±${Math.round(currentLocation.accuracy)}m)`}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Location Privacy
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="privacy"
                        value="approximate"
                        checked={selectedPrivacy === 'approximate'}
                        onChange={() => setSelectedPrivacy('approximate')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Approximate Location</div>
                        <div className="text-xs text-gray-600">Within ~1km for privacy</div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="privacy"
                        value="exact"
                        checked={selectedPrivacy === 'exact'}
                        onChange={() => setSelectedPrivacy('exact')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Exact Location</div>
                        <div className="text-xs text-gray-600">Most accurate for better matches</div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="privacy"
                        value="friends_only"
                        checked={selectedPrivacy === 'friends_only'}
                        onChange={() => setSelectedPrivacy('friends_only')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Friends Only</div>
                        <div className="text-xs text-gray-600">Only share with friends</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discovery Radius: {maxDistance}km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1km</span>
                    <span>50km</span>
                  </div>
                </div>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyNearbyUsers}
                    onChange={(e) => setNotifyNearbyUsers(e.target.checked)}
                    className="text-blue-600"
                  />
                  <div className="text-sm text-gray-700">
                    Notify me when people are nearby
                  </div>
                </label>
              </div>
            </div>
          )}
        </OnboardingCard>

        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleSkip}
            disabled={isLoading || isSubmitting}
            className="ios-button-secondary px-4 py-2 disabled:opacity-50"
          >
            Skip this step
          </button>

          <button
            onClick={handleContinue}
            disabled={isLoading || isSubmitting}
            className="ios-button flex items-center space-x-2 px-6 py-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Saving...</span>
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

      {showPermissionModal && (
        <LocationPermissionModal
          isOpen={showPermissionModal}
          onClose={() => setShowPermissionModal(false)}
          onPermissionGranted={handlePermissionGranted}
          onPermissionDenied={handlePermissionDenied}
          title="Enable Location for Better Matches"
          description="Share your location to discover nearby people and enhance your Link experience."
        />
      )}
    </div>
  );
};

export default LocationPreferencesStep;
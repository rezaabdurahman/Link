import React, { useState, useEffect } from 'react';
import { MapPin, Shield, Users, AlertTriangle, X } from 'lucide-react';
import {
  getLocationPermissionStatus,
  requestLocationPermission,
  LocationPermissionStatus,
  LocationAccuracy,
  saveLocationPreferences,
  getLocationPreferences
} from '../utils/locationUtils';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: (accuracy: LocationAccuracy) => void;
  onPermissionDenied: () => void;
  title?: string;
  description?: string;
  showAccuracyOptions?: boolean;
}

const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied,
  title = "Enable Location Services",
  description = "Share your location to discover nearby people and enhance your experience",
  showAccuracyOptions = true,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [selectedAccuracy, setSelectedAccuracy] = useState<LocationAccuracy>(LocationAccuracy.BALANCED);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkPermissionStatus();
      loadUserPreferences();
    }
  }, [isOpen]);

  const checkPermissionStatus = async () => {
    try {
      const status = await getLocationPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Failed to check permission status:', error);
    }
  };

  const loadUserPreferences = () => {
    const preferences = getLocationPreferences();
    setSelectedAccuracy(preferences.defaultAccuracy);
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const granted = await requestLocationPermission();
      
      if (granted) {
        // Save user preferences
        saveLocationPreferences({
          permissionGranted: true,
          defaultAccuracy: selectedAccuracy,
          shareExactLocation: selectedAccuracy === LocationAccuracy.HIGH,
        });
        
        onPermissionGranted(selectedAccuracy);
      } else {
        saveLocationPreferences({
          permissionGranted: false,
        });
        
        onPermissionDenied();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      onPermissionDenied();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDenyPermission = () => {
    saveLocationPreferences({
      permissionGranted: false,
    });
    
    onPermissionDenied();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const accuracyOptions = [
    {
      value: LocationAccuracy.HIGH,
      label: 'High Accuracy',
      description: 'Most precise location using GPS',
      icon: <MapPin className="w-5 h-5 text-green-500" />,
      battery: 'High battery usage',
      accuracy: '~5-10 meters',
    },
    {
      value: LocationAccuracy.BALANCED,
      label: 'Balanced',
      description: 'Good accuracy with reasonable battery usage',
      icon: <MapPin className="w-5 h-5 text-blue-500" />,
      battery: 'Medium battery usage',
      accuracy: '~10-100 meters',
    },
    {
      value: LocationAccuracy.LOW,
      label: 'Battery Saver',
      description: 'Approximate location using network',
      icon: <MapPin className="w-5 h-5 text-orange-500" />,
      battery: 'Low battery usage',
      accuracy: '~100-1000 meters',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {title}
              </h2>
              <p className="text-gray-600">
                {description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-6 pb-4">
          <div className="space-y-3">
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
        </div>

        {/* Accuracy Options */}
        {showAccuracyOptions && (
          <div className="px-6 pb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Location Accuracy
            </h3>
            <div className="space-y-3">
              {accuracyOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start space-x-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="accuracy"
                    value={option.value}
                    checked={selectedAccuracy === option.value}
                    onChange={() => setSelectedAccuracy(option.value)}
                    className="mt-1 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {option.icon}
                      <span className="text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {option.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-gray-500">
                        {option.accuracy}
                      </span>
                      <span className="text-xs text-gray-500">
                        {option.battery}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Privacy Information */}
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
            className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Shield className="w-4 h-4" />
            <span>Privacy & Security Details</span>
          </button>
          
          {showPrivacyDetails && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2 text-xs text-gray-600">
                <p>• Your location is encrypted and stored securely</p>
                <p>• You can change privacy settings anytime</p>
                <p>• Location sharing can be paused or disabled</p>
                <p>• Location data is automatically deleted after 90 days</p>
                <p>• You control who can see your location</p>
              </div>
            </div>
          )}
        </div>

        {/* Permission Status Warning */}
        {permissionStatus?.denied && (
          <div className="mx-6 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Location Access Blocked
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Location access has been blocked. Please enable location services in your browser settings and refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 pt-2 space-y-3">
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting || permissionStatus?.denied}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {isRequesting ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Requesting Permission...</span>
              </span>
            ) : permissionStatus?.denied ? (
              'Enable in Browser Settings'
            ) : (
              'Allow Location Access'
            )}
          </button>
          
          <button
            onClick={handleDenyPermission}
            className="w-full py-3 px-4 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Not Now
          </button>
        </div>

        {/* Footer Note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-500 text-center">
            You can change these preferences anytime in your settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionModal;
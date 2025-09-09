import React, { useState } from 'react';
import { Switch } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { ConsentToggleProps } from '../../types/consent';

export const ConsentToggle: React.FC<ConsentToggleProps> = ({
  consentType,
  label,
  description,
  required = false,
  disabled = false,
  value,
  onChange,
  loading = false,
  error
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;
    
    try {
      onChange(!value);
    } catch (error) {
      console.error(`Failed to toggle ${consentType} consent:`, error);
    }
  };

  return (
    <div className="flex items-start space-x-3 py-4">
      <div className="flex-shrink-0 pt-0.5">
        <Switch
          checked={value}
          onChange={handleToggle}
          disabled={disabled || loading}
          className={`
            ${value ? 'bg-blue-500' : 'bg-gray-300'}
            ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          `}
        >
          <span className="sr-only">{label}</span>
          <span
            className={`
              ${value ? 'translate-x-6' : 'translate-x-1'}
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${loading ? 'animate-pulse' : ''}
            `}
          />
        </Switch>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {label}
                {required && (
                  <span className="ml-1 text-red-500" title="Required">*</span>
                )}
              </p>
              
              {description && (
                <div className="relative">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onClick={() => setShowTooltip(!showTooltip)}
                  >
                    <InformationCircleIcon className="h-4 w-4" />
                  </button>
                  
                  {showTooltip && (
                    <div className="absolute left-0 top-6 z-10 w-72 p-3 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                      {description}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
            
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
          
          {loading && (
            <div className="flex-shrink-0 ml-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsentToggle;
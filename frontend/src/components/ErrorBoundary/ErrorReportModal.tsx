import React, { useState, useRef } from 'react';
import { X, Bug, Send, AlertTriangle } from 'lucide-react';
import { ErrorMetadata } from '../../utils/errorTypes';

interface Props {
  metadata: ErrorMetadata;
  onSubmit: (userDescription: string, reproductionSteps: string[]) => Promise<void>;
  onClose: () => void;
}

const ErrorReportModal: React.FC<Props> = ({ metadata, onSubmit, onClose }) => {
  const [userDescription, setUserDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  React.useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const addReproductionStep = () => {
    setReproductionSteps(prev => [...prev, '']);
  };

  const updateReproductionStep = (index: number, value: string) => {
    setReproductionSteps(prev => prev.map((step, i) => i === index ? value : step));
  };

  const removeReproductionStep = (index: number) => {
    if (reproductionSteps.length > 1) {
      setReproductionSteps(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || submitted) return;
    
    setIsSubmitting(true);
    
    try {
      const validSteps = reproductionSteps.filter(step => step.trim() !== '');
      await onSubmit(userDescription.trim(), validSteps);
      setSubmitted(true);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit error report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (submitted) {
    return (
      <div 
        className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Report Submitted
          </h3>
          <p className="text-gray-600 text-sm">
            Thank you for reporting this error. We'll investigate and work on a fix.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
      aria-labelledby="error-report-title"
      aria-describedby="error-report-description"
      role="dialog"
      aria-modal="true"
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <Bug className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h2 id="error-report-title" className="text-xl font-semibold text-gray-900">
                Report Error
              </h2>
              <p id="error-report-description" className="text-sm text-gray-500">
                Help us improve by reporting this issue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Error Information */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Error Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">Type:</span>
                <span className="text-gray-800">{metadata.type}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">Severity:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  metadata.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  metadata.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  metadata.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {metadata.severity}
                </span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">Time:</span>
                <span className="text-gray-800">{formatTimestamp(metadata.timestamp)}</span>
              </div>
              {metadata.context?.route && (
                <div className="flex">
                  <span className="font-medium text-gray-600 w-20">Route:</span>
                  <span className="text-gray-800">{metadata.context.route}</span>
                </div>
              )}
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">ID:</span>
                <span className="text-gray-800 font-mono text-xs">{metadata.id}</span>
              </div>
            </div>
            
            {metadata.message && (
              <div className="mt-3">
                <span className="font-medium text-gray-600 text-sm">Message:</span>
                <div className="mt-1 p-2 bg-white border border-gray-200 rounded text-sm text-gray-800">
                  {metadata.message}
                </div>
              </div>
            )}
          </div>

          {/* Report Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* User Description */}
            <div>
              <label htmlFor="user-description" className="block text-sm font-medium text-gray-700 mb-2">
                What were you doing when this error occurred?
              </label>
              <textarea
                id="user-description"
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
                placeholder="Please describe what you were trying to do..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            {/* Reproduction Steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Steps to reproduce (optional)
              </label>
              <div className="space-y-2">
                {reproductionSteps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => updateReproductionStep(index, e.target.value)}
                      placeholder={`Step ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={isSubmitting}
                    />
                    {reproductionSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReproductionStep(index)}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addReproductionStep}
                  disabled={isSubmitting}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  + Add step
                </button>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Privacy Notice</p>
                <p className="mt-1">
                  This report will include technical information about the error and your browser environment. 
                  No personal data will be collected.
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ErrorReportModal };
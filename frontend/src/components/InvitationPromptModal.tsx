import React from 'react';
import { ArrowLeft, Send, Mail } from 'lucide-react';

interface InvitationPromptModalProps {
  email: string;
  isLoading: boolean;
  errorMessage: string;
  successMessage: string;
  onSendInvitation: () => void;
  onBack: () => void;
}

const InvitationPromptModal: React.FC<InvitationPromptModalProps> = ({
  email,
  isLoading,
  errorMessage,
  successMessage,
  onSendInvitation,
  onBack
}) => {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center hover-scale"
        >
          <ArrowLeft size={16} className="text-gray-600" />
        </button>
        <h3 className="text-lg font-bold text-gray-900">User Not Found</h3>
      </div>

      {/* Email display */}
      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex items-center gap-3">
          <Mail size={20} className="text-gray-500" />
          <span className="text-gray-900 font-medium">{email}</span>
        </div>
      </div>

      {/* Invitation prompt */}
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-aqua/10 rounded-full flex items-center justify-center">
          <Send size={24} className="text-aqua" />
        </div>
        
        <h4 className="text-lg font-semibold text-gray-900 mb-2">
          Invite them to Link!
        </h4>
        
        <p className="text-gray-600 text-sm leading-relaxed">
          This email isn't associated with a Link account yet. 
          Would you like to send them an invitation to join?
        </p>
      </div>

      {/* Invitation preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">Invitation Preview:</h5>
        <p className="text-sm text-blue-800 leading-relaxed">
          "Hi! I'd like to invite you to join Link - a great platform for 
          connecting with people. Hope to see you there!"
        </p>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="bg-aqua/10 border border-aqua/30 text-aqua px-4 py-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        
        <button
          onClick={onSendInvitation}
          disabled={isLoading}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover-glow hover-scale ${
            !isLoading
              ? 'bg-aqua text-white hover:bg-aqua-dark shadow-sm'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Sending...
            </>
          ) : (
            <>
              <Send size={16} />
              Send Invitation
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InvitationPromptModal;
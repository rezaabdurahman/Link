import React from 'react';
import { ArrowLeft, UserPlus, User } from 'lucide-react';

interface FoundUser {
  id: string;
  username: string;
  first_name: string;
  last_name?: string;
  profile_picture?: string;
}

interface ContactConfirmationModalProps {
  foundUser: FoundUser;
  isLoading: boolean;
  errorMessage: string;
  successMessage: string;
  onConfirm: () => void;
  onBack: () => void;
}

const ContactConfirmationModal: React.FC<ContactConfirmationModalProps> = ({
  foundUser,
  isLoading,
  errorMessage,
  successMessage,
  onConfirm,
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
        <h3 className="text-lg font-bold text-gray-900">User Found</h3>
      </div>

      {/* User preview card */}
      <div className="bg-gradient-to-r from-aqua/5 to-copper/5 rounded-xl p-4 border border-aqua/20">
        <div className="flex items-center gap-4">
          {/* Profile picture */}
          <div className="relative">
            {foundUser.profile_picture ? (
              <img 
                src={foundUser.profile_picture} 
                alt={`${foundUser.first_name}'s profile`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-aqua/20 flex items-center justify-center">
                <User size={20} className="text-aqua" />
              </div>
            )}
          </div>
          
          {/* User info */}
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">
              {foundUser.first_name}
              {foundUser.last_name && ` ${foundUser.last_name}`}
            </h4>
            <p className="text-sm text-gray-600">@{foundUser.username}</p>
          </div>
        </div>
      </div>

      {/* Confirmation text */}
      <div className="text-center py-2">
        <p className="text-gray-700">
          Is this the person you want to add to your contacts?
        </p>
        <p className="text-sm text-gray-500 mt-1">
          We'll send them a friend request on Link
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
          Not This Person
        </button>
        
        <button
          onClick={onConfirm}
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
              <UserPlus size={16} />
              Add to Contacts
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ContactConfirmationModal;
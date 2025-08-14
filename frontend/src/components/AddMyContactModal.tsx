import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Mail, Users, Phone } from 'lucide-react';

interface AddMyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddMyContactModal: React.FC<AddMyContactModalProps> = ({ isOpen, onClose }): JSX.Element => {
  const [activeTab, setActiveTab] = useState<'email' | 'contacts'>('email');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleAddByEmail = async (): Promise<void> => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage(`Invitation sent to ${email}`);
      setEmail('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    }, 1000);
  };

  const handleImportContacts = async (): Promise<void> => {
    setIsLoading(true);
    
    // Simulate contact import
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Contacts imported successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    }, 1500);
  };

  if (!isOpen) return <></>;

  // Add slide-up animation to modal

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-2xl w-full max-w-md shadow-2xl slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">Add to My Contacts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center hover-scale"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pb-4">
          <div className="flex bg-surface-hover rounded-lg p-1">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 hover-scale ${
                activeTab === 'email'
                  ? 'bg-aqua text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail size={16} />
              Email
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 hover-scale ${
                activeTab === 'contacts'
                  ? 'bg-aqua text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Phone size={16} />
              Contacts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {activeTab === 'email' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter contact's email address"
                  className="ios-text-field w-full px-4 py-3"
                  disabled={isLoading}
                />
              </div>
              
              {successMessage && (
                <div className="bg-aqua/10 border border-aqua/30 text-aqua px-4 py-3 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}

              <button
                onClick={handleAddByEmail}
                disabled={!email.trim() || isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover-glow hover-scale ${
                  email.trim() && !isLoading
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
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Import Contacts
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                  Find people who are already on Link from your contact list
                </p>
                
                {successMessage ? (
                  <div className="bg-aqua/10 border border-aqua/30 text-aqua px-4 py-3 rounded-lg text-sm mb-4">
                    {successMessage}
                  </div>
                ) : null}

                <button
                  onClick={handleImportContacts}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-2 py-3 px-6 rounded-lg font-semibold transition-all duration-200 hover-glow hover-scale ${
                    !isLoading
                      ? 'bg-aqua text-white hover:bg-aqua-dark shadow-sm'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Phone size={16} />
                      Import Contacts
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
                <strong>Privacy:</strong> We only use your contacts to find existing Link users. Your contact list is never stored or shared.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AddMyContactModal;

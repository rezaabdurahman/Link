import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Mail, Users, Phone } from 'lucide-react';
import { lookupContact, addContact, sendInvitation, getContactErrorMessage } from '../services/userClient';
import { ContactLookupRequest, AddContactRequest, SendInvitationRequest } from '../services/userClient';

interface AddMyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddMyContactModal: React.FC<AddMyContactModalProps> = ({ isOpen, onClose }): JSX.Element => {
  const [activeTab, setActiveTab] = useState<'email' | 'contacts'>('email');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showInvitation, setShowInvitation] = useState<boolean>(false);
  const [invitationMessage, setInvitationMessage] = useState<string>('Join me on Link to discover amazing people and experiences!');

  const handleAddByEmail = async (): Promise<void> => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      // First, lookup the contact to see if they exist
      const lookupRequest: ContactLookupRequest = {
        identifier: email.trim(),
        type: 'email'
      };
      
      const lookupResponse = await lookupContact(lookupRequest);
      
      if (lookupResponse.found && lookupResponse.user) {
        // User exists - send friend request
        const addContactRequest: AddContactRequest = {
          user_id: lookupResponse.user.id
        };
        
        await addContact(addContactRequest);
        setSuccessMessage(`Friend request sent to ${lookupResponse.user.first_name}!`);
        setEmail('');
        
        // Close modal after success
        setTimeout(() => {
          setSuccessMessage('');
          onClose();
        }, 2000);
        
      } else {
        // User doesn't exist - show invitation form
        setShowInvitation(true);
      }
      
    } catch (error: any) {
      setErrorMessage(getContactErrorMessage(error.error || error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitation = async (): Promise<void> => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const invitationRequest: SendInvitationRequest = {
        identifier: email.trim(),
        type: 'email',
        message: invitationMessage.trim() || undefined
      };
      
      await sendInvitation(invitationRequest);
      setSuccessMessage(`Invitation sent to ${email}!`);
      setEmail('');
      setShowInvitation(false);
      
      // Close modal after success
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
      
    } catch (error: any) {
      setErrorMessage(getContactErrorMessage(error.error || error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportContacts = async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage('');
    
    // TODO: Implement actual contact import functionality
    // For now, show a message about upcoming feature
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Contact import feature coming soon!');
      
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    }, 1000);
  };

  const handleBack = (): void => {
    setShowInvitation(false);
    setErrorMessage('');
    setSuccessMessage('');
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
              {!showInvitation ? (
                // Email lookup form
                <>
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
                  
                  {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                      {errorMessage}
                    </div>
                  )}
                  
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
                        Looking up...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Add to Contacts
                      </>
                    )}
                  </button>
                </>
              ) : (
                // Invitation form
                <>
                  <div className="text-center py-4">
                    <Mail size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      User Not Found
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {email} isn't on Link yet. Send them an invitation to join!
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Personal Message (Optional)
                    </label>
                    <textarea
                      value={invitationMessage}
                      onChange={(e) => setInvitationMessage(e.target.value)}
                      placeholder="Add a personal message to your invitation..."
                      className="ios-text-field w-full px-4 py-3 min-h-[80px] resize-none"
                      disabled={isLoading}
                      maxLength={200}
                    />
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {invitationMessage.length}/200
                    </div>
                  </div>
                  
                  {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                      {errorMessage}
                    </div>
                  )}
                  
                  {successMessage && (
                    <div className="bg-aqua/10 border border-aqua/30 text-aqua px-4 py-3 rounded-lg text-sm">
                      {successMessage}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleBack}
                      disabled={isLoading}
                      className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSendInvitation}
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
                          <Mail size={16} />
                          Send Invitation
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
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

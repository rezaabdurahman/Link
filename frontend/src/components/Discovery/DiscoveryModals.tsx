import React from 'react';
import ProfileDetailModal from '../ProfileDetailModal';
import AddCuesModal from '../AddCuesModal';
import AddBroadcastModal from '../AddBroadcastModal';
import CheckInModal from '../CheckInModal';
import CheckInSnackbar from '../CheckInSnackbar';
import Toast from '../Toast';
import { isFeatureEnabled } from '../../config/featureFlags';

interface DiscoveryModalsProps {
  // Modal states
  isProfileDetailModalOpen: boolean;
  selectedUserId: string | null;
  isAddCuesModalOpen: boolean;
  isAddBroadcastModalOpen: boolean;
  isCheckInModalOpen: boolean;
  
  // UI states
  showCheckInSnackbar: boolean;
  toast: {
    isVisible: boolean;
    message: string;
    type: 'success' | 'error';
  };
  
  // Loading states
  isBroadcastSubmitting: boolean;
  
  // Handlers
  onCloseProfileModal: () => void;
  onCloseCuesModal: () => void;
  onSubmitCue: (cueText: string) => Promise<void>;
  onCloseBroadcastModal: () => void;
  onSubmitBroadcast: (broadcastData: any) => Promise<void>;
  onCloseCheckInModal: () => void;
  onSubmitCheckIn: (checkInData: any) => Promise<void>;
  onCloseCheckInSnackbar: () => void;
  onCloseToast: () => void;
}

const DiscoveryModals: React.FC<DiscoveryModalsProps> = ({
  // Modal states
  isProfileDetailModalOpen,
  selectedUserId,
  isAddCuesModalOpen,
  isAddBroadcastModalOpen,
  isCheckInModalOpen,
  
  // UI states
  showCheckInSnackbar,
  toast,
  
  // Loading states
  isBroadcastSubmitting,
  
  // Handlers
  onCloseProfileModal,
  onCloseCuesModal,
  onSubmitCue,
  onCloseBroadcastModal,
  onSubmitBroadcast,
  onCloseCheckInModal,
  onSubmitCheckIn,
  onCloseCheckInSnackbar,
  onCloseToast,
}) => {
  return (
    <>
      {/* Profile Detail Modal */}
      {isProfileDetailModalOpen && selectedUserId && (
        <ProfileDetailModal
          userId={selectedUserId}
          onClose={onCloseProfileModal}
        />
      )}

      {/* Add Cues Modal - Feature Flagged */}
      {isFeatureEnabled('DISCOVERY_CUES') && (
        <AddCuesModal
          isOpen={isAddCuesModalOpen}
          onClose={onCloseCuesModal}
          onSubmit={onSubmitCue}
        />
      )}

      {/* Add Broadcast Modal - Feature Flagged */}
      {isFeatureEnabled('DISCOVERY_BROADCAST') && (
        <AddBroadcastModal
          isOpen={isAddBroadcastModalOpen}
          onClose={onCloseBroadcastModal}
          onSubmit={onSubmitBroadcast}
          isSubmitting={isBroadcastSubmitting}
        />
      )}

      {/* Check In Modal */}
      <CheckInModal
        isOpen={isCheckInModalOpen}
        onClose={onCloseCheckInModal}
        onSubmit={onSubmitCheckIn}
      />

      {/* Check In Success Snackbar */}
      <CheckInSnackbar
        isVisible={showCheckInSnackbar}
        onViewProfile={onCloseCheckInSnackbar}
        onUndo={onCloseCheckInSnackbar}
        onClose={onCloseCheckInSnackbar}
      />

      {/* Toast Notification */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={onCloseToast}
        />
      )}
    </>
  );
};

export default DiscoveryModals;
import React, { useState, useRef, useReducer, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { CheckinState, CheckinAction } from '../types/checkin';
import { generateMockOpportunities } from '../mocks/checkinData';
import { FriendMemory } from '../services/userClient';
import { useSocialNotesStore } from '../stores/socialNotesStore';
import { getDisplayName } from '../utils/nameHelpers';
import CloseFriendsModal from '../components/CloseFriendsModal';
import SocialNotesSection from '../components/SocialNotesSection';
import MemoryEditModal from '../components/MemoryEditModal';
import MemoryDeleteConfirmation from '../components/MemoryDeleteConfirmation';
import { 
  getOpportunities, 
  generateOpportunities, 
  acceptOpportunity, 
  rejectOpportunity, 
  type Opportunity as ApiOpportunity 
} from '../services/opportunitiesClient';

// State reducer for managing check-in related opportunities
const opportunityReducer = (state: Pick<CheckinState, 'opportunities'>, action: CheckinAction): Pick<CheckinState, 'opportunities'> => {
  switch (action.type) {
    case 'UPDATE_OPPORTUNITY':
      return {
        opportunities: state.opportunities.map(opp => 
          opp.id === action.payload.id
            ? { ...opp, status: action.payload.status }
            : opp
        )
      };
    case 'REFRESH_OPPORTUNITIES':
      return {
        opportunities: [...action.payload, ...state.opportunities.filter(opp => opp.status !== 'rejected')]
      };
    default:
      return state;
  }
};

const OpportunitiesPage: React.FC = (): JSX.Element => {
  // Real opportunities state from API
  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  
  // Social opportunities state from check-ins (keep for backward compatibility)
  const [socialOpportunitiesState, socialOpportunitiesDispatch] = useReducer(opportunityReducer, {
    opportunities: generateMockOpportunities()
  });
  
  // Close Friends modal state
  const [isCloseFriendsModalOpen, setIsCloseFriendsModalOpen] = useState<boolean>(false);
  
  // Memory Edit modal state
  const [isMemoryEditModalOpen, setIsMemoryEditModalOpen] = useState<boolean>(false);
  const [selectedMemory, setSelectedMemory] = useState<FriendMemory | null>(null);
  const [selectedFriendName, setSelectedFriendName] = useState<string>('');
  const [selectedFriendAvatar, setSelectedFriendAvatar] = useState<string>('');
  
  // Memory Delete confirmation modal state
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState<boolean>(false);
  const [memoryToDelete, setMemoryToDelete] = useState<FriendMemory | null>(null);
  
  const opportunitiesRef = useRef<HTMLDivElement>(null);

  // Load opportunities on component mount
  useEffect(() => {
    loadOpportunities();
  }, []);

  // Load opportunities from API
  const loadOpportunities = async (): Promise<void> => {
    try {
      setIsLoadingOpportunities(true);
      setOpportunityError(null);
      
      const response = await getOpportunities('pending', 10);
      setOpportunities(response.opportunities);
      
      // If no opportunities exist, try to generate some
      if (response.opportunities.length === 0) {
        console.log('No opportunities found, generating new ones...');
        const generateResponse = await generateOpportunities();
        setOpportunities(generateResponse.opportunities);
      }
    } catch (error) {
      console.error('Error loading opportunities:', error);
      setOpportunityError('Failed to load opportunities');
      // Fall back to mock data on error
      setOpportunities([]);
    } finally {
      setIsLoadingOpportunities(false);
    }
  };

  // Handle real opportunity actions
  const handleOpportunityAction = async (opportunityId: string, action: 'accepted' | 'rejected'): Promise<void> => {
    try {
      if (action === 'accepted') {
        await acceptOpportunity(opportunityId, undefined, undefined);
      } else {
        await rejectOpportunity(opportunityId, undefined, undefined);
      }

      // Update local state
      setOpportunities(prev => 
        prev.map(opp => 
          opp.id === opportunityId 
            ? { ...opp, status: action }
            : opp
        )
      );

      // Generate new opportunities to replace the actioned one
      try {
        const generateResponse = await generateOpportunities();
        if (generateResponse.opportunities.length > 0) {
          setOpportunities(prev => [
            ...prev.filter(opp => opp.id !== opportunityId),
            ...generateResponse.opportunities
          ]);
        }
      } catch (genError) {
        console.error('Error generating new opportunities:', genError);
      }

    } catch (error) {
      console.error('Error handling opportunity action:', error);
      // Show error to user or revert state
    }
  };

  // Opportunity management for social opportunities (legacy)
  const handleSocialOpportunityAction = (opportunityId: string, action: 'accepted' | 'rejected'): void => {
    socialOpportunitiesDispatch({
      type: 'UPDATE_OPPORTUNITY',
      payload: { id: opportunityId, status: action }
    });
  };
  
  const pendingSocialOpportunities = socialOpportunitiesState.opportunities.filter(opp => opp.status === 'pending');

  const { loadingStates } = useSocialNotesStore();

  // Handle close friends save
  const handleCloseFriendsSave = (selectedFriendIds: string[]): void => {
    console.log('Close friends updated:', selectedFriendIds);
    // TODO: Persist to context or API
  };

  // Handle friend selection (when selecting from dropdown)
  const handleFriendSelect = (_friendId: string): void => {
    // This is handled by the SocialNotesSection component
  };

  // Handle memory edit modal
  const handleEditMemory = (memoryId: string, friendId: string): void => {
    const { selectedFriend, memories } = useSocialNotesStore.getState();
    
    if (selectedFriend) {
      const friendMemories = memories.get(friendId) || [];
      const memory = friendMemories.find(m => m.id === memoryId);
      
      if (memory) {
        setSelectedMemory(memory);
        setSelectedFriendName(getDisplayName(selectedFriend));
        setSelectedFriendAvatar(selectedFriend.profile_picture || '');
        setIsMemoryEditModalOpen(true);
      }
    }
  };

  // Handle memory deletion confirmation
  const handleDeleteMemory = (memoryId: string): void => {
    const { selectedFriend, memories } = useSocialNotesStore.getState();
    
    if (selectedFriend) {
      const friendMemories = memories.get(selectedFriend.id) || [];
      const memory = friendMemories.find(m => m.id === memoryId);
      
      if (memory) {
        setMemoryToDelete(memory);
        setSelectedFriendName(getDisplayName(selectedFriend));
        setIsDeleteConfirmationOpen(true);
      }
    }
  };

  // Confirm memory deletion
  const handleConfirmDelete = async (): Promise<void> => {
    if (memoryToDelete) {
      const { deleteMemory } = useSocialNotesStore.getState();
      await deleteMemory(memoryToDelete.id);
      setIsDeleteConfirmationOpen(false);
      setMemoryToDelete(null);
    }
  };

  // Cancel memory deletion
  const handleCancelDelete = (): void => {
    setIsDeleteConfirmationOpen(false);
    setMemoryToDelete(null);
  };

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <h1 className="text-2xl font-bold text-gradient-aqua-copper" style={{ marginBottom: '4px' }}>
          Opportunities
        </h1>
        <p className="text-secondary" style={{ fontSize: '14px' }}>
          Manage your social connections and close friends
        </p>
      </div>

      {/* Real Opportunities from API */}
      {!isLoadingOpportunities && opportunities.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Personalized Opportunities</h2>
            <button
              onClick={loadOpportunities}
              className="text-xs text-aqua hover:text-aqua-dark focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 rounded transition-colors motion-reduce:transition-none"
              aria-label="Refresh opportunities"
            >
              Refresh
            </button>
          </div>
          
          <div 
            ref={opportunitiesRef}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`div::-webkit-scrollbar { display: none; }`}</style>
            {opportunities.filter(opp => opp.status === 'pending').map((opportunity) => (
              <motion.div
                key={opportunity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-64 ios-card p-4"
              >
                <div className="mb-3">
                  <div className="text-sm font-semibold text-text-primary mb-1">
                    {opportunity.title}
                  </div>
                  <div className="text-xs text-text-secondary line-clamp-2">
                    {opportunity.description}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {opportunity.opportunity_type} • Score: {opportunity.priority_score.toFixed(2)}
                  </div>
                </div>
                
                {opportunity.expires_at && (
                  <div className="text-xs text-text-muted mb-3">
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>Expires {new Date(opportunity.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpportunityAction(opportunity.id, 'rejected')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-text-muted border border-surface-border rounded-ios hover:bg-surface-hover transition-colors"
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => handleOpportunityAction(opportunity.id, 'accepted')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-aqua hover:bg-aqua-dark rounded-ios transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingOpportunities && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Loading Opportunities...</h2>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-64 ios-card p-4 animate-pulse">
                <div className="h-4 bg-surface-hover rounded mb-2"></div>
                <div className="h-3 bg-surface-hover rounded mb-1"></div>
                <div className="h-3 bg-surface-hover rounded w-3/4 mb-3"></div>
                <div className="flex gap-2">
                  <div className="flex-1 h-8 bg-surface-hover rounded"></div>
                  <div className="flex-1 h-8 bg-surface-hover rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {opportunityError && (
        <div className="mb-6">
          <div className="ios-card p-4 bg-red-50 border border-red-200">
            <div className="text-sm text-red-600 mb-2">{opportunityError}</div>
            <button
              onClick={loadOpportunities}
              className="text-xs text-red-700 hover:text-red-800 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Social Opportunities Carousel - From Check-ins (Legacy) */}
      {pendingSocialOpportunities.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Social Opportunities</h2>
            <button
              onClick={() => setIsCloseFriendsModalOpen(true)}
              className="text-xs text-aqua hover:text-aqua-dark focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 rounded transition-colors motion-reduce:transition-none"
              aria-label="Manage close friends list"
            >
              Manage Close Friends
            </button>
          </div>
          
          <div 
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`div::-webkit-scrollbar { display: none; }`}</style>
            {pendingSocialOpportunities.map((opportunity) => (
              <motion.div
                key={opportunity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-64 ios-card p-4"
              >
                <div className="mb-3">
                  <div className="text-sm font-semibold text-text-primary mb-1">
                    {opportunity.title}
                  </div>
                  <div className="text-xs text-text-secondary line-clamp-2">
                    {opportunity.description}
                  </div>
                </div>
                
                {opportunity.details && (
                  <div className="text-xs text-text-muted mb-3">
                    {opportunity.details.date && (
                      <div className="flex items-center gap-1 mb-1">
                        <Clock size={10} />
                        <span>{opportunity.details.date}</span>
                      </div>
                    )}
                    {opportunity.details.location && (
                      <div className="flex items-center gap-1">
                        <MapPin size={10} />
                        <span>{opportunity.details.location}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSocialOpportunityAction(opportunity.id, 'rejected')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-text-muted border border-surface-border rounded-ios hover:bg-surface-hover transition-colors"
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => handleSocialOpportunityAction(opportunity.id, 'accepted')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-aqua hover:bg-aqua-dark rounded-ios transition-colors"
                  >
                    {opportunity.actionLabel || 'Accept'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      
      {/* Social Notes Section */}
      <div className="mb-8">
        <SocialNotesSection 
          onFriendSelect={handleFriendSelect}
          onEditMemory={handleEditMemory}
          onDeleteMemory={handleDeleteMemory}
        />
      </div>
      
      {/* Close Friends Modal */}
      <CloseFriendsModal
        isOpen={isCloseFriendsModalOpen}
        onClose={() => setIsCloseFriendsModalOpen(false)}
        onSave={handleCloseFriendsSave}
      />
      
      {/* Memory Edit Modal */}
      <MemoryEditModal
        isOpen={isMemoryEditModalOpen}
        memory={selectedMemory}
        friendName={selectedFriendName}
        friendAvatar={selectedFriendAvatar}
        onClose={() => {
          setIsMemoryEditModalOpen(false);
          setSelectedMemory(null);
          setSelectedFriendName('');
          setSelectedFriendAvatar('');
        }}
      />
      
      {/* Memory Delete Confirmation Modal */}
      <MemoryDeleteConfirmation
        isOpen={isDeleteConfirmationOpen}
        memory={memoryToDelete}
        friendName={selectedFriendName}
        isDeleting={loadingStates.deleting === memoryToDelete?.id}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default OpportunitiesPage;

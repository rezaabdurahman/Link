import React, { useState, useRef, useReducer } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { CheckinState, CheckinAction } from '../types/checkin';
import { generateMockOpportunities } from '../mocks/checkinData';
import CloseFriendsModal from '../components/CloseFriendsModal';
import SocialNotesSection from '../components/SocialNotesSection';
import NoteEditModal from '../components/NoteEditModal';
// Additional imports will be added as we build new components

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
  // Social opportunities state from check-ins
  const [socialOpportunitiesState, socialOpportunitiesDispatch] = useReducer(opportunityReducer, {
    opportunities: generateMockOpportunities()
  });
  
  // Close Friends modal state
  const [isCloseFriendsModalOpen, setIsCloseFriendsModalOpen] = useState<boolean>(false);
  
  // Note Edit modal state
  const [isNoteEditModalOpen, setIsNoteEditModalOpen] = useState<boolean>(false);
  const [selectedFriendForNotes, setSelectedFriendForNotes] = useState<string | null>(null);
  
  const opportunitiesRef = useRef<HTMLDivElement>(null);

  // Opportunity management for social opportunities
  const handleSocialOpportunityAction = (opportunityId: string, action: 'accepted' | 'rejected'): void => {
    socialOpportunitiesDispatch({
      type: 'UPDATE_OPPORTUNITY',
      payload: { id: opportunityId, status: action }
    });
  };
  
  const pendingSocialOpportunities = socialOpportunitiesState.opportunities.filter(opp => opp.status === 'pending');

  // Handle close friends save
  const handleCloseFriendsSave = (selectedFriendIds: string[]): void => {
    console.log('Close friends updated:', selectedFriendIds);
    // TODO: Persist to context or API
  };

  // Handle opening note edit modal
  const handleEditNotes = (friendId: string): void => {
    setSelectedFriendForNotes(friendId);
    setIsNoteEditModalOpen(true);
  };

  // Handle saving notes
  const handleSaveNotes = (notes: unknown[]): void => {
    console.log('Notes saved:', notes);
    // TODO: Persist notes to state/API
  };

  // Handle generating AI summary
  const handleGenerateAISummary = (friendId: string): void => {
    console.log('Regenerating AI summary for:', friendId);
    // TODO: Trigger AI summary regeneration
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

      {/* Social Opportunities Carousel - From Check-ins */}
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
            ref={opportunitiesRef}
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
          onFriendSelect={handleEditNotes}
        />
      </div>
      
      {/* Close Friends Modal */}
      <CloseFriendsModal
        isOpen={isCloseFriendsModalOpen}
        onClose={() => setIsCloseFriendsModalOpen(false)}
        onSave={handleCloseFriendsSave}
      />
      
      {/* Note Edit Modal */}
      <NoteEditModal
        isOpen={isNoteEditModalOpen}
        friendId={selectedFriendForNotes}
        onClose={() => {
          setIsNoteEditModalOpen(false);
          setSelectedFriendForNotes(null);
        }}
        onSave={handleSaveNotes}
        onGenerateAISummary={handleGenerateAISummary}
      />
    </div>
  );
};

export default OpportunitiesPage;

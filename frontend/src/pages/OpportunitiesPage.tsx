import React, { useState, useRef, useReducer } from 'react';
import { Calendar, Clock, MapPin, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { opportunities } from '../data/mockData';
import { Opportunity } from '../types';
import { CheckinState, CheckinAction } from '../types/checkin';
import { generateMockOpportunities } from '../mocks/checkinData';
import OpportunityCard from '../components/OpportunityCard';

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
  const [filter, setFilter] = useState<string>('all');
  
  // Social opportunities state from check-ins
  const [socialOpportunitiesState, socialOpportunitiesDispatch] = useReducer(opportunityReducer, {
    opportunities: generateMockOpportunities()
  });
  
  const opportunitiesRef = useRef<HTMLDivElement>(null);

  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'all') return true;
    return opp.type === filter;
  });

  // Opportunity management for social opportunities
  const handleSocialOpportunityAction = (opportunityId: string, action: 'accepted' | 'rejected') => {
    socialOpportunitiesDispatch({
      type: 'UPDATE_OPPORTUNITY',
      payload: { id: opportunityId, status: action }
    });
  };
  
  const handleOpportunityAction = (opportunity: Opportunity, action: string): void => {
    console.log(`${action} opportunity:`, opportunity.title);
    // Here you would implement the actual action logic
  };

  const getFilterCount = (filterType: string): number => {
    if (filterType === 'all') return opportunities.length;
    return opportunities.filter(opp => opp.type === filterType).length;
  };
  
  const pendingSocialOpportunities = socialOpportunitiesState.opportunities.filter(opp => opp.status === 'pending');

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '24px',
        paddingTop: '20px'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
          Opportunities
        </h1>
        <p className="text-secondary" style={{ fontSize: '14px' }}>
          AI-powered suggestions to strengthen your connections
        </p>
      </div>

      {/* AI Insights Card */}
      <div className="ios-card fade-in" style={{ 
        padding: '20px', 
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(45, 212, 191, 0.1) 100%)',
        borderColor: 'rgba(6, 182, 212, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Sparkles size={24} color="#06b6d4" />
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
            AI Insights
          </h3>
        </div>
        <p className="text-secondary" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          You have <strong className="text-primary">3 friends</strong> you haven't connected with in over a month. 
          The best time for meetups is <strong className="text-primary">weekends</strong> based on everyone's activity patterns.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { key: 'all', label: 'All', icon: Calendar },
          { key: 'reminder', label: 'Reminders', icon: Clock },
          { key: 'ai-suggestion', label: 'AI Suggested', icon: Sparkles },
          { key: 'seasonal', label: 'Seasonal', icon: MapPin }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.key;
          const count = getFilterCount(tab.key);
          
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="haptic-light"
              style={{
                background: isActive ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)',
                border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                padding: '8px 16px',
                color: isActive ? 'white' : '#000000',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(6, 182, 212, 0.3)',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Social Opportunities Carousel - From Check-ins */}
      {pendingSocialOpportunities.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Social Opportunities</h2>
            <div className="text-xs text-text-muted">Swipe to explore</div>
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

      {/* Opportunities List */}
      <div style={{ marginBottom: '20px', paddingBottom: '4px' }}>
        {filteredOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onAccept={() => handleOpportunityAction(opportunity, 'accept')}
            onDismiss={() => handleOpportunityAction(opportunity, 'dismiss')}
          />
        ))}
      </div>

      {filteredOpportunities.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
            No opportunities yet
          </h3>
          <p style={{ fontSize: '14px' }}>
            Check back later for AI-powered suggestions to connect with friends!
          </p>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesPage;

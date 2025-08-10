import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Sparkles } from 'lucide-react';
import { opportunities } from '../data/mockData';
import { Opportunity } from '../types';
import OpportunityCard from '../components/OpportunityCard';

const OpportunitiesPage: React.FC = (): JSX.Element => {
  const [filter, setFilter] = useState<string>('all');

  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'all') return true;
    return opp.type === filter;
  });

  const handleOpportunityAction = (opportunity: Opportunity, action: string): void => {
    console.log(`${action} opportunity:`, opportunity.title);
    // Here you would implement the actual action logic
  };

  const getFilterCount = (filterType: string): number => {
    if (filterType === 'all') return opportunities.length;
    return opportunities.filter(opp => opp.type === filterType).length;
  };

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

      {/* Opportunities List */}
      <div style={{ marginBottom: '100px' }}>
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

import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Sparkles } from 'lucide-react';
import { opportunities } from '../data/mockData';
import { Opportunity } from '../types';
import { Opportunity as CheckinOpportunity } from '../types/checkin';
import OpportunityCard from '../components/OpportunityCard';
import SocialOpportunitiesCarousel from '../components/SocialOpportunitiesCarousel';

const OpportunitiesPage: React.FC = (): JSX.Element => {
  const [filter, setFilter] = useState<string>('all');

  // Mock social opportunities for the carousel (checkin Opportunity type)
  const socialOpportunities: CheckinOpportunity[] = [
    {
      id: 'social-1',
      type: 'event',
      title: 'Coffee with Jamie',
      description: 'Catch up over coffee in the Mission District',
      status: 'pending',
      actionLabel: 'Schedule',
      details: {
        date: 'Tomorrow 3pm',
        location: 'Mission District'
      }
    },
    {
      id: 'social-2',
      type: 'activity',
      title: 'Weekend Hiking Group',
      description: 'Join a group hike in Marin Headlands',
      status: 'pending',
      details: {
        date: 'Saturday 8am',
        location: 'Marin Headlands'
      }
    },
    {
      id: 'social-3',
      type: 'person',
      title: 'Reconnect with Marcus',
      description: 'It has been 6 weeks since you last talked',
      status: 'pending',
      actionLabel: 'Message',
      details: {
        personName: 'Marcus Rodriguez'
      }
    }
  ];

  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'all') return true;
    return opp.type === filter;
  });

  const handleOpportunityAction = (opportunity: Opportunity, action: string): void => {
    console.log(`${action} opportunity:`, opportunity.title);
    // Here you would implement the actual action logic
  };

  const handleSocialOpportunityAction = (opportunityId: string, action: 'accepted' | 'rejected'): void => {
    console.log(`${action} social opportunity:`, opportunityId);
    // Here you would implement the actual action logic for social opportunities
  };

  const getFilterCount = (filterType: string): number => {
    if (filterType === 'all') return opportunities.length;
    return opportunities.filter(opp => opp.type === filterType).length;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 pb-20 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">
            Opportunities
          </h1>
          <p className="text-text-secondary text-sm">
            AI-powered suggestions to strengthen your connections
          </p>
        </div>

        {/* AI Insights Card */}
        <div className="ios-card mb-6 p-5 bg-gradient-to-br from-aqua/10 to-emerald-100/10 border-aqua/30">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles size={24} className="text-aqua" />
            <h3 className="text-base font-semibold text-text-primary">
              AI Insights
            </h3>
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            You have <strong className="text-aqua">3 friends</strong> you haven't connected with in over a month. 
            The best time for meetups is <strong className="text-aqua">weekends</strong> based on everyone's activity patterns.
          </p>
        </div>

        {/* Social Opportunities Carousel */}
        <SocialOpportunitiesCarousel 
          opportunities={socialOpportunities} 
          onAction={handleSocialOpportunityAction} 
        />

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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
                className={`haptic-light flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive 
                    ? 'bg-aqua text-white' 
                    : 'bg-surface-hover text-text-primary hover:bg-surface-primary'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs min-w-[18px] text-center ${
                    isActive 
                      ? 'bg-white/30' 
                      : 'bg-aqua/20 text-aqua'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Opportunities List */}
        <div className="mb-5 pb-1">
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
          <div className="text-center py-10 px-5 text-text-muted">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2 text-text-primary">
              No opportunities yet
            </h3>
            <p className="text-sm">
              Check back later for AI-powered suggestions to connect with friends!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpportunitiesPage;

import React, { useRef } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Opportunity } from '../types/checkin';

interface SocialOpportunitiesCarouselProps {
  opportunities: Opportunity[];
  onAction: (opportunityId: string, action: 'accepted' | 'rejected') => void;
}

const SocialOpportunitiesCarousel: React.FC<SocialOpportunitiesCarouselProps> = ({
  opportunities,
  onAction
}): JSX.Element => {
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const pendingOpportunities = opportunities.filter(opp => opp.status === 'pending');

  if (pendingOpportunities.length === 0) {
    return <></>;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Social Opportunities</h2>
        <div className="text-xs text-text-muted">Swipe to explore</div>
      </div>
      
      <div 
        ref={carouselRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {pendingOpportunities.map((opportunity) => (
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
                onClick={() => onAction(opportunity.id, 'rejected')}
                className="flex-1 px-3 py-2 text-xs font-medium text-text-muted border border-surface-border rounded-ios hover:bg-surface-hover transition-colors"
              >
                Pass
              </button>
              <button
                onClick={() => onAction(opportunity.id, 'accepted')}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-aqua hover:bg-aqua-dark rounded-ios transition-colors"
              >
                {opportunity.actionLabel || 'Accept'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SocialOpportunitiesCarousel;

import React from 'react';
import { MapPin, Crown } from 'lucide-react';
import { useSubscription } from '../stores/subscriptionStore';

interface UsageIndicatorProps {
  showUpgrade?: boolean;
}

const UsageIndicator: React.FC<UsageIndicatorProps> = ({ 
  showUpgrade = true 
}): JSX.Element | null => {
  const { limits, isProUser } = useSubscription();

  if (!limits) return null;

  const remainingDiscoveries = limits.remaining_discoveries;
  const totalDiscoveries = limits.max_discovery_per_month;
  const usagePercentage = ((totalDiscoveries - remainingDiscoveries) / totalDiscoveries) * 100;
  
  const isLowOnDiscoveries = remainingDiscoveries <= 2;
  const hasNoDiscoveries = remainingDiscoveries === 0;

  return (
    <div 
      className="ios-card"
      style={{
        padding: '16px',
        background: hasNoDiscoveries 
          ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)'
          : isLowOnDiscoveries
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.05) 100%)'
          : undefined,
        border: hasNoDiscoveries
          ? '1px solid rgba(220, 38, 38, 0.2)'
          : isLowOnDiscoveries
          ? '1px solid rgba(245, 158, 11, 0.2)'
          : '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <MapPin size={20} style={{ 
          color: hasNoDiscoveries 
            ? '#ef4444' 
            : isLowOnDiscoveries 
            ? '#f59e0b' 
            : '#06b6d4' 
        }} />
        <div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: '600',
            color: hasNoDiscoveries ? '#ef4444' : undefined
          }}>
            {hasNoDiscoveries ? 'No discoveries left' : `${remainingDiscoveries} discoveries remaining`}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
            {remainingDiscoveries} / {totalDiscoveries} this month • {limits.max_radius_km} km radius
          </div>
        </div>
        {!isProUser() && showUpgrade && (
          <Crown size={16} style={{ color: '#f59e0b', marginLeft: 'auto' }} />
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '4px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: showUpgrade && !isProUser() && isLowOnDiscoveries ? '12px' : undefined
      }}>
        <div style={{
          width: `${usagePercentage}%`,
          height: '100%',
          background: hasNoDiscoveries
            ? '#ef4444'
            : isLowOnDiscoveries
            ? '#f59e0b'
            : '#06b6d4',
          borderRadius: '2px',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Upgrade prompt for low usage */}
      {showUpgrade && !isProUser() && isLowOnDiscoveries && (
        <div style={{
          fontSize: '13px',
          color: '#f59e0b',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          {hasNoDiscoveries 
            ? 'Upgrade to Pro for 15 discoveries/month' 
            : 'Running low? Pro gives you 15 discoveries/month'
          }
        </div>
      )}
    </div>
  );
};

export default UsageIndicator;
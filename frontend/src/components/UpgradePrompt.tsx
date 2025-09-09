import React from 'react';
import { Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  feature: string;
  message: string;
  compact?: boolean;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ 
  feature, 
  message, 
  compact = false 
}): JSX.Element => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate('/subscription');
  };

  if (compact) {
    return (
      <div 
        className="ios-card"
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }}
        onClick={handleUpgrade}
      >
        <Crown size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: '14px' }}>{message}</div>
        <ArrowRight size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div className="ios-card" style={{
      padding: '24px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.2)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px'
      }}>
        <Crown size={24} style={{ color: 'white' }} />
      </div>

      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '8px',
        background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent'
      }}>
        Upgrade to Pro
      </h3>

      <p style={{
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: '20px',
        lineHeight: '1.5'
      }}>
        {message}
      </p>

      <button
        onClick={handleUpgrade}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        className="haptic-light"
      >
        View Plans
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

export default UpgradePrompt;
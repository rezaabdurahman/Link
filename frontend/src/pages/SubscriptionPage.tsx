import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Crown, Users, MapPin, MessageSquare, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../stores/subscriptionStore';

const SubscriptionPage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    currentSubscription,
    availablePlans,
    limits,
    loading,
    error,
    fetchSubscription,
    fetchPlans,
    createCheckoutSession,
    createCustomerPortalSession,
    isProUser,
  } = useSubscription();

  const [processingUpgrade, setProcessingUpgrade] = useState(false);
  const [processingPortal, setProcessingPortal] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, [fetchSubscription, fetchPlans]);

  const handleUpgrade = async () => {
    if (processingUpgrade) return;

    setProcessingUpgrade(true);
    try {
      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/subscription`;
      
      const checkoutUrl = await createCheckoutSession('pro', successUrl, cancelUrl);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setProcessingUpgrade(false);
    }
  };

  const handleManageSubscription = async () => {
    if (processingPortal) return;

    setProcessingPortal(true);
    try {
      const returnUrl = `${window.location.origin}/subscription`;
      const portalUrl = await createCustomerPortalSession(returnUrl);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      alert('Failed to open subscription management. Please try again.');
    } finally {
      setProcessingPortal(false);
    }
  };

  const handleBack = (): void => {
    navigate('/settings');
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const basicPlan = availablePlans.find(plan => plan.tier === 'basic');
  const proPlan = availablePlans.find(plan => plan.tier === 'pro');

  if (loading) {
    return (
      <div className="ios-safe-area" style={{ padding: '0 20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '200px'
        }}>
          <div>Loading subscription information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-safe-area" style={{ padding: '0 20px' }}>
        <div style={{ 
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          margin: '20px 0',
          color: '#dc2626'
        }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '16px',
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'rgba(6, 182, 212, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#06b6d4'
          }}
          className="haptic-light"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#06b6d4' }}>
          Subscription Plans
        </h1>
      </div>

      {/* Current Usage Stats */}
      {limits && (
        <div className="ios-card" style={{ marginBottom: '24px', padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Current Usage
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px' }}>
                Discoveries Remaining
              </div>
              <div style={{ fontSize: '20px', fontWeight: '600' }}>
                {limits.remaining_discoveries} / {limits.max_discovery_per_month}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px' }}>
                Max Search Radius
              </div>
              <div style={{ fontSize: '20px', fontWeight: '600' }}>
                {limits.max_radius_km} km
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Basic Plan */}
        {basicPlan && (
          <div 
            className="ios-card"
            style={{ 
              padding: '24px',
              border: currentSubscription?.plan.tier === 'basic' 
                ? '2px solid #06b6d4' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative'
            }}
          >
            {currentSubscription?.plan.tier === 'basic' && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#06b6d4',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                Current Plan
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Users size={24} style={{ color: '#06b6d4' }} />
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
                  {basicPlan.name}
                </h3>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#06b6d4' }}>
                  Free
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>{basicPlan.features.max_discovery_per_month} new discoveries per month</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>Up to {basicPlan.features.max_radius_km} km search radius</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>Unlimited chats with existing friends</span>
              </div>
            </div>

            {currentSubscription?.plan.tier === 'basic' && (
              <div style={{ 
                fontSize: '14px', 
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center'
              }}>
                You're on the free plan
              </div>
            )}
          </div>
        )}

        {/* Pro Plan */}
        {proPlan && (
          <div 
            className="ios-card"
            style={{ 
              padding: '24px',
              border: currentSubscription?.plan.tier === 'pro' 
                ? '2px solid #f59e0b' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              background: currentSubscription?.plan.tier === 'pro' 
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)'
                : undefined
            }}
          >
            {currentSubscription?.plan.tier === 'pro' ? (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#f59e0b',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                Current Plan
              </div>
            ) : (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                Popular
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Crown size={24} style={{ color: '#f59e0b' }} />
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
                  {proPlan.name}
                </h3>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                  {formatPrice(proPlan.price_cents)}/month
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>{proPlan.features.max_discovery_per_month} new discoveries per month</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>Up to {proPlan.features.max_radius_km} km search radius</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>Unlimited chats with existing friends</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} style={{ color: '#10b981' }} />
                <span>Priority customer support</span>
              </div>
            </div>

            {!isProUser() ? (
              <button
                onClick={handleUpgrade}
                disabled={processingUpgrade}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: processingUpgrade ? 'not-allowed' : 'pointer',
                  opacity: processingUpgrade ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
                className="haptic-light"
              >
                {processingUpgrade ? 'Starting upgrade...' : 'Upgrade to Pro'}
              </button>
            ) : (
              <button
                onClick={handleManageSubscription}
                disabled={processingPortal}
                style={{
                  width: '100%',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: processingPortal ? 'not-allowed' : 'pointer',
                  opacity: processingPortal ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
                className="haptic-light"
              >
                {processingPortal ? 'Opening...' : 'Manage Subscription'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feature Comparison */}
      <div className="ios-card" style={{ marginTop: '32px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
          Feature Comparison
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'center' }}>
          {/* Header */}
          <div></div>
          <div style={{ textAlign: 'center', fontWeight: '600' }}>Basic</div>
          <div style={{ textAlign: 'center', fontWeight: '600' }}>Pro</div>
          
          {/* Monthly Discoveries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} style={{ color: '#06b6d4' }} />
            <span>Monthly Discoveries</span>
          </div>
          <div style={{ textAlign: 'center' }}>5</div>
          <div style={{ textAlign: 'center' }}>15</div>
          
          {/* Search Radius */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: '#06b6d4' }} />
            <span>Search Radius</span>
          </div>
          <div style={{ textAlign: 'center' }}>1 km</div>
          <div style={{ textAlign: 'center' }}>3 km</div>
          
          {/* Unlimited Chats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} style={{ color: '#06b6d4' }} />
            <span>Unlimited Chats</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Check size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <Check size={16} style={{ color: '#10b981' }} />
          </div>
          
          {/* Priority Support */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={16} style={{ color: '#06b6d4' }} />
            <span>Priority Support</span>
          </div>
          <div style={{ textAlign: 'center' }}>-</div>
          <div style={{ textAlign: 'center' }}>
            <Check size={16} style={{ color: '#10b981' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
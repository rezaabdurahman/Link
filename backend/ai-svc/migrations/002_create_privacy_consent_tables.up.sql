-- Privacy and Consent Management Tables

-- User consent preferences table
CREATE TABLE user_consent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    ai_processing_consent BOOLEAN NOT NULL DEFAULT false,
    data_anonymization_consent BOOLEAN NOT NULL DEFAULT false,
    analytics_consent BOOLEAN NOT NULL DEFAULT false,
    marketing_consent BOOLEAN NOT NULL DEFAULT false,
    consent_version VARCHAR(10) NOT NULL DEFAULT '1.0',
    consent_given_at TIMESTAMP WITH TIME ZONE,
    consent_withdrawn_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Audit log table for GDPR/CCPA compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- TTL for automatic cleanup (default 7 years for GDPR compliance)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 years'
);

-- Privacy policy versions for tracking consent changes
CREATE TABLE privacy_policy_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(10) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT false
);

-- Data anonymization records
CREATE TABLE data_anonymization_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    original_data_hash VARCHAR(64) NOT NULL,
    anonymized_data_hash VARCHAR(64) NOT NULL,
    anonymization_method VARCHAR(50) NOT NULL,
    fields_anonymized TEXT[] NOT NULL,
    anonymized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_consent_user_id ON user_consent(user_id);
CREATE INDEX idx_user_consent_ai_processing ON user_consent(ai_processing_consent);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_expires_at ON audit_logs(expires_at);

CREATE INDEX idx_privacy_policy_versions_version ON privacy_policy_versions(version);
CREATE INDEX idx_privacy_policy_versions_active ON privacy_policy_versions(is_active);

CREATE INDEX idx_data_anonymization_user_id ON data_anonymization_records(user_id);
CREATE INDEX idx_data_anonymization_anonymized_at ON data_anonymization_records(anonymized_at);

-- Add trigger for user_consent updated_at
CREATE TRIGGER update_user_consent_updated_at 
    BEFORE UPDATE ON user_consent 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add automatic cleanup job for expired audit logs (PostgreSQL background worker approach)
-- Note: In production, you might want to use a proper job scheduler like pg_cron
CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE expires_at < NOW();
    
    -- Log the cleanup operation
    INSERT INTO audit_logs (action, resource_type, details, created_at, expires_at)
    VALUES (
        'AUDIT_CLEANUP',
        'audit_logs',
        '{"description": "Automated cleanup of expired audit logs"}',
        NOW(),
        NOW() + INTERVAL '7 years'
    );
END;
$$ LANGUAGE plpgsql;

-- Insert default privacy policy version
INSERT INTO privacy_policy_versions (version, content, effective_date, is_active)
VALUES (
    '1.0',
    'Default Privacy Policy Content - This should be replaced with actual privacy policy text.',
    NOW(),
    true
);

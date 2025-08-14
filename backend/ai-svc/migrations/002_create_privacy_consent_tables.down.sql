-- Drop privacy and consent management tables

-- Drop cleanup function
DROP FUNCTION IF EXISTS cleanup_expired_audit_logs();

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS data_anonymization_records;
DROP TABLE IF EXISTS privacy_policy_versions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_consent;

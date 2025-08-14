-- Drop triggers
DROP TRIGGER IF EXISTS update_ai_usage_stats_updated_at ON ai_usage_stats;
DROP TRIGGER IF EXISTS update_ai_requests_updated_at ON ai_requests;
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_ai_usage_stats_model;
DROP INDEX IF EXISTS idx_ai_usage_stats_date;
DROP INDEX IF EXISTS idx_ai_usage_stats_user_id;

DROP INDEX IF EXISTS idx_ai_responses_created_at;
DROP INDEX IF EXISTS idx_ai_responses_request_id;

DROP INDEX IF EXISTS idx_ai_requests_created_at;
DROP INDEX IF EXISTS idx_ai_requests_status;
DROP INDEX IF EXISTS idx_ai_requests_conversation_id;
DROP INDEX IF EXISTS idx_ai_requests_user_id;

DROP INDEX IF EXISTS idx_ai_conversations_created_at;
DROP INDEX IF EXISTS idx_ai_conversations_status;
DROP INDEX IF EXISTS idx_ai_conversations_user_id;

-- Drop tables in reverse order due to foreign key constraints
DROP TABLE IF EXISTS ai_usage_stats;
DROP TABLE IF EXISTS ai_responses;
DROP TABLE IF EXISTS ai_requests;
DROP TABLE IF EXISTS ai_conversations;

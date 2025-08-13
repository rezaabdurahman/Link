-- Migration: Drop ranking_config table
-- Version: 002 (DOWN)
-- Description: Removes the ranking_config table and all associated objects

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_ranking_config_updated_at ON ranking_config;
DROP FUNCTION IF EXISTS update_ranking_config_updated_at();

-- Drop index
DROP INDEX IF EXISTS idx_ranking_config_key;

-- Drop table
DROP TABLE IF EXISTS ranking_config;

-- Migration: Create ranking_config table
-- Version: 002
-- Description: Creates a configuration table for ranking algorithm weights

CREATE TABLE ranking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value DECIMAL(3,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default ranking weights
INSERT INTO ranking_config (config_key, config_value, description) VALUES
    ('semantic_similarity_weight', 0.60, 'Weight for semantic similarity (cosine similarity from pgvector)'),
    ('interest_overlap_weight', 0.20, 'Weight for interest overlap (Jaccard coefficient over interests bitset)'),
    ('geo_proximity_weight', 0.10, 'Weight for geographical proximity (normalized distance within 10 mi radius)'),
    ('recent_activity_weight', 0.10, 'Weight for recent activity (inverse of minutes since last heartbeat)');

-- Create index for efficient config lookups
CREATE INDEX idx_ranking_config_key ON ranking_config(config_key);

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ranking_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_ranking_config_updated_at
    BEFORE UPDATE ON ranking_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ranking_config_updated_at();

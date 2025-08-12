-- Migration: Create user_availability table
-- Version: 001
-- Description: Creates a separate table to track user availability status

CREATE TABLE user_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    last_available_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Add indexes for efficient querying
CREATE INDEX idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX idx_user_availability_is_available ON user_availability(is_available) WHERE is_available = true;
CREATE INDEX idx_user_availability_last_available_at ON user_availability(last_available_at) WHERE last_available_at IS NOT NULL;
CREATE INDEX idx_user_availability_deleted_at ON user_availability(deleted_at);

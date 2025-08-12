-- Migration: Drop user_availability table
-- Version: 001 (DOWN)
-- Description: Removes the user_availability table and all associated indexes

-- Drop indexes first
DROP INDEX IF EXISTS idx_user_availability_deleted_at;
DROP INDEX IF EXISTS idx_user_availability_last_available_at;
DROP INDEX IF EXISTS idx_user_availability_is_available;
DROP INDEX IF EXISTS idx_user_availability_user_id;

-- Drop table
DROP TABLE IF EXISTS user_availability;

-- SQL Migration: Add has_completed_onboarding tracking column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;

-- =============================================
-- Migration: Add channel_name and channel_id to vidscholar_notes
-- =============================================

ALTER TABLE vidscholar_notes ADD COLUMN IF NOT EXISTS channel_name TEXT;
ALTER TABLE vidscholar_notes ADD COLUMN IF NOT EXISTS channel_id TEXT;

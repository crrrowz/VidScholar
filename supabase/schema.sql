-- =============================================
-- VidScholar Database Schema
-- Run this via npm run db:update
-- =============================================

-- 1. Create Notes Table
CREATE TABLE IF NOT EXISTS vidscholar_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chrome_user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_title TEXT,
    thumbnail TEXT,
    notes JSONB DEFAULT '[]'::jsonb,
    group_name TEXT,
    channel_name TEXT,
    channel_id TEXT,
    last_modified BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chrome_user_id, video_id)
);

-- 2. Create Settings Table (Simple Defaults)
CREATE TABLE IF NOT EXISTS vidscholar_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chrome_user_id TEXT NOT NULL UNIQUE,
    theme TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'en',
    retention_days INTEGER DEFAULT 30,
    video_groups JSONB DEFAULT '[]'::jsonb, -- Filled by App Logic
    presets JSONB DEFAULT '{}'::jsonb,      -- Filled by App Logic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_notes_user ON vidscholar_notes(chrome_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_video ON vidscholar_notes(chrome_user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_notes_last_modified ON vidscholar_notes(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_settings_user ON vidscholar_settings(chrome_user_id);

-- 4. Enable Row Level Security
ALTER TABLE vidscholar_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vidscholar_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow insert for all" ON vidscholar_notes;
DROP POLICY IF EXISTS "Allow select own notes" ON vidscholar_notes;
DROP POLICY IF EXISTS "Allow update own notes" ON vidscholar_notes;
DROP POLICY IF EXISTS "Allow delete own notes" ON vidscholar_notes;
DROP POLICY IF EXISTS "Allow all for settings" ON vidscholar_settings;

CREATE POLICY "Allow insert for all" ON vidscholar_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select own notes" ON vidscholar_notes FOR SELECT USING (true);
CREATE POLICY "Allow update own notes" ON vidscholar_notes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete own notes" ON vidscholar_notes FOR DELETE USING (true);
CREATE POLICY "Allow all for settings" ON vidscholar_settings FOR ALL USING (true) WITH CHECK (true);

-- 6. Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vidscholar_notes_updated_at ON vidscholar_notes;
CREATE TRIGGER update_vidscholar_notes_updated_at
    BEFORE UPDATE ON vidscholar_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vidscholar_settings_updated_at ON vidscholar_settings;
CREATE TRIGGER update_vidscholar_settings_updated_at
    BEFORE UPDATE ON vidscholar_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

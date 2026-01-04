/**
 * Supabase Configuration
 * 
 * Cloud storage backend for VidScholar
 */

export const SUPABASE_CONFIG = {
    url: 'https://mfnowljxgwwqqplpgjgb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mbm93bGp4Z3d3cXFwbHBnamdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mzg3NzAsImV4cCI6MjA4MzExNDc3MH0.MfUW8w-6H2x5imrmATm3qnpLYV38q-BTJFtWXom6hOA',
};

// Rate limiting config
export const RATE_LIMIT = {
    maxRequestsPerHour: 100,
    maxNotesPerUser: 5000,
    maxNoteSizeBytes: 50000, // 50KB per note
};

// Table names
export const TABLES = {
    notes: 'vidscholar_notes',
    settings: 'vidscholar_settings',
};

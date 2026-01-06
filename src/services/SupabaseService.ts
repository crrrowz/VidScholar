/**
 * SupabaseService - Cloud Storage Backend
 * 
 * Handles all Supabase operations for VidScholar.
 * Uses Chrome Profile ID for user identification (no login required).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, TABLES, RATE_LIMIT } from '../config/supabase';
import type { Note, StoredVideoData } from '../types';

interface VideoRecord {
    id?: string;
    chrome_user_id: string;
    video_id: string;
    video_title: string;
    thumbnail?: string;
    notes: Note[];
    group_name?: string;
    channel_name?: string;
    channel_id?: string;
    last_modified: number;
    created_at?: string;
    updated_at?: string;
}

interface SettingsRecord {
    id?: string;
    chrome_user_id: string;
    theme: string;
    language: string;
    retention_days: number;
    video_groups: string[];
    presets: Record<string, any>;
    updated_at?: string;
}

class SupabaseService {
    private static instance: SupabaseService;
    private client: SupabaseClient;
    private chromeUserId: string | null = null;
    private initialized: boolean = false;
    private isOnline: boolean = true;

    private constructor() {
        this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

        // Monitor online status
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.isOnline = true);
            window.addEventListener('offline', () => this.isOnline = false);
            this.isOnline = navigator.onLine;
        }
    }

    static getInstance(): SupabaseService {
        if (!SupabaseService.instance) {
            SupabaseService.instance = new SupabaseService();
        }
        return SupabaseService.instance;
    }

    /**
     * Initialize service and get Chrome User ID
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        try {
            // Get Chrome Profile ID
            this.chromeUserId = await this.getChromeUserId();

            if (!this.chromeUserId) {
                console.warn('SupabaseService: No Chrome User ID available. Using local storage only.');
                return false;
            }

            this.initialized = true;
            console.log('SupabaseService: Initialized with user ID:', this.chromeUserId.substring(0, 8) + '...');
            return true;
        } catch (error) {
            console.error('SupabaseService: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Get Chrome Profile User ID
     */
    private getChromeUserId(): Promise<string | null> {
        // 🛠️ DEVELOPMENT MODE: Check multiple flags just to be sure
        if (import.meta.env.DEV || import.meta.env.MODE === 'development' || process.env['NODE_ENV'] === 'development') {
            const TEST_ID = 'TEST_USER_DEV_123';
            console.log(`SupabaseService: 🔧 DEV MODE detected. Using Test ID: ${TEST_ID}`);
            return Promise.resolve(TEST_ID);
        }

        return new Promise((resolve) => {
            // Attempt to use chrome.identity
            if (typeof chrome !== 'undefined' && chrome.identity) {
                chrome.identity.getProfileUserInfo((userInfo) => {
                    if (!chrome.runtime.lastError && userInfo && userInfo.id) {
                        resolve(userInfo.id);
                        return;
                    }
                    // If identity fails or returns empty, fallback to device ID
                    this.getOrCreateDeviceId().then(resolve);
                });
            } else {
                // If identity API is missing, fallback directly
                this.getOrCreateDeviceId().then(resolve);
            }
        });
    }

    /**
     * Get or create a device ID for users not signed into Chrome
     */
    private async getOrCreateDeviceId(): Promise<string> {
        try {
            // Use chrome.storage.sync to persist device ID across reinstalls
            // This syncs with Chrome account and survives extension removal
            const result = await chrome.storage.sync.get('__device_id__');
            if (result['__device_id__']) {
                return result['__device_id__'];
            }

            // Also check local storage for migration from old version
            const localResult = await chrome.storage.local.get('__device_id__');
            if (localResult['__device_id__']) {
                // Migrate to sync storage
                await chrome.storage.sync.set({ __device_id__: localResult['__device_id__'] });
                return localResult['__device_id__'];
            }

            // Generate new device ID
            const deviceId = 'device_' + crypto.randomUUID();
            await chrome.storage.sync.set({ __device_id__: deviceId });
            return deviceId;
        } catch (error) {
            return 'device_' + Date.now().toString(36);
        }
    }

    /**
     * Check if service is available
     */
    isAvailable(): boolean {
        return this.initialized && this.isOnline && !!this.chromeUserId;
    }

    // ==========================================
    // VIDEO NOTES OPERATIONS
    // ==========================================

    /**
     * Save video notes to Supabase
     */
    async saveVideoNotes(data: {
        videoId: string;
        videoTitle: string;
        notes: Note[];
        group?: string;
        channelName?: string;
        channelId?: string;
    }): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            const record: Partial<VideoRecord> = {
                chrome_user_id: this.chromeUserId!,
                video_id: data.videoId,
                video_title: data.videoTitle,
                thumbnail: `https://i.ytimg.com/vi/${data.videoId}/mqdefault.jpg`,
                notes: data.notes,
                group_name: data.group || undefined,
                channel_name: data.channelName || undefined,
                channel_id: data.channelId || undefined,
                last_modified: Date.now(),
            };

            const { error } = await this.client
                .from(TABLES.notes)
                .upsert(record, {
                    onConflict: 'chrome_user_id,video_id'
                });

            if (error) {
                console.error('Supabase save error:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('SupabaseService.saveVideoNotes failed:', error);
            return false;
        }
    }

    /**
     * Load notes for a specific video
     */
    async loadVideoNotes(videoId: string): Promise<Note[] | null> {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await this.client
                .from(TABLES.notes)
                .select('notes')
                .eq('chrome_user_id', this.chromeUserId!)
                .eq('video_id', videoId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return []; // Not found
                console.error('Supabase load error:', error);
                return null;
            }

            return data?.notes || [];
        } catch (error) {
            console.error('SupabaseService.loadVideoNotes failed:', error);
            return null;
        }
    }

    /**
     * Load all videos for current user
     */
    async loadAllVideos(): Promise<StoredVideoData[] | null> {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await this.client
                .from(TABLES.notes)
                .select('*')
                .eq('chrome_user_id', this.chromeUserId!)
                .order('last_modified', { ascending: false });

            if (error) {
                console.error('Supabase loadAll error:', error);
                return null;
            }

            return (data || []).map(record => ({
                videoId: record.video_id,
                videoTitle: record.video_title,
                thumbnail: record.thumbnail,
                notes: record.notes || [],
                lastModified: record.last_modified,
                group: record.group_name,
                channelName: record.channel_name,
                channelId: record.channel_id,
            }));
        } catch (error) {
            console.error('SupabaseService.loadAllVideos failed:', error);
            return null;
        }
    }

    /**
     * Delete a video's notes
     */
    async deleteVideo(videoId: string): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            const { error } = await this.client
                .from(TABLES.notes)
                .delete()
                .eq('chrome_user_id', this.chromeUserId!)
                .eq('video_id', videoId);

            if (error) {
                console.error('Supabase delete error:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('SupabaseService.deleteVideo failed:', error);
            return false;
        }
    }

    /**
     * Delete all notes for current user
     */
    async deleteAllNotes(): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            const { error } = await this.client
                .from(TABLES.notes)
                .delete()
                .eq('chrome_user_id', this.chromeUserId!);

            if (error) {
                console.error('Supabase deleteAll error:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('SupabaseService.deleteAllNotes failed:', error);
            return false;
        }
    }

    // ==========================================
    // SETTINGS OPERATIONS
    // ==========================================

    /**
     * Save user settings
     */
    async saveSettings(settings: Partial<SettingsRecord>): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            const record = {
                chrome_user_id: this.chromeUserId!,
                ...settings,
                updated_at: new Date().toISOString(),
            };

            const { error } = await this.client
                .from(TABLES.settings)
                .upsert(record, {
                    onConflict: 'chrome_user_id'
                });

            if (error) {
                console.error('Supabase saveSettings error:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('SupabaseService.saveSettings failed:', error);
            return false;
        }
    }

    /**
     * Load user settings
     */
    async loadSettings(): Promise<SettingsRecord | null> {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await this.client
                .from(TABLES.settings)
                .select('*')
                .eq('chrome_user_id', this.chromeUserId!)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                console.error('Supabase loadSettings error:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('SupabaseService.loadSettings failed:', error);
            return null;
        }
    }

    // ==========================================
    // SYNC OPERATIONS
    // ==========================================

    /**
     * Sync local data to cloud
     */
    async syncToCloud(localVideos: StoredVideoData[]): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            for (const video of localVideos) {
                await this.saveVideoNotes({
                    videoId: video.videoId,
                    videoTitle: video.videoTitle,
                    notes: video.notes,
                    group: video.group,
                });
            }
            return true;
        } catch (error) {
            console.error('SupabaseService.syncToCloud failed:', error);
            return false;
        }
    }

    /**
     * Get user stats (for rate limiting check)
     */
    async getUserStats(): Promise<{ noteCount: number; videoCount: number } | null> {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await this.client
                .from(TABLES.notes)
                .select('video_id, notes')
                .eq('chrome_user_id', this.chromeUserId!);

            if (error) return null;

            const videoCount = data?.length || 0;
            const noteCount = data?.reduce((sum, v) => sum + (v.notes?.length || 0), 0) || 0;

            return { noteCount, videoCount };
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if user is within rate limits
     */
    async checkRateLimits(): Promise<{ allowed: boolean; reason?: string }> {
        const stats = await this.getUserStats();

        if (!stats) return { allowed: true };

        if (stats.noteCount >= RATE_LIMIT.maxNotesPerUser) {
            return {
                allowed: false,
                reason: `Maximum notes limit reached (${RATE_LIMIT.maxNotesPerUser})`
            };
        }

        return { allowed: true };
    }
}

export const supabaseService = SupabaseService.getInstance();
export default supabaseService;

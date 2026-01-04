/**
 * StorageAdapter - Hybrid Storage (Supabase + Local)
 * 
 * Priority: Supabase (cloud sync) → Local (fallback)
 * 
 * - If user is online and has Chrome ID: uses Supabase
 * - If offline or no Chrome ID: uses local storage
 * - Syncs local changes to cloud when connection is restored
 */

import { supabaseService } from '../services/SupabaseService';
import type { Note, StoredVideoData } from '../types';

export type StorageArea = 'cloud' | 'local' | 'auto';

export interface StorageOptions {
    area?: StorageArea;
    skipCloud?: boolean;
}

/**
 * Storage quota information
 */
export interface StorageQuota {
    bytesInUse: number;
    quotaBytes: number;
    percentUsed: number;
    area: StorageArea;
}

class StorageAdapter {
    private static instance: StorageAdapter;
    private initialized: boolean = false;
    private useCloud: boolean = false;
    private pendingSync: StoredVideoData[] = [];

    private constructor() { }

    static getInstance(): StorageAdapter {
        if (!StorageAdapter.instance) {
            StorageAdapter.instance = new StorageAdapter();
        }
        return StorageAdapter.instance;
    }

    /**
     * Initialize storage adapter
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        try {
            // Try to initialize Supabase
            this.useCloud = await supabaseService.initialize();

            if (this.useCloud) {
                console.log('StorageAdapter: Using cloud storage (Supabase)');
                // Sync any pending local changes
                await this.syncPendingChanges();
            } else {
                console.log('StorageAdapter: Using local storage only');
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('StorageAdapter initialization failed:', error);
            this.initialized = true; // Still mark as initialized, will use local
            return true;
        }
    }

    /**
     * Sync pending local changes to cloud
     */
    private async syncPendingChanges(): Promise<void> {
        try {
            const pending = await this.getLocal<StoredVideoData[]>('__pending_sync__');
            if (pending && pending.length > 0) {
                console.log(`Syncing ${pending.length} pending videos to cloud...`);
                await supabaseService.syncToCloud(pending);
                await this.removeLocal('__pending_sync__');
            }
        } catch (error) {
            console.error('Failed to sync pending changes:', error);
        }
    }

    // ==========================================
    // VIDEO NOTES
    // ==========================================

    /**
     * Save video notes
     */
    async saveVideoNotes(data: {
        videoId: string;
        videoTitle: string;
        notes: Note[];
        group?: string;
        channelName?: string;
        channelId?: string;
    }): Promise<boolean> {
        await this.ensureInitialized();

        // Always save to local first
        const localData: StoredVideoData = {
            videoId: data.videoId,
            videoTitle: data.videoTitle,
            notes: data.notes,
            lastModified: Date.now(),
            group: data.group,
            channelName: data.channelName,
            channelId: data.channelId,
        };
        await this.setLocal(`notes_${data.videoId}`, localData);

        // Then try to save to cloud
        if (this.useCloud && supabaseService.isAvailable()) {
            const cloudSaved = await supabaseService.saveVideoNotes(data);
            if (!cloudSaved) {
                // Add to pending sync
                await this.addToPendingSync(localData);
            }
            return cloudSaved;
        } else {
            // Add to pending sync for later
            await this.addToPendingSync(localData);
            return true;
        }
    }

    /**
     * Load video notes
     */
    async loadVideoNotes(videoId: string): Promise<Note[]> {
        await this.ensureInitialized();

        // Try cloud first
        if (this.useCloud && supabaseService.isAvailable()) {
            const cloudNotes = await supabaseService.loadVideoNotes(videoId);
            if (cloudNotes !== null) {
                // Update local cache
                const localData = await this.getLocal<StoredVideoData>(`notes_${videoId}`);
                if (!localData || localData.lastModified < Date.now() - 60000) {
                    // Cloud is newer or local doesn't exist
                    return cloudNotes;
                }
                // Merge: prefer local if modified recently
                return localData.notes;
            }
        }

        // Fallback to local
        const local = await this.getLocal<StoredVideoData>(`notes_${videoId}`);
        return local?.notes || [];
    }

    /**
     * Load all videos
     */
    async loadAllVideos(): Promise<StoredVideoData[]> {
        await this.ensureInitialized();

        // Try cloud first
        if (this.useCloud && supabaseService.isAvailable()) {
            const cloudVideos = await supabaseService.loadAllVideos();
            if (cloudVideos !== null) {
                // Merge with local (local overrides for recent changes)
                const localVideos = await this.loadAllLocalVideos();
                return this.mergeVideoLists(cloudVideos, localVideos);
            }
        }

        // Fallback to local
        return this.loadAllLocalVideos();
    }

    /**
     * Delete video notes
     */
    async deleteVideo(videoId: string): Promise<boolean> {
        await this.ensureInitialized();

        // Delete from local
        await this.removeLocal(`notes_${videoId}`);

        // Delete from cloud
        if (this.useCloud && supabaseService.isAvailable()) {
            await supabaseService.deleteVideo(videoId);
        }

        return true;
    }

    /**
     * Delete all notes
     */
    async clearAllNotes(): Promise<boolean> {
        await this.ensureInitialized();

        // Clear local
        const allData = await chrome.storage.local.get(null);
        const noteKeys = Object.keys(allData).filter(k => k.startsWith('notes_'));
        await chrome.storage.local.remove(noteKeys);

        // Clear cloud
        if (this.useCloud && supabaseService.isAvailable()) {
            await supabaseService.deleteAllNotes();
        }

        return true;
    }

    // ==========================================
    // LOCAL STORAGE HELPERS
    // ==========================================

    private async getLocal<T>(key: string): Promise<T | null> {
        try {
            const result = await chrome.storage.local.get(key);
            return (result[key] as T) ?? null;
        } catch (error) {
            console.error(`getLocal failed for "${key}":`, error);
            return null;
        }
    }

    private async setLocal<T>(key: string, value: T): Promise<boolean> {
        try {
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error(`setLocal failed for "${key}":`, error);
            return false;
        }
    }

    private async removeLocal(key: string): Promise<boolean> {
        try {
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error(`removeLocal failed for "${key}":`, error);
            return false;
        }
    }

    private async loadAllLocalVideos(): Promise<StoredVideoData[]> {
        try {
            const allData = await chrome.storage.local.get(null);
            const videos: StoredVideoData[] = [];

            for (const [key, value] of Object.entries(allData)) {
                if (key.startsWith('notes_') && value) {
                    videos.push(value as StoredVideoData);
                }
            }

            return videos.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        } catch (error) {
            console.error('loadAllLocalVideos failed:', error);
            return [];
        }
    }

    private async addToPendingSync(video: StoredVideoData): Promise<void> {
        try {
            const pending = await this.getLocal<StoredVideoData[]>('__pending_sync__') || [];
            const index = pending.findIndex(v => v.videoId === video.videoId);

            if (index >= 0) {
                pending[index] = video;
            } else {
                pending.push(video);
            }

            await this.setLocal('__pending_sync__', pending);
        } catch (error) {
            console.error('addToPendingSync failed:', error);
        }
    }

    private mergeVideoLists(cloud: StoredVideoData[], local: StoredVideoData[]): StoredVideoData[] {
        const merged = new Map<string, StoredVideoData>();

        // Add cloud videos
        for (const video of cloud) {
            merged.set(video.videoId, video);
        }

        // Override with local if newer
        for (const video of local) {
            const existing = merged.get(video.videoId);
            if (!existing || (video.lastModified || 0) > (existing.lastModified || 0)) {
                merged.set(video.videoId, video);
            }
        }

        return Array.from(merged.values())
            .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    }

    // ==========================================
    // GENERIC STORAGE (for settings, presets, etc.)
    // ==========================================

    /**
     * Get a value from storage
     */
    async get<T>(key: string): Promise<T | null> {
        await this.ensureInitialized();
        return this.getLocal<T>(key);
    }

    /**
     * Set a value in storage
     */
    async set<T>(key: string, value: T): Promise<boolean> {
        await this.ensureInitialized();
        return this.setLocal(key, value);
    }

    /**
     * Remove a key from storage
     */
    async remove(key: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.removeLocal(key);
    }

    /**
     * Get all items
     */
    async getAll<T extends Record<string, any>>(): Promise<T> {
        await this.ensureInitialized();
        const result = await chrome.storage.local.get(null);
        return result as T;
    }

    /**
     * Clear all storage
     */
    async clear(): Promise<boolean> {
        await this.ensureInitialized();
        await chrome.storage.local.clear();
        if (this.useCloud) {
            await supabaseService.deleteAllNotes();
        }
        return true;
    }

    /**
     * Get storage quota info
     */
    async getQuota(): Promise<StorageQuota> {
        const bytesInUse = await chrome.storage.local.getBytesInUse(null);
        const quotaBytes = 5 * 1024 * 1024; // 5MB reference

        return {
            bytesInUse,
            quotaBytes,
            percentUsed: (bytesInUse / quotaBytes) * 100,
            area: this.useCloud ? 'cloud' : 'local'
        };
    }

    /**
     * Check if using cloud storage
     */
    isUsingCloud(): boolean {
        return this.useCloud && supabaseService.isAvailable();
    }

    /**
     * Get keys by prefix
     */
    async getKeysByPrefix(prefix: string): Promise<string[]> {
        const all = await this.getAll();
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

    /**
     * Watch for storage changes
     */
    onChanged(
        callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
    ): () => void {
        chrome.storage.onChanged.addListener(callback);
        return () => chrome.storage.onChanged.removeListener(callback);
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Force sync to cloud
     */
    async forceSync(): Promise<boolean> {
        if (!this.useCloud) return false;

        try {
            const localVideos = await this.loadAllLocalVideos();
            await supabaseService.syncToCloud(localVideos);
            return true;
        } catch (error) {
            console.error('forceSync failed:', error);
            return false;
        }
    }

    /**
     * Get storage stats
     */
    async getStats(): Promise<{
        cloudEnabled: boolean;
        localVideoCount: number;
        pendingSyncCount: number;
    }> {
        const localVideos = await this.loadAllLocalVideos();
        const pending = await this.getLocal<StoredVideoData[]>('__pending_sync__') || [];

        return {
            cloudEnabled: this.useCloud,
            localVideoCount: localVideos.length,
            pendingSyncCount: pending.length
        };
    }
}

export const storageAdapter = StorageAdapter.getInstance();
export default storageAdapter;

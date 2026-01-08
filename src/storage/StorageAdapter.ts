/**
 * StorageAdapter - Hybrid Storage (Supabase + Local)
 * 
 * Priority: Supabase (cloud sync) → Local (fallback)
 * 
 * - If user is online and has Chrome ID: uses Supabase
 * - If offline or no Chrome ID: uses local storage
 * - Syncs local changes to cloud when connection is restored
 * 
 * ROBUSTNESS:
 * Includes "executeSafe" wrapper to handle "Extension context invalidated" errors gracefully.
 * Provides emergency backup to window.localStorage if extension context is lost during a write.
 */

import { supabaseService } from '../services/SupabaseService';
import { showToast } from '../utils/toast';
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
     * Check if extension context is valid.
     * Accessing chrome.runtime.id throws or returns undefined if context is invalidated.
     */
    private isContextValid(): boolean {
        try {
            return !!chrome.runtime && !!chrome.runtime.id;
        } catch (e) {
            return false;
        }
    }

    /**
     * Handle critical invalidation state.
     * Shows a user warning and ensures we don't spam the console/UI.
     */
    private handleInvalidation(action?: string) {
        // Prevent repeated notifications for the same session
        if ((window as any).__vidscholar_invalidation_shown) return;
        (window as any).__vidscholar_invalidation_shown = true;

        const msg = `Extension updated/reloaded. Please refresh the page to continue.`;
        console.error(`CRITICAL: Extension context invalidated during ${action || 'operation'}. ${msg}`);

        // Show visible error to user
        showToast(msg, 'error');
    }

    /**
     * Perform emergency backup to window.localStorage (web page storage).
     * This saves data even if the extension mechanism is dead.
     */
    private performEmergencyBackup(key: string, value: any) {
        try {
            const backupKey = `vidscholar_emergency_${key}_${Date.now()}`;
            console.warn(`Performing emergency backup to localStorage: ${backupKey}`);
            window.localStorage.setItem(backupKey, JSON.stringify(value));
            showToast("Extension updated. Your changes were saved to a local backup.", 'warning');
        } catch (e) {
            console.error("Failed emergency backup:", e);
        }
    }

    /**
     * Execute a storage operation safely.
     * Catches "Extension context invalidated" errors and handles fallback/backup.
     */
    private async executeSafe<T>(
        operation: () => Promise<T>,
        fallbackValue: T | null = null,
        context: { isWrite?: boolean, key?: string, value?: any } = {}
    ): Promise<T | null> {
        // 1. Pre-check validity
        if (!this.isContextValid()) {
            this.handleInvalidation(context.isWrite ? 'write' : 'read');
            if (context.isWrite && context.key && context.value) {
                this.performEmergencyBackup(context.key, context.value);
            }
            return fallbackValue;
        }

        try {
            return await operation();
        } catch (error: any) {
            // 2. Catch invalidation during execution
            const isInvalidated = error.message && (
                error.message.includes('Extension context invalidated') ||
                error.message.includes('context') // broader catch for context errors
            );

            if (isInvalidated) {
                this.handleInvalidation(context.isWrite ? 'write' : 'read');
                if (context.isWrite && context.key && context.value) {
                    this.performEmergencyBackup(context.key, context.value);
                }
                return fallbackValue;
            }

            console.error('StorageAdapter operation failed:', error);
            return fallbackValue;
        }
    }

    /**
     * Initialize storage adapter
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        // Skip initialization if context is already dead
        if (!this.isContextValid()) {
            console.warn('StorageAdapter: Context invalid at init. Skipping.');
            return false;
        }

        try {
            // Try to initialize Supabase
            this.useCloud = await supabaseService.initialize();

            if (this.useCloud) {
                // Using cloud storage
                await this.syncPendingChanges();
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
        const localSaved = await this.setLocal(`notes_${data.videoId}`, localData);

        // Then try to save to cloud
        if (this.useCloud && supabaseService.isAvailable()) {
            const cloudSaved = await supabaseService.saveVideoNotes(data);
            if (!cloudSaved && localSaved) {
                // Add to pending sync
                await this.addToPendingSync(localData);
            }
            return cloudSaved;
        } else {
            // Add to pending sync for later, rely on local save success
            if (localSaved) {
                await this.addToPendingSync(localData);
                return true;
            }
            return false;
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
        // Using executeSafe internal logic here since chrome.storage.local.get(null) is a direct call
        const allData = await this.executeSafe(async () => {
            return await chrome.storage.local.get(null);
        }, {}) || {};

        const noteKeys = Object.keys(allData).filter(k => k.startsWith('notes_'));

        // Remove keys individually or in batch via executeSafe via removeLocal loop or batch
        if (noteKeys.length > 0) {
            await this.executeSafe(async () => {
                await chrome.storage.local.remove(noteKeys);
                return true;
            });
        }

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
        return this.executeSafe(async () => {
            const result = await chrome.storage.local.get(key);
            return (result[key] as T) ?? null;
        });
    }

    private async setLocal<T>(key: string, value: T): Promise<boolean> {
        const result = await this.executeSafe(
            async () => {
                await chrome.storage.local.set({ [key]: value });
                return true;
            },
            false,
            { isWrite: true, key, value }
        );
        return result === true;
    }

    private async removeLocal(key: string): Promise<boolean> {
        const result = await this.executeSafe(async () => {
            await chrome.storage.local.remove(key);
            return true;
        }, false);
        return result === true;
    }

    private async loadAllLocalVideos(): Promise<StoredVideoData[]> {
        return this.executeSafe(async () => {
            const allData = await chrome.storage.local.get(null);
            const videos: StoredVideoData[] = [];

            for (const [key, value] of Object.entries(allData)) {
                if (key.startsWith('notes_') && value) {
                    videos.push(value as StoredVideoData);
                }
            }

            return videos.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        }, []) || [];
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
     * Get all items.
     * Note: This reads "null" (all) from storage.local. 
     */
    async getAll<T extends Record<string, any>>(): Promise<T> {
        await this.ensureInitialized();
        return this.executeSafe(async () => {
            const result = await chrome.storage.local.get(null);
            return result as T;
        }, {} as T) as T;
    }

    /**
     * Clear all storage
     */
    async clear(): Promise<boolean> {
        await this.ensureInitialized();
        const result = await this.executeSafe(async () => {
            await chrome.storage.local.clear();
            return true;
        }, false);

        if (this.useCloud) {
            await supabaseService.deleteAllNotes();
        }
        return result === true;
    }

    /**
     * Get storage quota info
     */
    async getQuota(): Promise<StorageQuota> {
        return this.executeSafe(async () => {
            const bytesInUse = await chrome.storage.local.getBytesInUse(null);
            const quotaBytes = 5 * 1024 * 1024; // 5MB reference

            return {
                bytesInUse,
                quotaBytes,
                percentUsed: (bytesInUse / quotaBytes) * 100,
                area: this.useCloud ? 'cloud' : 'local'
            };
        }, { bytesInUse: 0, quotaBytes: 0, percentUsed: 0, area: 'local' })!;
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
        if (!this.isContextValid()) return () => { };

        try {
            chrome.storage.onChanged.addListener(callback);
            return () => {
                if (this.isContextValid()) {
                    chrome.storage.onChanged.removeListener(callback);
                }
            };
        } catch (e) {
            console.error("Failed to add storage listener:", e);
            return () => { };
        }
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

/**
 * NotesRepository - Centralized notes data management
 * 
 * This repository handles all note-related storage operations.
 * It uses the StorageAdapter for actual storage and provides
 * a clean, type-safe API for note management.
 */

import { storageAdapter } from './StorageAdapter';
import { StorageKeys, NOTES_PREFIX, extractVideoId } from './StorageKeys';
import { storageLock } from './StorageLock';
import { generateNoteId } from '../utils/uuid';
import type { Note, Video, StoredVideoData } from '../types';
import { getCurrentVideoId, getVideoTitle, getChannelName, getChannelId } from '../utils/video';

/**
 * Notes Cache for performance
 */
class NotesCache {
    private cache: Map<string, { notes: Note[]; timestamp: number }> = new Map();
    private readonly TTL = 5 * 60 * 1000; // 5 minutes

    get(videoId: string): Note[] | null {
        const cached = this.cache.get(videoId);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.TTL) {
            this.cache.delete(videoId);
            return null;
        }

        return cached.notes;
    }

    set(videoId: string, notes: Note[]): void {
        this.cache.set(videoId, { notes, timestamp: Date.now() });
    }

    delete(videoId: string): void {
        this.cache.delete(videoId);
    }

    clear(): void {
        this.cache.clear();
    }
}

class NotesRepository {
    private static instance: NotesRepository;
    private cache = new NotesCache();
    private initialized = false;

    private constructor() { }

    static getInstance(): NotesRepository {
        if (!NotesRepository.instance) {
            NotesRepository.instance = new NotesRepository();
        }
        return NotesRepository.instance;
    }

    /**
     * Initialize repository
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        const result = await storageAdapter.initialize();
        this.initialized = result;
        return result;
    }

    // ==========================================
    // NOTES CRUD OPERATIONS
    // ==========================================

    /**
     * Save notes for a video (with concurrency lock)
     */
    async saveNotes(
        notes: Note[],
        options?: {
            videoId?: string;
            videoTitle?: string;
            group?: string | null;
            channelName?: string;
            channelId?: string;
        }
    ): Promise<boolean> {
        const videoId = options?.videoId || getCurrentVideoId();
        if (!videoId) {
            throw new Error('Video ID not found');
        }

        // Use storage lock to prevent concurrent write operations
        return storageLock.withLock(`saveNotes:${videoId}`, async () => {
            await this.ensureInitialized();

            const storageKey = StorageKeys.notes(videoId);

            // If notes array is empty, remove the video entry
            if (notes.length === 0) {
                await storageAdapter.remove(storageKey);
                this.cache.delete(videoId);
                return true;
            }

            // Ensure all notes have unique IDs
            const notesWithIds = notes.map(n => this.ensureNoteId(n));

            // Use saveVideoNotes which handles cloud sync logic
            await storageAdapter.saveVideoNotes({
                videoId,
                videoTitle: options?.videoTitle || getVideoTitle() || videoId,
                notes: notesWithIds,
                group: options?.group || undefined,
                channelName: options?.channelName || getChannelName(),
                channelId: options?.channelId || getChannelId()
            });
            this.cache.set(videoId, notesWithIds);

            return true;
        });
    }

    /**
     * Load notes for current video
     */
    async loadNotes(videoId?: string): Promise<Note[]> {
        await this.ensureInitialized();

        const id = videoId || getCurrentVideoId();
        if (!id) {
            throw new Error('Video ID not found');
        }

        // Check cache first
        const cachedNotes = this.cache.get(id);
        if (cachedNotes) {
            return cachedNotes;
        }

        const storageKey = StorageKeys.notes(id);
        const data = await storageAdapter.get<StoredVideoData>(storageKey);
        const notes = data?.notes || [];

        this.cache.set(id, notes);
        return notes;
    }

    /**
     * Load video data (includes notes + metadata)
     */
    async loadVideoData(videoId: string): Promise<StoredVideoData | null> {
        await this.ensureInitialized();

        const storageKey = StorageKeys.notes(videoId);
        return storageAdapter.get<StoredVideoData>(storageKey);
    }

    /**
     * Delete a specific note
     */
    async deleteNote(noteTimestamp: string, videoId?: string): Promise<boolean> {
        await this.ensureInitialized();

        const id = videoId || getCurrentVideoId();
        if (!id) {
            throw new Error('Video ID not found');
        }

        const notes = await this.loadNotes(id);
        const updatedNotes = notes.filter(note => note.timestamp !== noteTimestamp);

        return this.saveNotes(updatedNotes, { videoId: id });
    }

    /**
     * Delete a video and all its notes
     */
    async deleteVideo(videoId: string): Promise<boolean> {
        await this.ensureInitialized();

        const storageKey = StorageKeys.notes(videoId);
        await storageAdapter.remove(storageKey);
        this.cache.delete(videoId);

        // Update video order
        const videoOrder = await this.loadVideoOrder();
        const updatedOrder = videoOrder.filter(id => id !== videoId);
        await this.saveVideoOrder(updatedOrder);

        return true;
    }

    // ==========================================
    // VIDEO MANAGEMENT
    // ==========================================

    /**
     * Load all saved videos with their notes
     */
    async loadAllVideos(options?: {
        retentionDays?: number;
        applyRetention?: boolean;
    }): Promise<Video[]> {
        await this.ensureInitialized();

        const allData = await storageAdapter.getAll();
        const videos: Video[] = [];
        const currentTime = Date.now();
        const retentionDays = options?.retentionDays ?? Infinity;
        const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;

        for (const [key, value] of Object.entries(allData)) {
            if (!key.startsWith(NOTES_PREFIX)) continue;

            const videoId = extractVideoId(key);
            if (!videoId) continue;

            const data = value as StoredVideoData;
            const videoDate = data.lastModified || 0;

            // Apply retention policy
            if (options?.applyRetention && retentionDays !== Infinity) {
                if (currentTime - videoDate > retentionPeriod) {
                    await storageAdapter.remove(key);
                    continue;
                }
            }

            const notes = data.notes || [];
            const firstNoteTimestamp = notes.length > 0
                ? Math.min(...notes.map(n => n.timestampInSeconds))
                : undefined;

            videos.push({
                id: data.videoId,
                title: data.videoTitle || `Video ${data.videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${data.videoId}/mqdefault.jpg`,
                notes,
                lastModified: data.lastModified,
                firstNoteTimestamp,
                group: data.group,
                channelName: data.channelName,
                channelId: data.channelId
            });
        }

        // Sort by video order
        const videoOrder = await this.loadVideoOrder();
        const videoMap = new Map(videos.map(v => [v.id, v]));

        const orderedVideos: Video[] = [];
        videoOrder.forEach(id => {
            if (videoMap.has(id)) {
                orderedVideos.push(videoMap.get(id)!);
                videoMap.delete(id);
            }
        });

        // New videos (not in order) go first, sorted by lastModified
        const newVideos = [...videoMap.values()];
        newVideos.sort((a, b) => b.lastModified - a.lastModified);

        return [...newVideos, ...orderedVideos];
    }

    // ==========================================
    // VIDEO ORDER
    // ==========================================

    /**
     * Save video order
     */
    async saveVideoOrder(videoIds: string[]): Promise<boolean> {
        await this.ensureInitialized();
        return storageAdapter.set(StorageKeys.videoOrder, videoIds);
    }

    /**
     * Load video order
     */
    async loadVideoOrder(): Promise<string[]> {
        await this.ensureInitialized();
        return (await storageAdapter.get<string[]>(StorageKeys.videoOrder)) || [];
    }

    // ==========================================
    // BULK OPERATIONS
    // ==========================================

    /**
     * Overwrite all notes (for import) - HARDENED with concurrency lock
     * Now uses incremental sync and REQUIRED auto-backup to prevent data loss
     */
    async overwriteAllNotes(videos: StoredVideoData[]): Promise<boolean> {
        // 🛡️ SAFETY: Validate incoming data BEFORE acquiring lock
        if (!Array.isArray(videos)) {
            console.error('[NotesRepository] overwriteAllNotes: Invalid input - not an array');
            return false;
        }

        // Use global lock for bulk operations
        return storageLock.withLock('overwriteAllNotes', async () => {
            await this.ensureInitialized();

            // 🛡️ CRITICAL: Create auto-backup - REQUIRED, not optional
            let backupKey: string | null = null;
            try {
                backupKey = await this.createAutoBackup('pre-overwrite');
                console.log(`[NotesRepository] Auto-backup created: ${backupKey}`);
            } catch (backupError) {
                // 🚫 BLOCK: Do not proceed if backup fails
                console.error('[NotesRepository] CRITICAL: Backup failed. Aborting overwrite to prevent data loss.');
                console.error('Backup error:', backupError);
                throw new Error('Backup creation failed. Operation aborted to prevent data loss.');
            }

            // 🛡️ VALIDATE: Verify backup was created and is valid
            const backupValid = await this.validateBackup(backupKey);
            if (!backupValid) {
                console.error('[NotesRepository] CRITICAL: Backup validation failed. Aborting.');
                throw new Error('Backup validation failed. Operation aborted.');
            }

            // 🛡️ SAFETY: Check for suspicious data loss
            const existingVideos = await this.loadAllVideos({ applyRetention: false });
            const existingNotesCount = existingVideos.reduce((sum, v) => sum + v.notes.length, 0);
            const incomingNotesCount = videos.reduce((sum, v) => sum + v.notes.length, 0);

            if (existingNotesCount > 0 && incomingNotesCount < existingNotesCount * 0.5) {
                console.warn(`[NotesRepository] WARNING: Potential data loss detected!`);
                console.warn(`  Existing: ${existingNotesCount} notes, Incoming: ${incomingNotesCount} notes`);
                console.warn(`  This would delete ${existingNotesCount - incomingNotesCount} notes (${((existingNotesCount - incomingNotesCount) / existingNotesCount * 100).toFixed(1)}%)`);
                // Emit telemetry event (if available)
                this.emitTelemetry('data_loss_warning', {
                    existing: existingNotesCount,
                    incoming: incomingNotesCount,
                    reduction: existingNotesCount - incomingNotesCount
                });
            }

            // ✅ INCREMENTAL SYNC: Only delete videos not in incoming set
            const incomingIds = new Set(videos.map(v => v.videoId));
            let errors: Error[] = [];

            // Delete videos that are NOT in the incoming data
            for (const existingVideo of existingVideos) {
                if (!incomingIds.has(existingVideo.id)) {
                    try {
                        await storageAdapter.deleteVideo(existingVideo.id);
                    } catch (deleteError) {
                        console.warn(`[NotesRepository] Failed to delete video ${existingVideo.id}:`, deleteError);
                        errors.push(deleteError instanceof Error ? deleteError : new Error(String(deleteError)));
                    }
                }
            }

            // ✅ UPSERT: Save or update incoming videos
            for (const video of videos) {
                try {
                    // Ensure all notes have IDs
                    const notesWithIds = video.notes.map(note => this.ensureNoteId(note));

                    await storageAdapter.saveVideoNotes({
                        videoId: video.videoId,
                        videoTitle: video.videoTitle,
                        notes: notesWithIds,
                        group: video.group,
                        channelName: video.channelName,
                        channelId: video.channelId
                    });
                } catch (saveError) {
                    console.error(`[NotesRepository] Failed to save video ${video.videoId}:`, saveError);
                    errors.push(saveError instanceof Error ? saveError : new Error(String(saveError)));
                }
            }

            // If there were errors, attempt rollback
            if (errors.length > 0) {
                console.error(`[NotesRepository] ${errors.length} errors during overwrite. Attempting rollback...`);
                try {
                    await this.restoreFromBackup(backupKey);
                    console.log('[NotesRepository] Rollback successful.');
                    throw new Error(`Overwrite failed with ${errors.length} errors. Rolled back to backup.`);
                } catch (rollbackError) {
                    console.error('[NotesRepository] CRITICAL: Rollback failed:', rollbackError);
                    throw new Error(`Overwrite failed and rollback failed. Manual recovery needed from backup: ${backupKey}`);
                }
            }

            this.cache.clear();
            console.log(`[NotesRepository] Overwrite complete. Processed ${videos.length} videos.`);
            return true;
        });
    }

    /**
     * Create an auto-backup before destructive operations
     * Returns the backup key for later reference
     */
    private async createAutoBackup(reason: string): Promise<string> {
        const allVideos = await this.loadAllVideos({ applyRetention: false });

        // Return empty key if nothing to backup
        if (allVideos.length === 0) {
            return `__empty_backup_${Date.now()}`;
        }

        const backupKey = `__auto_backup_${reason}_${Date.now()}`;
        const backupData: StoredVideoData[] = allVideos.map(v => ({
            videoId: v.id,
            videoTitle: v.title,
            notes: v.notes,
            lastModified: v.lastModified,
            group: v.group,
            channelName: v.channelName,
            channelId: v.channelId
        }));

        const checksum = this.calculateChecksum(backupData);

        await storageAdapter.set(backupKey, {
            timestamp: Date.now(),
            reason,
            videosCount: backupData.length,
            notesCount: backupData.reduce((sum, v) => sum + v.notes.length, 0),
            checksum,
            data: backupData
        });

        // Clean up old auto-backups (keep only last 5)
        const allData = await storageAdapter.getAll();
        const autoBackupKeys = Object.keys(allData)
            .filter(k => k.startsWith('__auto_backup_'))
            .sort()
            .reverse();

        if (autoBackupKeys.length > 5) {
            for (const oldKey of autoBackupKeys.slice(5)) {
                await storageAdapter.remove(oldKey);
            }
        }

        return backupKey;
    }

    /**
     * Validate backup integrity
     */
    private async validateBackup(backupKey: string): Promise<boolean> {
        try {
            if (backupKey.startsWith('__empty_backup_')) {
                return true; // Empty backups are valid
            }

            const backup = await storageAdapter.get<{
                timestamp: number;
                videosCount: number;
                notesCount: number;
                checksum: string;
                data: StoredVideoData[];
            }>(backupKey);

            if (!backup) {
                console.error(`[NotesRepository] Backup not found: ${backupKey}`);
                return false;
            }

            // Verify structure
            if (!backup.data || !Array.isArray(backup.data)) {
                console.error(`[NotesRepository] Backup data invalid: ${backupKey}`);
                return false;
            }

            // Verify counts match
            if (backup.data.length !== backup.videosCount) {
                console.error(`[NotesRepository] Backup video count mismatch: ${backup.data.length} vs ${backup.videosCount}`);
                return false;
            }

            const actualNotesCount = backup.data.reduce((sum, v) => sum + v.notes.length, 0);
            if (actualNotesCount !== backup.notesCount) {
                console.error(`[NotesRepository] Backup notes count mismatch: ${actualNotesCount} vs ${backup.notesCount}`);
                return false;
            }

            // Verify checksum
            const calculatedChecksum = this.calculateChecksum(backup.data);
            if (calculatedChecksum !== backup.checksum) {
                console.error(`[NotesRepository] Backup checksum mismatch`);
                return false;
            }

            console.log(`[NotesRepository] Backup validated: ${backupKey} (${backup.videosCount} videos, ${backup.notesCount} notes)`);
            return true;
        } catch (error) {
            console.error(`[NotesRepository] Backup validation error:`, error);
            return false;
        }
    }

    /**
     * Restore from backup
     */
    private async restoreFromBackup(backupKey: string): Promise<void> {
        if (backupKey.startsWith('__empty_backup_')) {
            console.log('[NotesRepository] Empty backup - nothing to restore');
            return;
        }

        const backup = await storageAdapter.get<{
            data: StoredVideoData[];
        }>(backupKey);

        if (!backup || !backup.data) {
            throw new Error(`Backup not found or invalid: ${backupKey}`);
        }

        console.log(`[NotesRepository] Restoring from backup: ${backupKey} (${backup.data.length} videos)`);

        // Clear current data
        await this.clearAllNotes();

        // Restore videos
        for (const video of backup.data) {
            await storageAdapter.saveVideoNotes({
                videoId: video.videoId,
                videoTitle: video.videoTitle,
                notes: video.notes,
                group: video.group,
                channelName: video.channelName,
                channelId: video.channelId
            });
        }

        this.cache.clear();
        console.log(`[NotesRepository] Restore complete: ${backup.data.length} videos restored`);
    }

    /**
     * Calculate checksum for data integrity
     */
    private calculateChecksum(data: StoredVideoData[]): string {
        // Simple checksum: concatenate videoIds and note counts
        const signature = data.map(v => `${v.videoId}:${v.notes.length}`).join('|');
        // Simple hash
        let hash = 0;
        for (let i = 0; i < signature.length; i++) {
            const char = signature.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `ck_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Emit telemetry event (non-blocking)
     */
    private emitTelemetry(event: string, data: Record<string, any>): void {
        try {
            // Log to console for now
            console.log(`[Telemetry] ${event}:`, JSON.stringify(data));

            // Future: Send to analytics service
            // analyticsService.track(event, data);
        } catch (error) {
            // Telemetry should never block or throw
            console.warn('[Telemetry] Failed to emit:', error);
        }
    }

    /**
     * Clear all notes
     */
    async clearAllNotes(): Promise<boolean> {
        await this.ensureInitialized();

        const allKeys = await storageAdapter.getKeysByPrefix(NOTES_PREFIX);
        for (const key of allKeys) {
            const videoId = extractVideoId(key);
            if (videoId) {
                // This handles both local and cloud deletion
                await storageAdapter.deleteVideo(videoId);
            } else {
                // Just remove the local key if can't parse ID
                await storageAdapter.remove(key);
            }
        }
        this.cache.clear();

        return true;
    }

    /**
     * Generate a unique key for a note
     * Uses note.id if available, otherwise creates a composite key
     */
    private getNoteKey(note: Note): string {
        if (note.id) {
            return note.id;
        }
        // Fallback to composite key for notes without id
        // Use timestamp + first 50 chars of text to create unique key
        const textHash = note.text.substring(0, 50).replace(/\s+/g, '_');
        return `${note.timestampInSeconds}:${textHash}`;
    }

    /**
     * Ensure note has a unique ID (UUID v4 for global uniqueness)
     */
    private ensureNoteId(note: Note): Note {
        if (!note.id) {
            return {
                ...note,
                id: generateNoteId() // UUID v4 for cross-device uniqueness
            };
        }
        return note;
    }

    /**
     * Merge notes into existing - FIXED to properly handle unique notes
     * Uses note.id as primary key, falls back to composite key
     * Prioritizes existing notes when timestamps match but content differs
     */
    mergeNotes(existingNotes: Note[], importedNotes: Note[]): Note[] {
        // Map by unique key, preserving existing notes
        const mergedMap = new Map<string, Note>();

        // Track timestamps to detect potential conflicts
        const timestampMap = new Map<number, Note>();

        // Add existing notes first (they take priority for conflict resolution)
        for (const note of existingNotes) {
            const noteWithId = this.ensureNoteId(note);
            const key = this.getNoteKey(noteWithId);
            mergedMap.set(key, noteWithId);
            timestampMap.set(noteWithId.timestampInSeconds, noteWithId);
        }

        // Add imported notes, but don't overwrite existing notes with same ID
        for (const note of importedNotes) {
            const noteWithId = this.ensureNoteId(note);
            const key = this.getNoteKey(noteWithId);

            // Only add if this exact note doesn't already exist
            if (!mergedMap.has(key)) {
                // Check if there's already a note at this timestamp with different content
                const existingAtTimestamp = timestampMap.get(noteWithId.timestampInSeconds);

                if (existingAtTimestamp && existingAtTimestamp.text !== noteWithId.text) {
                    // Both notes are different - keep BOTH by slightly adjusting the imported timestamp
                    console.log(`[NotesRepository] Conflict detected at ${note.timestamp}. Keeping both notes.`);
                    // Generate a new unique key for the imported note
                    const newKey = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    mergedMap.set(newKey, noteWithId);
                } else if (!existingAtTimestamp) {
                    // No conflict, add the imported note
                    mergedMap.set(key, noteWithId);
                    timestampMap.set(noteWithId.timestampInSeconds, noteWithId);
                }
                // If existingAtTimestamp exists with same text, skip (duplicate)
            }
        }

        return Array.from(mergedMap.values())
            .sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    /**
     * Get notes count for all videos
     */
    async getTotalNotesCount(): Promise<number> {
        const videos = await this.loadAllVideos();
        return videos.reduce((total, video) => total + video.notes.length, 0);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Ensure initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

export const notesRepository = NotesRepository.getInstance();
export default notesRepository;

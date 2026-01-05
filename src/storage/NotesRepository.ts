/**
 * NotesRepository - Centralized notes data management
 * 
 * This repository handles all note-related storage operations.
 * It uses the StorageAdapter for actual storage and provides
 * a clean, type-safe API for note management.
 */

import { storageAdapter } from './StorageAdapter';
import { StorageKeys, NOTES_PREFIX, extractVideoId } from './StorageKeys';
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
     * Save notes for a video
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
        await this.ensureInitialized();

        const videoId = options?.videoId || getCurrentVideoId();
        if (!videoId) {
            throw new Error('Video ID not found');
        }

        const storageKey = StorageKeys.notes(videoId);

        // If notes array is empty, remove the video entry
        if (notes.length === 0) {
            await storageAdapter.remove(storageKey);
            this.cache.delete(videoId);
            return true;
        }



        // Use saveVideoNotes which handles cloud sync logic
        await storageAdapter.saveVideoNotes({
            videoId,
            videoTitle: options?.videoTitle || getVideoTitle() || videoId,
            notes,
            group: options?.group || undefined,
            channelName: options?.channelName || getChannelName(),
            channelId: options?.channelId || getChannelId()
        });
        this.cache.set(videoId, notes);

        return true;
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
     * Overwrite all notes (for import)
     */
    async overwriteAllNotes(videos: StoredVideoData[]): Promise<boolean> {
        await this.ensureInitialized();

        // Clear existing notes
        await this.clearAllNotes();

        // Save new notes
        // Save new notes individually to ensure proper sync via saveVideoNotes
        for (const video of videos) {
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

        return true;
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
     * Merge notes into existing
     */
    mergeNotes(existingNotes: Note[], importedNotes: Note[]): Note[] {
        const mergedMap = new Map<number, Note>();

        existingNotes.forEach(note => mergedMap.set(note.timestampInSeconds, note));
        importedNotes.forEach(note => mergedMap.set(note.timestampInSeconds, note));

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

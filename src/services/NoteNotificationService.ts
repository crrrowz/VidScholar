// src/services/NoteNotificationService.ts
/**
 * NoteNotificationService - Note Playback Notifications
 * 
 * Simplified Version: Trigger the existing InlineNoteForm when playback reaches a note.
 * Uses Web Audio API for sound and supports auto-closing.
 */

import { getVideoPlayer } from '../utils/video';
import { settingsService } from './SettingsService';
import type { Note } from '../types';

class NoteNotificationService {
    private static instance: NoteNotificationService;

    private watchInterval: ReturnType<typeof setInterval> | null = null;
    private notifiedTimestamps: Set<number> = new Set();
    private currentVideoId: string | null = null;
    private currentNotes: Note[] = [];

    // Configuration
    private readonly CHECK_INTERVAL_MS = 250;
    private readonly TIMESTAMP_TOLERANCE = 1.0;

    private constructor() { }

    static getInstance(): NoteNotificationService {
        if (!NoteNotificationService.instance) {
            NoteNotificationService.instance = new NoteNotificationService();
        }
        return NoteNotificationService.instance;
    }

    /**
     * Start watching video playback for note timestamps
     */
    startWatching(videoId: string, notes: Note[]): void {
        this.stopWatching();
        this.notifiedTimestamps.clear();
        this.currentVideoId = videoId;
        this.currentNotes = notes;

        const video = getVideoPlayer();
        if (!video) return;

        // Check if notifications are enabled
        const notificationsEnabled = settingsService.get('noteNotifications') ?? true;
        if (!notificationsEnabled) return;

        console.log(`[NoteNotificationService] Started watching ${notes.length} notes`);

        this.watchInterval = setInterval(() => {
            this.checkCurrentTime();
        }, this.CHECK_INTERVAL_MS);

        // Also listen for seeking to reset notifications
        video.addEventListener('seeking', this.handleSeeking);
    }

    /**
     * Stop watching video playback
     */
    stopWatching(): void {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }

        const video = getVideoPlayer();
        if (video) {
            video.removeEventListener('seeking', this.handleSeeking);
        }
    }

    /**
     * Update notes list without stopping watch
     */
    updateNotes(notes: Note[]): void {
        this.currentNotes = notes;
    }

    /**
     * Handle seeking event - reset notifications for timestamps after seek position
     */
    private handleSeeking = (): void => {
        const video = getVideoPlayer();
        if (!video) return;

        const currentTime = video.currentTime;
        this.resetForTimestamp(currentTime);
    }

    /**
     * Check current playback time and show notifications
     */
    private checkCurrentTime(): void {
        const video = getVideoPlayer();
        if (!video) return;

        const currentTime = video.currentTime;

        for (const note of this.currentNotes) {
            if (this.notifiedTimestamps.has(note.timestampInSeconds)) continue;

            const diff = Math.abs(currentTime - note.timestampInSeconds);
            if (diff <= this.TIMESTAMP_TOLERANCE) {
                console.log(`[NoteNotification] Triggering InlineForm for note at ${note.timestampInSeconds}s`);

                this.triggerNoteDisplay(note);
                this.playSound();

                this.notifiedTimestamps.add(note.timestampInSeconds);
                break; // Only show one at a time
            }
        }
    }

    /**
     * Trigger the inline note form display (simulating button press)
     */
    private triggerNoteDisplay(note: Note): void {
        const floatingBtn = document.getElementById('floating-add-note-button');

        console.log('[NoteNotification] Trigger requested for:', note.text?.substring(0, 20));

        if (floatingBtn) {
            console.log('[NoteNotification] Floating button found, triggering form...');
            import('../components/video/InlineNoteForm').then(({ showInlineNoteForm }) => {
                showInlineNoteForm(
                    floatingBtn as HTMLElement,
                    note.timestampInSeconds,
                    () => { console.log('[NoteNotification] Form closed'); },
                    note.text,
                    undefined, // No ID (view/edit mode implication)
                    5000       // Auto-close duration: 5 seconds
                ).then(() => {
                    console.log('[NoteNotification] Form shown with auto-close');
                }).catch(err => {
                    console.error('[NoteNotification] Error showing form:', err);
                });
            }).catch(err => {
                console.error('[NoteNotification] Error importing InlineNoteForm:', err);
            });
        } else {
            console.error('[NoteNotification] FATAL: Floating button (#floating-add-note-button) not found in DOM!');
        }
    }

    /**
     * Play notification sound using Web Audio API (No file dependency)
     */
    private playSound(): void {
        const soundEnabled = settingsService.get('noteNotificationSound') ?? true;
        if (!soundEnabled) return;

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Nice "Ping" sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6

            gain.gain.setValueAtTime(0.05, ctx.currentTime); // Low volume
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (error) {
            console.error('[NoteNotification] Audio error:', error);
        }
    }

    /**
     * Reset notifications for timestamps after given time
     */
    resetForTimestamp(timestamp: number): void {
        const toRemove: number[] = [];
        this.notifiedTimestamps.forEach(t => {
            if (t >= timestamp) {
                toRemove.push(t);
            }
        });
        toRemove.forEach(t => this.notifiedTimestamps.delete(t));
    }

    /**
     * Check if notifications are currently active
     */
    isActive(): boolean {
        return this.watchInterval !== null;
    }

    /**
     * Subscribe stub for compatibility
     */
    subscribe(listener: any): () => void {
        return () => { };
    }
}

export const noteNotificationService = NoteNotificationService.getInstance();
export default noteNotificationService;

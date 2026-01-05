/**
 * ExportService - Centralized data export functionality
 * 
 * This service handles all data export operations including:
 * - Single video notes export
 * - All notes export
 * - Backup export with encryption
 * - Various format support (JSON, Markdown, Plain Text)
 */

import { notesRepository } from '../storage/NotesRepository';
import { settingsService } from '../services/SettingsService';
import { showToast } from '../utils/toast';
import { languageService } from '../services/LanguageService';
import { encryptionService } from '../services/EncryptionService';
import { getCurrentVideoId, getVideoTitle, generateVideoUrl, getChannelName, getChannelId } from '../utils/video';
import { getStore } from '../state/Store';
import config from '../utils/config';
import type { Note, StoredVideoData, VideoNotesExport, AllNotesExport } from '../types';

/**
 * Export formats
 */
export type ExportFormat = 'json' | 'markdown' | 'text';

/**
 * Export options
 */
export interface ExportOptions {
    format?: ExportFormat;
    includeMetadata?: boolean;
    encrypt?: boolean;
    password?: string;
}

/**
 * Full backup data structure
 */
export interface FullBackup {
    version: string;
    timestamp: number;
    encrypted: boolean;
    data: {
        videos: StoredVideoData[];
        settings: any;
        templates: Record<number, { name: string; templates: string[] }>;
    };
}

class ExportService {
    private static instance: ExportService;
    private readonly VERSION = '2.0.0';

    private constructor() { }

    static getInstance(): ExportService {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }

    // ==========================================
    // SINGLE VIDEO EXPORT
    // ==========================================

    /**
     * Export notes for current video
     */
    async exportCurrentVideoNotes(options?: ExportOptions): Promise<void> {
        const videoId = getCurrentVideoId();
        if (!videoId) {
            showToast(languageService.translate('exportErrorNoVideoId'), 'error');
            return;
        }

        const notes = await notesRepository.loadNotes(videoId);
        const videoData = await notesRepository.loadVideoData(videoId);

        const videoTitle = getVideoTitle() || videoData?.videoTitle || '';
        const group = getStore().getState().currentVideoGroup || videoData?.group;
        const channelName = getChannelName() || videoData?.channelName;
        const channelId = getChannelId() || videoData?.channelId;

        const format = options?.format ?? 'json';

        switch (format) {
            case 'json':
                await this.exportVideoAsJson(videoId, videoTitle, notes, group, channelName, channelId);
                break;
            case 'markdown':
                await this.exportVideoAsMarkdown(videoId, videoTitle, notes);
                break;
            case 'text':
                await this.exportVideoAsText(videoId, videoTitle, notes);
                break;
        }
    }

    /**
     * Export video notes as JSON
     */
    private async exportVideoAsJson(
        videoId: string,
        videoTitle: string,
        notes: Note[],
        group?: string | null,
        channelName?: string | null,
        channelId?: string | null
    ): Promise<void> {
        // Force keys to be present for debugging visibility
        const data: VideoNotesExport = {
            type: 'video_notes',
            videoId,
            videoTitle,
            notes,
            group: group || '', // Force empty string if undefined so key appears
            channelName: channelName || '',
            channelId: channelId || ''
        };

        const filename = this.sanitizeFilename(`${videoTitle}_notes.json`);
        await this.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    /**
     * Export video notes as Markdown
     */
    private async exportVideoAsMarkdown(
        videoId: string,
        videoTitle: string,
        notes: Note[]
    ): Promise<void> {
        const sortedNotes = [...notes].sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);

        let markdown = `# ${videoTitle}\n\n`;
        markdown += `**Video URL:** https://www.youtube.com/watch?v=${videoId}\n\n`;
        markdown += `**Notes Count:** ${notes.length}\n\n`;
        markdown += `---\n\n`;

        for (const note of sortedNotes) {
            const url = await generateVideoUrl(note.timestamp);
            markdown += `## [${note.timestamp}](${url})\n\n`;
            markdown += `${note.text}\n\n`;
            markdown += `---\n\n`;
        }

        const filename = this.sanitizeFilename(`${videoTitle}_notes.md`);
        await this.downloadFile(markdown, filename, 'text/markdown');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    /**
     * Export video notes as plain text
     */
    private async exportVideoAsText(
        videoId: string,
        videoTitle: string,
        notes: Note[]
    ): Promise<void> {
        const sortedNotes = [...notes].sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);

        let text = `${videoTitle}\n`;
        text += `${'='.repeat(videoTitle.length)}\n\n`;
        text += `Video URL: https://www.youtube.com/watch?v=${videoId}\n`;
        text += `Notes Count: ${notes.length}\n\n`;

        for (const note of sortedNotes) {
            text += `[${note.timestamp}]\n`;
            text += `${note.text}\n\n`;
        }

        const filename = this.sanitizeFilename(`${videoTitle}_notes.txt`);
        await this.downloadFile(text, filename, 'text/plain');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    // ==========================================
    // ALL NOTES EXPORT
    // ==========================================

    /**
     * Export all notes from all videos
     */
    async exportAllNotes(options?: ExportOptions): Promise<void> {
        try {
            const videos = await notesRepository.loadAllVideos();
            console.log('VidScholar Export Debug - Loaded Videos:', videos);

            const notesByVideo: StoredVideoData[] = videos.map(video => ({
                videoId: video.id,
                videoTitle: video.title,
                notes: video.notes,
                lastModified: video.lastModified,
                group: video.group || '',
                channelName: video.channelName || '',
                channelId: video.channelId || ''
            }));

            const format = options?.format ?? 'json';

            switch (format) {
                case 'json':
                    await this.exportAllAsJson(notesByVideo);
                    break;
                case 'markdown':
                    await this.exportAllAsMarkdown(videos);
                    break;
                case 'text':
                    await this.exportAllAsText(videos);
                    break;
            }
        } catch (error) {
            console.error('Export all notes failed:', error);
            showToast(languageService.translate('failedToExportNotes'), 'error');
        }
    }

    /**
     * Export all notes as JSON
     */
    private async exportAllAsJson(notesByVideo: StoredVideoData[]): Promise<void> {
        console.log('DEBUG: exportAllAsJson received:', notesByVideo); // Log raw input

        const data: AllNotesExport = {
            type: 'all_notes',
            notesByVideo
        };

        console.log('DEBUG: Final JSON Object to be stringified:', data); // Log final object

        const filename = `vidscholar_all_notes_${this.getDateString()}.json`;
        await this.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    /**
     * Export all notes as Markdown
     */
    private async exportAllAsMarkdown(videos: any[]): Promise<void> {
        let markdown = `# VidScholar Notes Export\n\n`;
        markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`;
        markdown += `**Total Videos:** ${videos.length}\n`;
        markdown += `**Total Notes:** ${videos.reduce((sum, v) => sum + v.notes.length, 0)}\n\n`;
        markdown += `---\n\n`;

        for (const video of videos) {
            markdown += `# ${video.title}\n\n`;
            markdown += `**Video URL:** https://www.youtube.com/watch?v=${video.id}\n`;
            if (video.group) {
                markdown += `**Group:** ${video.group}\n`;
            }
            if (video.channelName) {
                markdown += `**Channel:** ${video.channelName}\n`;
            }
            markdown += `**Notes:** ${video.notes.length}\n\n`;

            for (const note of video.notes) {
                const url = await generateVideoUrl(note.timestamp);
                markdown += `### [${note.timestamp}](${url})\n\n`;
                markdown += `${note.text}\n\n`;
            }

            markdown += `---\n\n`;
        }

        const filename = `vidscholar_all_notes_${this.getDateString()}.md`;
        await this.downloadFile(markdown, filename, 'text/markdown');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    /**
     * Export all notes as plain text
     */
    private async exportAllAsText(videos: any[]): Promise<void> {
        let text = `VidScholar Notes Export\n`;
        text += `========================\n\n`;
        text += `Export Date: ${new Date().toLocaleDateString()}\n`;
        text += `Total Videos: ${videos.length}\n`;
        text += `Total Notes: ${videos.reduce((sum, v) => sum + v.notes.length, 0)}\n\n`;

        for (const video of videos) {
            text += `${'='.repeat(50)}\n`;
            text += `${video.title}\n`;
            text += `${'='.repeat(50)}\n\n`;
            text += `Video: https://www.youtube.com/watch?v=${video.id}\n`;
            if (video.group) {
                text += `Group: ${video.group}\n`;
            }
            if (video.channelName) {
                text += `Channel: ${video.channelName}\n`;
            }
            text += `Notes: ${video.notes.length}\n\n`;

            for (const note of video.notes) {
                text += `[${note.timestamp}]\n`;
                text += `${note.text}\n\n`;
            }
        }

        const filename = `vidscholar_all_notes_${this.getDateString()}.txt`;
        await this.downloadFile(text, filename, 'text/plain');
        showToast(languageService.translate('notesExportedSuccess'), 'success');
    }

    // ==========================================
    // FULL BACKUP EXPORT
    // ==========================================

    /**
     * Create and export full backup
     */
    async exportFullBackup(options?: { password?: string }): Promise<void> {
        try {
            // Collect all data
            const videos = await notesRepository.loadAllVideos();
            const currentSettings = settingsService.getSettings();

            // Map settings to export format (legacy support mostly)
            const settings = {
                theme: currentSettings.theme,
                language: currentSettings.locale,
                retentionDays: currentSettings.retentionDays,
                videoGroups: currentSettings.videoGroups,
                // ... other settings mapping if needed
            };

            const templates = currentSettings.presets || {};

            const backup: FullBackup = {
                version: this.VERSION,
                timestamp: Date.now(),
                encrypted: !!options?.password,
                data: {
                    videos: videos.map(v => ({
                        videoId: v.id,
                        videoTitle: v.title,
                        notes: v.notes,
                        lastModified: v.lastModified,
                        group: v.group,
                        channelName: v.channelName,
                        channelId: v.channelId
                    })),
                    settings,
                    templates
                }
            };

            let content = JSON.stringify(backup, null, 2);

            // Encrypt if password provided
            if (options?.password) {
                content = await encryptionService.encrypt(content, options.password);
            }

            const filename = `vidscholar_backup_${this.getDateString()}.${options?.password ? 'vsbak' : 'json'}`;
            await this.downloadFile(content, filename, 'application/json');
            showToast(languageService.translate('backupCreatedSuccess'), 'success');
        } catch (error) {
            console.error('Backup export failed:', error);
            showToast(languageService.translate('backupCreatedError'), 'error');
        }
    }

    // ==========================================
    // COPY TO CLIPBOARD
    // ==========================================

    /**
     * Copy single note to clipboard
     */
    async copyNoteToClipboard(note: Note): Promise<boolean> {
        try {
            const videoUrl = await generateVideoUrl(note.timestamp);
            const hashtag = config.getHashtag();
            const text = `${note.text}\n\n${videoUrl}\n${hashtag}`;

            await navigator.clipboard.writeText(text);
            showToast(languageService.translate('copiedLinkToClipboard'), 'success');
            return true;
        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            showToast(languageService.translate('failedToCopyLink'), 'error');
            return false;
        }
    }

    /**
     * Copy all notes to clipboard
     */
    async copyAllNotesToClipboard(notes: Note[]): Promise<boolean> {
        try {
            const sortedNotes = [...notes].sort((a, b) =>
                a.timestamp.localeCompare(b.timestamp)
            );

            const texts = await Promise.all(
                sortedNotes.map(async note => {
                    const url = await generateVideoUrl(note.timestamp);
                    const hashtag = config.getHashtag();
                    return `${note.text}\n\n${url}\n${hashtag}`;
                })
            );

            await navigator.clipboard.writeText(texts.join('\n\n---\n\n'));
            showToast(languageService.translate('allNotesCopiedToClipboard'), 'success');
            return true;
        } catch (error) {
            console.error('Copy all notes failed:', error);
            showToast(languageService.translate('failedToCopyNotesToClipboard'), 'error');
            return false;
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    /**
     * Download file
     */
    private async downloadFile(content: string, filename: string, mimeType: string): Promise<void> {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Sanitize filename
     */
    private sanitizeFilename(filename: string): string {
        return filename.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 100);
    }

    /**
     * Get date string for filenames
     */
    private getDateString(): string {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

export const exportService = ExportService.getInstance();
export default exportService;

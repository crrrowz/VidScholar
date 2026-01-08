/**
 * ImportService - Centralized data import functionality
 * 
 * This service handles all data import operations including:
 * - Single video notes import
 * - All notes import
 * - Backup restore with decryption
 * - Validation and conflict resolution
 */

import { notesRepository } from '../storage/NotesRepository';
import { settingsService } from '../services/SettingsService';
import { showToast } from '../utils/toast';
import { languageService } from '../services/LanguageService';
import { encryptionService } from '../services/EncryptionService';
import { getCurrentVideoId, getVideoTitle } from '../utils/video';
import { actions } from '../state/actions';
import { showConfirmDialog } from '../components/modals/ConfirmDialog';
import { showImportDecisionManager, ImportDecision } from '../components/modals/ImportDecisionManager';
import type { StoredVideoData, VideoNotesExport, AllNotesExport, Video } from '../types';
import type { FullBackup } from './ExportService';

/**
 * Import result
 */
export interface ImportResult {
    success: boolean;
    message: string;
    videosImported?: number;
    notesImported?: number;
}

/**
 * Import options
 */
export interface ImportOptions {
    isGlobalUI?: boolean;
    onUpdate?: (videos: StoredVideoData[]) => void;
}

class ImportService {
    private static instance: ImportService;

    private constructor() { }

    static getInstance(): ImportService {
        if (!ImportService.instance) {
            ImportService.instance = new ImportService();
        }
        return ImportService.instance;
    }

    // ==========================================
    // FILE PICKER
    // ==========================================

    /**
     * Open file picker and import
     */
    async importFromFile(options?: ImportOptions): Promise<void> {
        const file = await this.pickFile('.json,.vsbak');
        if (!file) return;

        try {
            const content = await this.readFile(file);
            await this.processImport(content, options);
        } catch (error: any) {
            console.error('Import failed:', error);
            showToast(languageService.translate('notesImportError', [error.message]), 'error');
        }
    }

    /**
     * Pick a file using file input
     */
    private pickFile(accept: string): Promise<File | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.style.display = 'none';

            input.addEventListener('change', (e) => {
                const file = (e.target as HTMLInputElement).files?.[0] || null;
                input.remove();
                resolve(file);
            });

            input.addEventListener('cancel', () => {
                input.remove();
                resolve(null);
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    /**
     * Read file content
     */
    private readFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // ==========================================
    // PROCESS IMPORT
    // ==========================================

    /**
     * Process imported content
     */
    private async processImport(content: string, options?: ImportOptions): Promise<void> {
        let data: VideoNotesExport | AllNotesExport | FullBackup;

        try {
            // Try to parse as JSON first
            data = JSON.parse(content);
        } catch {
            // If parsing fails, might be encrypted
            const password = await this.promptPassword();
            if (!password) {
                showToast(languageService.translate('importCancelled'), 'info');
                return;
            }

            try {
                const decrypted = await encryptionService.decrypt(content, password);
                data = JSON.parse(decrypted);
            } catch {
                showToast(languageService.translate('decryptionFailed'), 'error');
                return;
            }
        }

        // Determine import type and process
        if (this.isFullBackup(data)) {
            await this.importFullBackup(data);
        } else if (this.isVideoNotesExport(data)) {
            await this.importVideoNotes(data, options);
        } else if (this.isAllNotesExport(data)) {
            await this.importAllNotes(data, options);
        } else {
            showToast(languageService.translate('unknownJsonType'), 'error');
        }
    }

    // ==========================================
    // IMPORT VIDEO NOTES
    // ==========================================

    /**
     * Import notes for a single video
     */
    private async importVideoNotes(
        data: VideoNotesExport,
        options?: ImportOptions
    ): Promise<ImportResult> {
        // Validate data structure
        if (!this.validateVideoNotesData(data)) {
            throw new Error(languageService.translate('invalidJsonFormat'));
        }

        // Check if in global UI (not allowed for single video)
        if (options?.isGlobalUI) {
            await showConfirmDialog({
                title: languageService.translate('videoImportNotAllowedTitle'),
                message: languageService.translate('videoImportNotAllowedHere'),
                confirmText: languageService.translate('ok'),
                hideCancelButton: true
            });
            return { success: false, message: 'Not allowed in global UI' };
        }

        const currentVideoId = getCurrentVideoId();

        // Check video ID mismatch
        if (data.videoId !== currentVideoId) {
            const confirmed = await showConfirmDialog({
                title: languageService.translate('importVideoIdMismatchTitle'),
                message: languageService.translate('importVideoIdMismatchMessage', [
                    this.shortenTitle(data.videoTitle || data.videoId),
                    this.shortenTitle(getVideoTitle() || currentVideoId || 'N/A')
                ]),
                confirmText: languageService.translate('openVideo'),
            });

            if (confirmed) {
                // Save notes for the imported video and open it
                await notesRepository.saveNotes(data.notes, {
                    videoId: data.videoId,
                    videoTitle: data.videoTitle,
                    group: data.group
                });
                window.open(`https://www.youtube.com/watch?v=${data.videoId}`, '_blank');
            }

            return { success: true, message: 'Imported to different video' };
        }

        // Show import decision dialog
        const decisions = await showImportDecisionManager({
            type: 'video_notes',
            importedData: data,
            currentVideoId
        });

        if (!decisions || decisions.length === 0) {
            showToast(languageService.translate('importCancelled'), 'info');
            return { success: false, message: 'Cancelled' };
        }

        const decision = decisions[0]!; // Safe: we checked length > 0
        if (decision.action === 'skip') {
            showToast(languageService.translate('importCancelled'), 'info');
            return { success: false, message: 'Cancelled' };
        }

        if (decision.action === 'replace') {
            await notesRepository.saveNotes(data.notes, {
                videoId: data.videoId,
                videoTitle: data.videoTitle,
                group: data.group,
                channelName: data.channelName,
                channelId: data.channelId
            });
            actions.setNotes(data.notes);
            showToast(languageService.translate('notesImportedSuccess'), 'success');
        } else if (decision.action === 'merge') {
            const existingNotes = await notesRepository.loadNotes(data.videoId);
            const mergedNotes = notesRepository.mergeNotes(existingNotes, data.notes);

            await notesRepository.saveNotes(mergedNotes, {
                videoId: data.videoId,
                videoTitle: data.videoTitle,
                group: data.group,
                channelName: data.channelName,
                channelId: data.channelId
            });
            actions.setNotes(mergedNotes);
            showToast(languageService.translate('notesMergeSuccess'), 'success');
        }

        if (data.group) {
            const currentGroups = settingsService.getSettings().videoGroups || [];
            if (!currentGroups.includes(data.group)) {
                await settingsService.update({ videoGroups: [...currentGroups, data.group] });
            }
            actions.setVideoGroup(data.group);
        }

        return {
            success: true,
            message: 'Import successful',
            videosImported: 1,
            notesImported: data.notes.length
        };
    }

    // ==========================================
    // IMPORT ALL NOTES
    // ==========================================

    /**
     * Import notes for all videos
     */
    private async importAllNotes(
        data: AllNotesExport,
        options?: ImportOptions
    ): Promise<ImportResult> {
        // Validate data structure
        if (!this.validateAllNotesData(data)) {
            throw new Error(languageService.translate('invalidJsonFormat'));
        }

        // Check if not in global UI
        if (!options?.isGlobalUI) {
            await showConfirmDialog({
                title: languageService.translate('globalImportNotAllowedTitle'),
                message: languageService.translate('globalImportNotAllowedHere'),
                confirmText: languageService.translate('ok'),
                hideCancelButton: true
            });
            return { success: false, message: 'Not allowed outside global UI' };
        }

        // Get existing notes
        const existingVideos = await notesRepository.loadAllVideos();

        // Convert Video[] to StoredVideoData[] (Video uses 'id', StoredVideoData uses 'videoId')
        const existingAsStoredData: StoredVideoData[] = existingVideos.map(v => ({
            videoId: v.id,
            videoTitle: v.title,
            notes: v.notes,
            lastModified: v.lastModified,
            group: v.group,
            channelName: v.channelName,
            channelId: v.channelId
        }));

        // Show import decision dialog
        const decisions = await showImportDecisionManager({
            type: 'all_notes',
            importedData: data,
            existingAllNotes: existingAsStoredData
        });

        if (!decisions || decisions.length === 0) {
            showToast(languageService.translate('importCancelled'), 'info');
            return { success: false, message: 'Cancelled' };
        }

        // Process decisions
        const finalVideos = await this.processAllNotesDecisions(
            decisions,
            data.notesByVideo,
            existingVideos
        );

        // Save all
        await notesRepository.overwriteAllNotes(finalVideos);

        // Update groups
        const groups = new Set<string>();
        finalVideos.forEach(v => v.group && groups.add(v.group));

        const currentGroups = settingsService.getSettings().videoGroups || [];
        const newGroups = [...currentGroups];
        let hasNewGroups = false;

        for (const group of groups) {
            if (!newGroups.includes(group)) {
                newGroups.push(group);
                hasNewGroups = true;
            }
        }

        if (hasNewGroups) {
            await settingsService.update({ videoGroups: newGroups });
        }

        // Update current video if affected
        const currentVideoId = getCurrentVideoId();
        if (currentVideoId) {
            const currentVideo = finalVideos.find(v => v.videoId === currentVideoId);
            if (currentVideo) {
                actions.setNotes(currentVideo.notes);
                actions.setVideoGroup(currentVideo.group || null);
            }
        }

        showToast(languageService.translate('allNotesMergeSuccess'), 'success');

        // Callback for UI update
        if (options?.onUpdate) {
            options.onUpdate(finalVideos);
        }

        // Notify other tabs
        chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' }).catch(() => { });

        return {
            success: true,
            message: 'Import successful',
            videosImported: finalVideos.length,
            notesImported: finalVideos.reduce((sum, v) => sum + v.notes.length, 0)
        };
    }

    /**
     * Process all notes import decisions
     */
    private async processAllNotesDecisions(
        decisions: ImportDecision[],
        importedVideos: StoredVideoData[],
        existingVideos: Video[]
    ): Promise<StoredVideoData[]> {
        const existingMap = new Map(
            existingVideos.map(v => [v.id, {
                videoId: v.id,
                videoTitle: v.title,
                notes: v.notes,
                lastModified: v.lastModified,
                group: v.group,
                channelName: v.channelName,
                channelId: v.channelId
            }])
        );

        const finalVideos: StoredVideoData[] = [];

        // Check if user chose merge mode (at least one merge decision means merge mode)
        const isMergeMode = decisions.some(d => d.action === 'merge');

        for (const decision of decisions) {
            const imported = importedVideos.find(v => v.videoId === decision.videoId);
            if (!imported) continue;

            if (decision.action === 'replace') {
                finalVideos.push(imported);
                existingMap.delete(decision.videoId);
            } else if (decision.action === 'merge') {
                const existing = existingMap.get(decision.videoId);
                if (existing) {
                    const merged = notesRepository.mergeNotes(existing.notes, imported.notes);
                    finalVideos.push({
                        ...existing,
                        notes: merged,
                        lastModified: Date.now(),
                        channelName: existing.channelName || imported.channelName,
                        channelId: existing.channelId || imported.channelId
                    });
                    existingMap.delete(decision.videoId);
                } else {
                    finalVideos.push(imported);
                }
            }
        }

        // Only add remaining existing videos if merge mode is enabled
        // If replace mode (no merge), only imported videos are kept
        if (isMergeMode) {
            existingMap.forEach(video => finalVideos.push(video));
        }

        return finalVideos;
    }

    // ==========================================
    // IMPORT FULL BACKUP
    // ==========================================

    /**
     * Import full backup
     */
    private async importFullBackup(backup: FullBackup): Promise<ImportResult> {
        // Version check
        if (!this.isCompatibleVersion(backup.version)) {
            showToast(languageService.translate('incompatibleBackupVersion'), 'error');
            return { success: false, message: 'Incompatible version' };
        }

        const confirmed = await showConfirmDialog({
            title: languageService.translate('restoreBackupTitle'),
            message: languageService.translate('restoreBackupConfirmation'),
            confirmText: languageService.translate('restore'),
            cancelText: languageService.translate('cancel'),
        });

        if (!confirmed) {
            showToast(languageService.translate('importCancelled'), 'info');
            return { success: false, message: 'Cancelled' };
        }

        try {
            // Restore videos
            if (backup.data.videos?.length > 0) {
                await notesRepository.overwriteAllNotes(backup.data.videos);
            }

            // Restore settings
            if (backup.data.settings) {
                // Ensure correct field mapping between export format and Internal Settings
                await settingsService.update(backup.data.settings as any); // Cast for now, verify types later
            }

            // Restore templates
            if (backup.data.templates) {
                await settingsService.update({ presets: backup.data.templates });
            }

            showToast(languageService.translate('backupRestoredSuccess'), 'success');

            // Reload current page to apply changes
            setTimeout(() => window.location.reload(), 1500);

            return {
                success: true,
                message: 'Backup restored',
                videosImported: backup.data.videos?.length || 0
            };
        } catch (error) {
            console.error('Backup restore failed:', error);
            showToast(languageService.translate('backupRestoredError'), 'error');
            return { success: false, message: 'Restore failed' };
        }
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    /**
     * Validate video notes data
     */
    private validateVideoNotesData(data: any): data is VideoNotesExport {
        return (
            data?.type === 'video_notes' &&
            typeof data.videoId === 'string' &&
            Array.isArray(data.notes) &&
            data.notes.every((note: any) =>
                typeof note.timestamp === 'string' &&
                typeof note.timestampInSeconds === 'number' &&
                typeof note.text === 'string'
            )
        );
    }

    /**
     * Validate all notes data
     */
    private validateAllNotesData(data: any): data is AllNotesExport {
        return (
            data?.type === 'all_notes' &&
            Array.isArray(data.notesByVideo) &&
            data.notesByVideo.every((video: any) =>
                typeof video.videoId === 'string' &&
                Array.isArray(video.notes)
            )
        );
    }

    /**
     * Check if data is full backup
     */
    private isFullBackup(data: any): data is FullBackup {
        return data?.version && data?.data?.videos !== undefined;
    }

    /**
     * Check if data is video notes export
     */
    private isVideoNotesExport(data: any): data is VideoNotesExport {
        return data?.type === 'video_notes';
    }

    /**
     * Check if data is all notes export
     */
    private isAllNotesExport(data: any): data is AllNotesExport {
        return data?.type === 'all_notes';
    }

    /**
     * Check version compatibility
     */
    private isCompatibleVersion(version: string): boolean {
        const parts = version.split('.').map(Number);
        const major = parts[0] ?? 0;
        return major <= 2;
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    /**
     * Prompt for password (for encrypted backups)
     */
    private async promptPassword(): Promise<string | null> {
        // Simple prompt for now - can be enhanced with custom dialog
        return window.prompt(languageService.translate('enterBackupPassword'));
    }

    /**
     * Shorten title for display
     */
    private shortenTitle(title: string): string {
        if (!title) return '';
        const words = title.split(' ');
        if (words.length <= 2) return title;
        return `${words[0]} ${words[1]}...`;
    }
}

export const importService = ImportService.getInstance();
export default importService;

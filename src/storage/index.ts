/**
 * Storage Module - Unified Storage System
 * 
 * This module provides a clean, organized API for all storage operations.
 * 
 * @example
 * import { notesRepository, settingsRepository, presetsRepository } from '@/storage';
 * 
 * // Load notes
 * const notes = await notesRepository.loadNotes();
 * 
 * // Get settings
 * const theme = await settingsRepository.getTheme();
 * 
 * // Get templates
 * const templates = await presetsRepository.getPresetTemplates(1);
 */

// Core storage adapter
export { storageAdapter, type StorageArea, type StorageOptions, type StorageQuota } from './StorageAdapter';

// Storage keys
export {
    StorageKeys,
    NOTES_PREFIX,
    isNotesKey,
    extractVideoId,
    isPresetKey,
    isBackupKey,
    type StorageKey
} from './StorageKeys';

// Repositories
export { notesRepository } from './NotesRepository';
export { presetsRepository } from './PresetsRepository';
export { settingsRepository, type SettingsData } from './SettingsRepository';

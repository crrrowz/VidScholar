/**
 * StorageKeys - Centralized storage key management
 * 
 * All storage keys used by the application are defined here.
 * This ensures consistency and prevents typos across the codebase.
 */

/**
 * Prefix for all note-related storage keys
 */
export const NOTES_PREFIX = 'notes_';

/**
 * Storage key builders
 */
export const StorageKeys = {
    // Notes
    notes: (videoId: string) => `${NOTES_PREFIX}${videoId}` as const,
    videoOrder: 'videoOrder' as const,

    // Presets & Templates
    currentPreset: 'current_preset' as const,
    presetTemplates: (presetNumber: number) => `preset_templates_${presetNumber}` as const,
    presetName: (presetNumber: number) => `preset_name_${presetNumber}` as const,

    // Settings
    theme: 'theme' as const,
    language: 'language' as const,
    retentionDays: 'retentionDays' as const,
    videoGroups: 'videoGroups' as const,
    floatingButtonPosition: 'floatingButtonPosition' as const,
    autoAddTranscript: 'autoAddTranscript' as const,

    // Backup
    backupMetadata: 'backup_metadata' as const,
    backup: (id: string) => `backup_${id}` as const,

    // User Settings (unified)
    userSettings: 'user_settings' as const,
} as const;

/**
 * Type for storage key values
 */
export type StorageKey =
    | typeof StorageKeys.videoOrder
    | typeof StorageKeys.currentPreset
    | typeof StorageKeys.theme
    | typeof StorageKeys.language
    | typeof StorageKeys.retentionDays
    | typeof StorageKeys.videoGroups
    | typeof StorageKeys.floatingButtonPosition
    | typeof StorageKeys.autoAddTranscript
    | typeof StorageKeys.backupMetadata
    | typeof StorageKeys.userSettings
    | ReturnType<typeof StorageKeys.notes>
    | ReturnType<typeof StorageKeys.presetTemplates>
    | ReturnType<typeof StorageKeys.presetName>
    | ReturnType<typeof StorageKeys.backup>;

/**
 * Check if a key is a notes key
 */
export function isNotesKey(key: string): boolean {
    return key.startsWith(NOTES_PREFIX);
}

/**
 * Extract video ID from notes key
 */
export function extractVideoId(key: string): string | null {
    if (!isNotesKey(key)) return null;
    return key.slice(NOTES_PREFIX.length);
}

/**
 * Check if a key is a preset key
 */
export function isPresetKey(key: string): boolean {
    return key.startsWith('preset_');
}

/**
 * Check if a key is a backup key
 */
export function isBackupKey(key: string): boolean {
    return key.startsWith('backup_');
}

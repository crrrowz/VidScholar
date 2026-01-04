/**
 * SettingsRepository - Centralized settings management
 * 
 * This repository handles all user settings storage operations.
 * It provides a single source of truth for application settings.
 */

import { storageAdapter } from './StorageAdapter';
import { StorageKeys } from './StorageKeys';
import type { Theme } from '../types';

/**
 * Settings Data Interface (internal representation)
 */
export interface SettingsData {
    theme: Theme;
    language: string;
    retentionDays: number;
    videoGroups: string[];
    floatingButtonPosition: { x: number; y: number } | null;
    autoAddTranscript: boolean;
    autoBackup: boolean;
    lastBackupDate: number | null;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: SettingsData = {
    theme: 'dark',
    language: 'en',
    retentionDays: 30,
    videoGroups: [],
    floatingButtonPosition: null,
    autoAddTranscript: false,
    autoBackup: true,
    lastBackupDate: null,
};

type SettingsListener = (settings: SettingsData) => void;

class SettingsRepository {
    private static instance: SettingsRepository;
    private initialized = false;
    private cachedSettings: SettingsData | null = null;
    private listeners = new Set<SettingsListener>();

    private constructor() { }

    static getInstance(): SettingsRepository {
        if (!SettingsRepository.instance) {
            SettingsRepository.instance = new SettingsRepository();
        }
        return SettingsRepository.instance;
    }

    /**
     * Initialize repository
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        const result = await storageAdapter.initialize();
        if (result) {
            await this.getAll();
            this.initialized = true;
        }
        return result;
    }

    // ==========================================
    // GET SETTINGS
    // ==========================================

    /**
     * Get all settings
     */
    async getAll(): Promise<SettingsData> {
        if (this.cachedSettings) {
            return this.cachedSettings;
        }

        const stored = await storageAdapter.get<Partial<SettingsData>>(StorageKeys.userSettings);
        this.cachedSettings = { ...DEFAULT_SETTINGS, ...stored };
        return this.cachedSettings;
    }

    /**
     * Get a specific setting
     */
    async get<K extends keyof SettingsData>(key: K): Promise<SettingsData[K]> {
        const settings = await this.getAll();
        return settings[key];
    }

    /**
     * Get theme
     */
    async getTheme(): Promise<Theme> {
        return this.get('theme');
    }

    /**
     * Get language
     */
    async getLanguage(): Promise<string> {
        return this.get('language');
    }

    /**
     * Get retention days
     */
    async getRetentionDays(): Promise<number> {
        const days = await this.get('retentionDays');
        return days === 99999 ? Infinity : days;
    }

    /**
     * Get video groups
     */
    async getVideoGroups(): Promise<string[]> {
        return this.get('videoGroups');
    }

    // ==========================================
    // SET SETTINGS
    // ==========================================

    /**
     * Update settings
     */
    async update(updates: Partial<SettingsData>): Promise<boolean> {
        const current = await this.getAll();
        const updated = { ...current, ...updates };

        // Handle special case for Infinity retention days
        if (updates.retentionDays === Infinity) {
            updated.retentionDays = 99999;
        }

        const result = await storageAdapter.set(StorageKeys.userSettings, updated);
        if (result) {
            this.cachedSettings = updated;
            this.notifyListeners(updated);
        }
        return result;
    }

    /**
     * Set a specific setting
     */
    async set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): Promise<boolean> {
        return this.update({ [key]: value } as Partial<SettingsData>);
    }

    /**
     * Set theme
     */
    async setTheme(theme: Theme): Promise<boolean> {
        return this.set('theme', theme);
    }

    /**
     * Set language
     */
    async setLanguage(language: string): Promise<boolean> {
        return this.set('language', language);
    }

    /**
     * Set retention days
     */
    async setRetentionDays(days: number): Promise<boolean> {
        return this.set('retentionDays', days === Infinity ? 99999 : days);
    }

    // ==========================================
    // VIDEO GROUPS
    // ==========================================

    /**
     * Add a video group
     */
    async addVideoGroup(group: string): Promise<boolean> {
        const groups = await this.getVideoGroups();
        if (groups.includes(group)) {
            return true;
        }
        return this.set('videoGroups', [...groups, group]);
    }

    /**
     * Remove a video group
     */
    async removeVideoGroup(group: string): Promise<boolean> {
        const groups = await this.getVideoGroups();
        return this.set('videoGroups', groups.filter(g => g !== group));
    }

    /**
     * Rename a video group
     */
    async renameVideoGroup(oldName: string, newName: string): Promise<boolean> {
        const groups = await this.getVideoGroups();
        const updated = groups.map(g => g === oldName ? newName : g);
        return this.set('videoGroups', updated);
    }

    // ==========================================
    // RESET
    // ==========================================

    /**
     * Reset all settings to defaults
     */
    async resetToDefaults(): Promise<boolean> {
        const result = await storageAdapter.set(StorageKeys.userSettings, DEFAULT_SETTINGS);
        if (result) {
            this.cachedSettings = { ...DEFAULT_SETTINGS };
            this.notifyListeners(this.cachedSettings);
        }
        return result;
    }

    /**
     * Reset a specific setting to default
     */
    async resetSetting<K extends keyof SettingsData>(key: K): Promise<boolean> {
        return this.set(key, DEFAULT_SETTINGS[key]);
    }

    // ==========================================
    // LISTENERS
    // ==========================================

    /**
     * Add settings change listener
     */
    addListener(listener: SettingsListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(settings: SettingsData): void {
        this.listeners.forEach(listener => listener(settings));
    }

    // ==========================================
    // CACHE
    // ==========================================

    /**
     * Clear cached settings
     */
    clearCache(): void {
        this.cachedSettings = null;
    }

    /**
     * Get default settings
     */
    getDefaults(): SettingsData {
        return { ...DEFAULT_SETTINGS };
    }
}

export const settingsRepository = SettingsRepository.getInstance();
export default settingsRepository;

// src/services/SettingsService.ts
import type { UserSettings, Theme } from '../types';
import { storageAdapter } from '../storage/StorageAdapter';
import { supabaseService } from './SupabaseService';
import config from '../utils/config';

// Create consistent default preset structure
const defaultPresets = config.getPresets();

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  locale: 'en',
  autoSaveDelay: 500,
  retentionDays: 30,
  fontSize: 14,
  fontFamily: 'Roboto',
  sidebarWidth: 400,
  sidebarPosition: 'left',
  enableEncryption: false,
  enableAutoBackup: false,
  videoGroups: config.getVideoGroups(),
  // Inject presets from config as default
  presets: defaultPresets
};

class SettingsService {
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<(settings: UserSettings) => void> = new Set();
  private readonly STORAGE_KEY = 'userSettings';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize settings from storage (Local + Cloud Sync)
   */
  async initialize(): Promise<void> {
    try {
      // 1. Load from local storage (fastest)
      const stored = await storageAdapter.get<Partial<UserSettings>>(this.STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...stored };
        this.notifyListeners();
      }

      // 2. Try to load from cloud (Supabase)
      if (await supabaseService.initialize()) {
        const cloudSettings = await supabaseService.loadSettings();

        if (cloudSettings) {
          console.log('SettingsService: Found cloud settings, syncing to local...');

          // MAP Cloud Settings to Local Interface
          const syncedSettings: Partial<UserSettings> = {
            theme: cloudSettings.theme as Theme,
            locale: cloudSettings.language,
            retentionDays: cloudSettings.retention_days,
            videoGroups: cloudSettings.video_groups,
            // Ensure presets are loaded if they exist in cloud JSONB
            presets: cloudSettings.presets || defaultPresets
          };

          // Update State & Local Storage
          this.settings = { ...this.settings, ...syncedSettings };
          await storageAdapter.set(this.STORAGE_KEY, this.settings);
          this.notifyListeners();

        } else {
          // Cloud settings Missing -> Create them from DEFAULTS
          console.log('SettingsService: No cloud settings found. Creating defaults in cloud...');

          // Ensure we have robust defaults before saving
          const settingsToSave = { ...DEFAULT_SETTINGS, ...this.settings }; // Prefer local if exists, else defaults

          // We must ensure videoGroups and presets are populated
          if (!settingsToSave.videoGroups || settingsToSave.videoGroups.length === 0) {
            settingsToSave.videoGroups = config.getVideoGroups();
          }
          if (!settingsToSave.presets || Object.keys(settingsToSave.presets).length === 0) {
            settingsToSave.presets = defaultPresets;
          }

          // Save to Cloud
          await supabaseService.saveSettings({
            theme: settingsToSave.theme,
            language: settingsToSave.locale,
            retention_days: settingsToSave.retentionDays,
            video_groups: settingsToSave.videoGroups,
            presets: settingsToSave.presets
          });

          // Update local state to reflect that we are now synced
          this.settings = settingsToSave;
          await storageAdapter.set(this.STORAGE_KEY, this.settings);
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private async saveToCloud() {
    if (supabaseService.isAvailable()) {
      await supabaseService.saveSettings({
        theme: this.settings.theme,
        language: this.settings.locale,
        retention_days: this.settings.retentionDays,
        video_groups: this.settings.videoGroups,
        presets: this.settings.presets || {}
      });
    }
  }

  /**
   * Get current settings
   */
  getSettings(): Readonly<UserSettings> {
    return { ...this.settings };
  }

  /**
   * Get single setting
   */
  get<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  /**
   * Update settings
   */
  async update(updates: Partial<UserSettings>): Promise<void> {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...updates };

    try {
      // 1. Save locally
      await storageAdapter.set(this.STORAGE_KEY, this.settings);

      // 2. Save to cloud (fire and forget)
      if (supabaseService.isAvailable()) {
        supabaseService.saveSettings({
          theme: this.settings.theme,
          language: this.settings.locale,
          retention_days: this.settings.retentionDays,
          video_groups: this.settings.videoGroups,
          presets: this.settings.presets || {}
        }).catch(err => console.error('Cloud save failed:', err));
      }

      this.notifyListeners();
    } catch (error) {
      // Rollback on error
      this.settings = oldSettings;
      throw error;
    }
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.update(this.settings);
  }

  /**
   * Export settings
   */
  export(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings
   */
  async import(settingsJson: string): Promise<void> {
    try {
      const imported = JSON.parse(settingsJson) as Partial<UserSettings>;
      await this.update(imported);
    } catch (error) {
      throw new Error('Invalid settings format');
    }
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Validate settings
   */
  validate(settings: Partial<UserSettings>): boolean {
    // Theme validation
    if (settings.theme && !this.isValidTheme(settings.theme)) {
      return false;
    }

    // Numeric validations
    if (settings.autoSaveDelay !== undefined && settings.autoSaveDelay < 0) {
      return false;
    }

    if (settings.fontSize !== undefined && (settings.fontSize < 10 || settings.fontSize > 24)) {
      return false;
    }

    if (settings.sidebarWidth !== undefined && (settings.sidebarWidth < 280 || settings.sidebarWidth > 600)) {
      return false;
    }

    return true;
  }

  private isValidTheme(theme: string): theme is Theme {
    return ['light', 'dark', 'sepia', 'high-contrast', 'oled'].includes(theme);
  }

  private notifyListeners(): void {
    const currentSettings = { ...this.settings };
    this.listeners.forEach(listener => listener(currentSettings));
  }
}

export const settingsService = new SettingsService();
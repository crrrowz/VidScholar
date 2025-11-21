// src/services/SettingsService.ts
import type { UserSettings, Theme } from '../types';

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
  videoGroups: ["First-Year English Courses", "Programming Courses", "IELTS", "General Study"]
};

class SettingsService {
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<(settings: UserSettings) => void> = new Set();
  private readonly STORAGE_KEY = 'userSettings';

  /**
   * Initialize settings from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.loadFromStorage();
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...stored };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
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
      await this.saveToStorage();
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
    await this.saveToStorage();
    this.notifyListeners();
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

  private async loadFromStorage(): Promise<Partial<UserSettings> | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        resolve(result[this.STORAGE_KEY] || null);
      });
    });
  }

  private async saveToStorage(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: this.settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private notifyListeners(): void {
    const currentSettings = { ...this.settings };
    this.listeners.forEach(listener => listener(currentSettings));
  }
}

export const settingsService = new SettingsService();
// services/ThemeService.ts
import type { Theme } from '../types';
import config from '../utils/config';
import { storageAdapter } from '../storage/StorageAdapter';
import { settingsService } from './SettingsService';

export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: Theme = 'dark';
  private listeners: Set<(theme: Theme) => void> = new Set();
  private initialized: boolean = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Use storageAdapter instead of direct chrome.storage
    const result = await storageAdapter.get<{ theme: Theme }>('theme');
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    if (result && result.theme) {
      this.currentTheme = result.theme;
    } else {
      this.currentTheme = prefersDarkScheme.matches ? 'dark' : 'light';
    }

    this.applyTheme(this.currentTheme);
    this.initialized = true;

    // Listener for system preference changes
    prefersDarkScheme.addEventListener('change', async (e) => {
      const stored = await storageAdapter.get<{ theme: Theme }>('theme');
      if (!stored || !stored.theme) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
      }
    });
  }

  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  public async setTheme(theme: Theme): Promise<void> {
    this.currentTheme = theme;
    // Save to isolated storage (legacy support/fast switch)
    await storageAdapter.set('theme', theme);
    // Sync with consolidated settings (triggering Cloud Sync)
    await settingsService.update({ theme });
    this.applyTheme(theme);
  }

  public toggleTheme(): void {
    const newTheme: Theme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  public applyTheme(theme: Theme): void {
    this.currentTheme = theme;
    document.documentElement.classList.toggle('light-theme', theme === 'light');
    this.notifyListeners(theme);
  }

  /**
   * Returns theme colors from config.
   * NOTE: For new components, prefer using CSS variables directly.
   */
  public getThemeColors() {
    return config.getTheme(this.currentTheme);
  }

  public addListener(listener: (theme: Theme) => void): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: (theme: Theme) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(theme: Theme): void {
    this.listeners.forEach(listener => listener(theme));
  }

  public styleElement(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
    Object.assign(element.style, styles);
  }
}

export const themeService = ThemeService.getInstance();

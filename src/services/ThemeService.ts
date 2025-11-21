// services/ThemeService.ts
import type { Theme } from '../types';
import config from '../utils/config';

export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: Theme = 'dark';
  private listeners: Set<(theme: Theme) => void> = new Set();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private initialize(): void {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    chrome.storage.sync.get(['theme'], (result) => {
      if (result.theme) {
        this.currentTheme = result.theme;
      } else {
        this.currentTheme = prefersDarkScheme.matches ? 'dark' : 'light';
      }
      this.applyTheme(this.currentTheme);
    });

    prefersDarkScheme.addEventListener('change', (e) => {
      chrome.storage.sync.get(['theme'], (result) => {
        if (!result.theme) {
          this.currentTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(this.currentTheme);
        }
      });
    });
  }

  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  public setTheme(theme: Theme): void {
    this.currentTheme = theme;
    chrome.storage.sync.set({ theme });
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

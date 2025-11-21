// src/services/LanguageService.ts

import { showToast } from "../utils/toast";

class LanguageService {
  private static instance: LanguageService;
  private allMessages: Record<string, Record<string, { message: string, placeholders?: Record<string, { content: string }> }>> = {};
  private supportedLocales: string[] = ['en', 'ar'];
  public currentLocale: string = 'en'; // Changed to public for easier access
  private listeners: ((locale: string) => void)[] = []; // Array of callbacks
  private currentDirection: 'ltr' | 'rtl' = 'ltr';
  private directionListeners: Set<(() => void)> = new Set(); // Set of callbacks for direction changes

  private constructor() {}

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  public async init(): Promise<void> {
    // Load all supported locales upfront
    await Promise.all(this.supportedLocales.map(locale => this.loadMessages(locale)));
    
    this.currentLocale = await this.getPreferredLocale();
    this.currentDirection = this.getDirectionForLocale(this.currentLocale); // Set initial direction
    // No need to set currentMessages here, translate will pick from allMessages
  }

  private async loadMessages(locale: string): Promise<void> {
    try {
      const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
      if (!response.ok) {
        throw new Error(`Failed to load messages for locale ${locale}: ${response.statusText}`);
      }
      this.allMessages[locale] = await response.json();
    } catch (error) {
      console.error(`Error loading messages for locale ${locale}:`, error);
    }
  }

  public async getPreferredLocale(): Promise<string> {
    try {
      const result = await chrome.storage.sync.get('preferredLocale');
      if (result.preferredLocale && this.supportedLocales.includes(result.preferredLocale)) {
        return result.preferredLocale;
      }
      const browserUILocale = chrome.i18n.getUILanguage().split('-')[0];
      if (this.supportedLocales.includes(browserUILocale)) {
        return browserUILocale;
      }
    } catch (error) {
      console.error('Error getting preferred locale from storage:', error);
    }
    return 'en'; // Default fallback
  }

  public async setPreferredLocale(locale: string): Promise<void> {
    if (this.supportedLocales.includes(locale)) {
      await chrome.storage.sync.set({ preferredLocale: locale });
      this.currentLocale = locale;
      this.currentDirection = this.getDirectionForLocale(locale); // Update direction
      this.notifyListeners(); // Notify locale listeners
      this.notifyDirectionListeners(); // Notify direction listeners
    } else {
      console.warn(`Unsupported locale: ${locale}`);
    }
  }

  public addListener(callback: (locale: string) => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: (locale: string) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentLocale));
  }

  // Directionality methods
  private getDirectionForLocale(locale: string): 'ltr' | 'rtl' {
    return locale === 'ar' ? 'rtl' : 'ltr'; // Arabic is RTL, others are LTR
  }

  public getCurrentDirection(): 'ltr' | 'rtl' {
    return this.currentDirection;
  }

  public addDirectionListener(callback: () => void): void {
    this.directionListeners.add(callback);
  }

  public removeDirectionListener(callback: () => void): void {
    this.directionListeners.delete(callback);
  }

  private notifyDirectionListeners(): void {
    this.directionListeners.forEach(callback => callback());
  }

  public translate(key: string, substitutions?: string[]): string {
    const messages = this.allMessages[this.currentLocale] || this.allMessages['en']; // Use current locale or fallback to English
    const messageObj = messages[key];

    if (!messageObj) {
      console.warn(`Translation key "${key}" not found for locale "${this.currentLocale}", falling back to key.`);
      return key; // Return key if not found
    }

    let message = messageObj.message;

    if (messageObj.placeholders && substitutions) {
      Object.keys(messageObj.placeholders).forEach((placeholderKey, index) => {
        const placeholderContent = messageObj.placeholders![placeholderKey].content;
        const subIndexMatch = placeholderContent.match(/\$(\d+)/);
        if (subIndexMatch && substitutions[parseInt(subIndexMatch[1]) - 1] !== undefined) {
                    const placeholderRegex = new RegExp(`\\$${placeholderKey}\\$`, 'gi');
          message = message.replace(placeholderRegex, substitutions[parseInt(subIndexMatch[1]) - 1]);
        }
      });
    }
    return message;
  }
}

export const languageService = LanguageService.getInstance();
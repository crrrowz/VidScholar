// src/services/di/services.ts
import { getContainer, ServiceLifetime } from './Container';
import { NoteStorage } from '../../classes/NoteStorage';
import { ThemeService } from '../ThemeService';
import { LanguageService } from '../LanguageService';
import { ShareService } from '../ShareService';
import { ScreenshotService } from '../ScreenshotService';
import { Store, createStore } from '../../state/Store';
import type { AppState } from '../../types';

/**
 * Service Registration
 */
export function registerServices(): void {
  const container = getContainer();

  // Core Services
  container.singleton('Store', () => {
    const initialState: AppState = {
      notes: [],
      templates: [],
      currentTheme: 'dark',
      selectedNote: null,
      newlyAddedNote: null,
      sidebarInitialized: false,
      isInitialized: false,
      isSaving: false,
      lastSavedContent: '',
      videoTitle: ''
    };
    return createStore(initialState);
  });

  container.singleton('NoteStorage', () => new NoteStorage());
  container.singleton('ThemeService', () => ThemeService);
  container.singleton('LanguageService', () => LanguageService);
  container.singleton('ShareService', () => ShareService);
  container.singleton('ScreenshotService', () => ScreenshotService);

  // Add more services as needed
}

/**
 * Service Getters (Type-safe)
 */
export function getStoreService(): Store {
  return getContainer().resolve<Store>('Store');
}

export function getStorageService(): NoteStorage {
  return getContainer().resolve<NoteStorage>('NoteStorage');
}

export function getThemeService(): typeof ThemeService {
  return getContainer().resolve('ThemeService');
}

export function getLanguageService(): typeof LanguageService {
  return getContainer().resolve('LanguageService');
}

export function getShareService(): typeof ShareService {
  return getContainer().resolve('ShareService');
}

export function getScreenshotService(): typeof ScreenshotService {
  return getContainer().resolve('ScreenshotService');
}
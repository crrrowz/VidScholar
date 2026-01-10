// src/services/index.ts
// Barrel export for all services

export { backupService } from './BackupService';
export { encryptionService } from './EncryptionService';
export { languageService } from './LanguageService';
export { noteActionsService } from './NoteActionsService';
export { noteNotificationService } from './NoteNotificationService';
export { screenshotService } from './ScreenshotService';
export { settingsService } from './SettingsService';
export { shareService } from './ShareService';
export { supabaseService } from './SupabaseService';
export { themeService } from './ThemeService';

// Service Registry
export { serviceRegistry, initializeServices } from './registry';

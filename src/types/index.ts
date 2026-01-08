// src/types/index.ts - Enhanced Type Definitions

// Core Types
export interface Note {
  timestamp: string;
  timestampInSeconds: number;
  text: string;
  tags?: string[];
  links?: string[];
  id?: string;
}

export interface AppState {
  notes: Note[];
  templates: string[];
  currentTheme: Theme;
  selectedNote: Note | null;
  newlyAddedNote: Note | null;
  sidebarInitialized: boolean;
  isInitialized: boolean;
  isSaving: boolean;
  lastSavedContent: string;
  videoTitle: string;
  autoAddTranscript: boolean;
  currentVideoGroup: string | null;
}

export type Theme = 'light' | 'dark' | 'sepia' | 'high-contrast' | 'oled';

export interface ThemeColors {
  primary: string;
  primaryText: string;
  bg: string;
  text: string;
  cardBg: string;
  border: string;
  hoverBg: string;
  activeBg: string;
  icon: string;
  iconHover: string;
  delete: string;
}

// Storage Types
export interface StoredVideoData {
  videoId: string;
  videoTitle: string;
  thumbnail?: string;
  notes: Note[];
  lastModified: number;
  firstNoteTimestamp?: number;
  group?: string;
  channelName?: string;
  channelId?: string;
}

export interface Video {
  id: string;
  title: string;
  thumbnail?: string;
  notes: Note[];
  lastModified: number;
  firstNoteTimestamp?: number;
  group?: string;
  channelName?: string;
  channelId?: string;
}

// Export Types
export interface VideoNotesExport {
  type: 'video_notes';
  version?: string;
  exportDate?: string;
  videoId: string;
  videoTitle: string;
  videoUrl?: string;
  notes: Note[];
  group?: string;
  channelName?: string;
  channelId?: string;
}

export interface AllNotesExport {
  type: 'all_notes';
  version?: string;
  exportDate?: string;
  totalVideos?: number;
  notesByVideo: StoredVideoData[];
}

export type ExportType = 'video_notes' | 'all_notes';

// Import Types
export interface ImportDecision {
  videoId: string;
  action: 'merge' | 'replace' | 'skip';
  notes?: Note[];
}

// Settings Types
export interface UserSettings {
  theme: Theme;
  locale: string;
  autoSaveDelay: number;
  retentionDays: number;
  fontSize: number;
  fontFamily: string;
  sidebarWidth: number;
  sidebarPosition: 'left' | 'right';
  enableEncryption: boolean;
  enableAutoBackup: boolean;
  videoGroups: string[];
  presets?: Record<string, any>;
  floatingButtonPosition?: { x: number; y: number };
  lastModified?: number;
  // Note notification settings
  noteNotifications?: boolean;
  noteNotificationSound?: boolean;
}

export interface Config {
  project: {
    name: string;
    description: string;
    version: string;
    hashtag: string;
    website: string;
  };
  icons: Record<string, string>;
  theme: {
    light: ThemeColors;
    dark: ThemeColors;
    twitter: string;
  };
  storage: {
    cacheDuration: number;
    retentionDays: number;
    maxRetentionDays: number;
    minRetentionDays: number;
  };
  presets: Record<string, {
    name: string;
    description: string;
    templates: string[];
  }>;
  ui: {
    sidebarWidth: string;
    maxSidebarHeight: string;
    noteMaxHeight: string;
    noteMinHeight: string;
    autoSaveDelay: number;
    navigationDelay: number;
    toastDuration: number;
    maxAttempts: number;
    checkInterval: number;
  };
  videoGroups: string[];
}

// Plugin Types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: string[];
}

export interface Plugin {
  manifest: PluginManifest;
  init: () => void;
  destroy: () => void;
}

// Error Types
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'network' | 'storage' | 'general' | 'validation';

export interface AppError {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  stack?: string;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Type Guards
export function isNote(obj: unknown): obj is Note {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'timestamp' in obj &&
    'timestampInSeconds' in obj &&
    'text' in obj
  );
}

export function isVideo(obj: unknown): obj is Video {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'notes' in obj &&
    Array.isArray((obj as any).notes)
  );
}

export function isAppError(obj: unknown): obj is AppError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'message' in obj &&
    'category' in obj &&
    'severity' in obj
  );
}
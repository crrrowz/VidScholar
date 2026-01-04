// src/constants/index.ts
// Application Constants

/**
 * Storage Keys used for Chrome storage
 */
export const STORAGE_KEYS = {
    NOTES: 'vidscholar_notes',
    SETTINGS: 'vidscholar_settings',
    TEMPLATES: 'vidscholar_templates',
    PRESET_NUMBER: 'vidscholar_preset_number',
    PRESET_TEMPLATES: 'vidscholar_preset_templates_',
    PRESET_NAME: 'vidscholar_preset_name_',
    VIDEO_ORDER: 'vidscholar_video_order',
    RETENTION_DAYS: 'vidscholar_retention_days',
    THEME: 'vidscholar_theme',
    LANGUAGE: 'vidscholar_language',
    ENCRYPTION_KEY: 'vidscholar_encryption_key',
    FLOATING_BUTTON_POSITION: 'vidscholar_floating_button_position',
    VIDEO_GROUPS: 'vidscholar_video_groups',
} as const;

/**
 * CSS Class Names
 */
export const CSS_CLASSES = {
    // App
    APP_ROOT: 'vidscholar-app',

    // Buttons
    BUTTON: 'btn',
    BUTTON_PRIMARY: 'btn--primary',
    BUTTON_DEFAULT: 'btn--default',
    BUTTON_GHOST: 'btn--ghost',
    BUTTON_DANGER: 'btn--danger',
    BUTTON_SUCCESS: 'btn--success',
    BUTTON_ICON: 'btn--icon',
    BUTTON_DISABLED: 'btn--disabled',

    // Notes
    NOTE: 'note',
    NOTE_SELECTED: 'selected',
    NOTE_HOVER: 'note-hover-effect',

    // Modals
    MODAL_OVERLAY: 'modal-overlay',
    MODAL_VISIBLE: 'visible',

    // Theme
    LIGHT_THEME: 'light-theme',
    DARK_THEME: 'dark-theme',

    // States
    ACTIVE: 'active',
    LOADING: 'loading',
    ERROR: 'error',
    SUCCESS: 'success',
} as const;

/**
 * Event Names
 */
export const EVENTS = {
    // Chrome Messages
    NOTES_UPDATED: 'NOTES_UPDATED_GLOBALLY',
    LOAD_VIDEO_DATA: 'LOAD_VIDEO_DATA',
    THEME_CHANGED: 'THEME_CHANGED',
    LANGUAGE_CHANGED: 'LANGUAGE_CHANGED',

    // YouTube Events
    YT_NAVIGATE_FINISH: 'yt-navigate-finish',

    // Custom Events
    SIDEBAR_READY: 'vidscholar:sidebar-ready',
    NOTE_ADDED: 'vidscholar:note-added',
    NOTE_DELETED: 'vidscholar:note-deleted',
    NOTE_UPDATED: 'vidscholar:note-updated',
} as const;

/**
 * Default Values
 */
export const DEFAULTS = {
    THEME: 'dark' as const,
    LANGUAGE: 'en',
    AUTO_SAVE_DELAY: 2000,
    RETENTION_DAYS: 30,
    SIDEBAR_WIDTH: '400px',
    MAX_SIDEBAR_HEIGHT: '85vh',
    NAVIGATION_DELAY: 500,
    THUMBNAIL_WIDTH: 160,
    THUMBNAIL_HEIGHT: 90,
    PRESET_COUNT: 5,
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
    // Storage Errors
    STORAGE_ACCESS_DENIED: 'Unable to access storage. Please check extension permissions.',
    STORAGE_WRITE_FAILED: 'Failed to save data. Please try again.',
    STORAGE_READ_FAILED: 'Failed to load data. Please refresh the page.',

    // Video Errors
    VIDEO_NOT_FOUND: 'Unable to find video player.',
    VIDEO_ID_NOT_FOUND: 'Unable to get video ID.',

    // Import/Export Errors
    IMPORT_FAILED: 'Failed to import notes. Invalid file format.',
    EXPORT_FAILED: 'Failed to export notes. Please try again.',

    // General Errors
    UNEXPECTED_ERROR: 'An unexpected error occurred.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    INITIALIZATION_FAILED: 'Failed to initialize. Please refresh the page.',
} as const;

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
    NOTE_SAVED: 'Note saved successfully',
    NOTE_DELETED: 'Note deleted successfully',
    NOTES_IMPORTED: 'Notes imported successfully',
    NOTES_EXPORTED: 'Notes exported successfully',
    SETTINGS_SAVED: 'Settings saved successfully',
    COPIED_TO_CLIPBOARD: 'Copied to clipboard',
} as const;

/**
 * YouTube Selectors
 */
export const YOUTUBE_SELECTORS = {
    SECONDARY_COLUMN: '#secondary',
    VIDEO_PLAYER: '.html5-video-player',
    VIDEO_ELEMENT: 'video',
    VIDEO_TITLE: 'h1.ytd-video-primary-info-renderer',
    TRANSCRIPT_PANEL: 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
} as const;

/**
 * Animation Durations (in ms)
 */
export const ANIMATION_DURATIONS = {
    FAST: 120,
    BASE: 200,
    SLOW: 300,
} as const;

/**
 * Z-Index Layers
 */
export const Z_INDEX = {
    BASE: 1,
    ELEVATED: 10,
    TOOLTIP: 2000,
    MODAL: 3000,
    NOTIFICATION: 3000,
} as const;

/**
 * Keyboard Shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
    ADD_NOTE: 'n',
    SCREENSHOT: 's',
    SAVE: 'ctrl+s',
    ESCAPE: 'Escape',
} as const;

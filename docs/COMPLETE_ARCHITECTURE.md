# VidScholar - Complete Architectural Design

> **Version:** 2.1.0  
> **Status:** Production-Ready Architecture  
> **Last Updated:** December 27, 2024

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Component Architecture](#4-component-architecture)
5. [State Management](#5-state-management)
6. [Dependency Injection](#6-dependency-injection)
7. [Service Layer](#7-service-layer)
8. [Security Architecture](#8-security-architecture)
9. [Testing Architecture](#9-testing-architecture)
10. [Chrome Web Store Readiness](#10-chrome-web-store-readiness)

---

## 1. Executive Summary

### 1.1 Product Vision

VidScholar transforms YouTube from a passive video platform into an active learning environment. It enables learners to:

- **Capture knowledge contextually** with timestamped notes
- **Navigate instantly** between notes and video content
- **Organise efficiently** with templates and categories
- **Persist knowledge** across sessions and devices

### 1.2 Architectural Principles

| Principle | Implementation |
|-----------|----------------|
| **Separation of Concerns** | UI, Business Logic, and Data layers are strictly separated |
| **Single Source of Truth** | Centralised Redux-like immutable state store |
| **Dependency Inversion** | All services accessed via DI container |
| **Type Safety** | TypeScript strict mode with no `any` types |
| **Testability** | Every component designed for unit testing |
| **Security First** | Enterprise-grade encryption infrastructure |

### 1.3 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Sidebar   │  │   Toolbar   │  │   Modals    │         │
│  │  Components │  │  Components │  │  Components │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                  Vanilla TypeScript + DOM                   │
├─────────────────────────────────────────────────────────────┤
│                      STATE LAYER                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Redux-like Store                      │   │
│  │  • Immutable State  • Undo/Redo  • Subscriptions    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     SERVICE LAYER                           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │  Theme    │ │ Language  │ │  Storage  │ │  Backup   │  │
│  │  Service  │ │  Service  │ │  Service  │ │  Service  │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                  DI Container (Singleton/Transient)         │
├─────────────────────────────────────────────────────────────┤
│                    PLATFORM LAYER                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Browser Extension APIs                  │   │
│  │  • chrome.storage.local  • chrome.tabs              │   │
│  │  • chrome.runtime        • Manifest V3              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture Overview

### 2.1 Extension Architecture

VidScholar follows a Manifest V3 architecture with clear separation between extension contexts:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER CONTEXT                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐      ┌──────────────────────────────┐    │
│  │   BACKGROUND SCRIPT  │◄────►│        CONTENT SCRIPT         │    │
│  │   (Service Worker)   │      │       (YouTube Pages)         │    │
│  │                      │      │                                │    │
│  │  • Tab Monitoring    │      │  • UI Injection                │    │
│  │  • Message Routing   │      │  • State Management            │    │
│  │  • Video Detection   │      │  • DOM Manipulation            │    │
│  └──────────────────────┘      │  • Event Handling              │    │
│           │                    └──────────────────────────────┘    │
│           │                                  │                      │
│           ▼                                  ▼                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                   CHROME.STORAGE.LOCAL                    │      │
│  │                                                           │      │
│  │  • Notes Data (per video)     • User Settings             │      │
│  │  • Template Presets           • Theme Preferences         │      │
│  │  • Backup Metadata            • Video Library             │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure

```
VidScholar/
├── entrypoints/                    # Extension Entry Points
│   ├── content.ts                  # Main UI injection script
│   ├── content/                    # Content script assets
│   │   ├── design-tokens.css       # CSS custom properties
│   │   └── components.css          # Component styles
│   └── background.ts               # Service worker
│
├── src/                            # Source Code
│   ├── components/                 # UI Components (No Business Logic)
│   │   ├── sidebar/                # Main sidebar container
│   │   ├── notes/                  # Note display components
│   │   ├── toolbar/                # Action toolbars
│   │   ├── modals/                 # Dialog components
│   │   ├── ui/                     # Reusable UI primitives
│   │   └── video/                  # Video-related components
│   │
│   ├── services/                   # Business Logic Services
│   │   ├── di/                     # Dependency Injection
│   │   │   ├── Container.ts        # DI container implementation
│   │   │   └── services.ts         # Service registration
│   │   ├── ThemeService.ts         # Theme management
│   │   ├── LanguageService.ts      # i18n/l10n
│   │   ├── SettingsService.ts      # User preferences
│   │   ├── BackupService.ts        # Data backup/restore
│   │   ├── EncryptionService.ts    # AES-256-GCM encryption
│   │   ├── ShareService.ts         # Export/share functionality
│   │   └── ScreenshotService.ts    # Video frame capture
│   │
│   ├── state/                      # State Management
│   │   ├── Store.ts                # Redux-like immutable store
│   │   └── actions.ts              # Typed action creators
│   │
│   ├── classes/                    # Core Domain Classes
│   │   ├── NoteStorage.ts          # Note persistence abstraction
│   │   ├── NoteCache.ts            # In-memory caching
│   │   └── NoteError.ts            # Error handling
│   │
│   ├── types/                      # TypeScript Definitions
│   │   └── index.ts                # All type definitions
│   │
│   ├── utils/                      # Utility Functions
│   │   ├── video.ts                # Video utilities
│   │   ├── time.ts                 # Time formatting
│   │   ├── toast.ts                # Notifications
│   │   ├── icons.ts                # Icon management
│   │   └── config.ts               # Configuration
│   │
│   └── config/                     # Configuration Constants
│       └── defaults.ts             # Default values
│
├── tests/                          # Test Suites
│   ├── setup.ts                    # Jest configuration
│   ├── state/                      # State management tests
│   ├── services/                   # Service tests
│   ├── classes/                    # Class tests
│   └── e2e/                        # Playwright tests
│
├── public/                         # Static Assets
│   ├── icon.png                    # Extension icons
│   └── _locales/                   # i18n message files
│
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md             # Architecture overview
│   ├── INSTALLATION.md             # Setup guide
│   └── ADRs/                       # Architectural decisions
│
└── Configuration Files
    ├── wxt.config.ts               # WXT configuration
    ├── tsconfig.json               # TypeScript config
    ├── jest.config.js              # Jest config
    ├── playwright.config.ts        # Playwright config
    ├── tailwind.config.js          # Tailwind CSS config
    └── .eslintrc.json              # ESLint config
```

---

## 3. Data Flow Architecture

### 3.1 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                               │
│                    (Click, Type, Navigate, etc.)                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          UI COMPONENTS                                   │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Sidebar   │  │  NotesList  │  │   Toolbar   │  │   Modals    │    │
│  │             │  │             │  │             │  │             │    │
│  │  • Render   │  │  • Render   │  │  • Render   │  │  • Render   │    │
│  │  • Events   │  │  • Events   │  │  • Events   │  │  • Events   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                 │                                        │
│                    Dispatch Action (e.g., actions.addNote())            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           STATE STORE                                    │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                        AppState                                │      │
│  │  {                                                             │      │
│  │    notes: Note[],                                              │      │
│  │    templates: string[],                                        │      │
│  │    currentTheme: Theme,                                        │      │
│  │    selectedNote: Note | null,                                  │      │
│  │    sidebarInitialized: boolean,                                │      │
│  │    videoTitle: string,                                         │      │
│  │    currentVideoGroup: string | null                            │      │
│  │  }                                                             │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                 │                                        │
│                    State Change → Notify Subscribers                     │
│                    Save to History (Undo/Redo)                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
┌─────────────────────────────┐     ┌─────────────────────────────────────┐
│       UI RE-RENDER          │     │          AUTO-SAVE MIDDLEWARE        │
│                             │     │                                      │
│  Subscribed components      │     │  Debounced persistence               │
│  receive new state and      │     │  (500ms delay)                       │
│  update their DOM           │     │                                      │
└─────────────────────────────┘     └─────────────────┬───────────────────┘
                                                      │
                                                      ▼
                                    ┌─────────────────────────────────────┐
                                    │          STORAGE SERVICE             │
                                    │                                      │
                                    │  NoteStorage.saveNotes()             │
                                    │           │                          │
                                    │           ▼                          │
                                    │  chrome.storage.local.set()          │
                                    └─────────────────────────────────────┘
```

### 3.2 Message Flow Between Scripts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND SCRIPT                                 │
│                                                                          │
│  chrome.tabs.onUpdated ─────────────────────────────────────────────┐   │
│                                                                      │   │
│  When: tab.url.includes("youtube.com/watch") && status === "complete"   │
│                                                                      │   │
│  chrome.tabs.sendMessage(tabId, {                                   │   │
│    type: "LOAD_VIDEO_DATA",                                         │   │
│    videoId: extractedVideoId                                        │   │
│  })                                                                  │   │
│         │                                                            │   │
└─────────┼────────────────────────────────────────────────────────────┘   │
          │                                                                │
          ▼                                                                │
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SCRIPT                                   │
│                                                                          │
│  chrome.runtime.onMessage.addListener((message) => {                    │
│    if (message.type === "LOAD_VIDEO_DATA") {                            │
│      initializeVideoFeatures();                                         │
│    }                                                                     │
│  });                                                                     │
│                                                                          │
│  Also listens for:                                                       │
│  - "NOTES_UPDATED_GLOBALLY" → Refresh notes from storage                │
│                                                                          │
│  YouTube Navigation Events:                                              │
│  - "yt-navigate-finish" → Reinitialize sidebar for new video            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
                        ┌───────────────────┐
                        │   Content Script   │
                        │  (content.ts)      │
                        └─────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          ┌─────────────────┐         ┌─────────────────┐
          │  FloatingButton │         │     Sidebar     │
          │   (toggle)      │         │   (main UI)     │
          └─────────────────┘         └────────┬────────┘
                                               │
                   ┌───────────────────────────┼───────────────────────────┐
                   │                           │                           │
                   ▼                           ▼                           ▼
          ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
          │   MainToolbar   │         │    NotesList    │         │   SubToolbar    │
          │                 │         │                 │         │                 │
          │ • Add Note      │         │ • Note Cards    │         │ • Export        │
          │ • Templates     │         │ • Timestamps    │         │ • Settings      │
          │ • Theme         │         │ • Edit/Delete   │         │ • Share         │
          └─────────────────┘         └─────────────────┘         └─────────────────┘
                   │                                                       │
                   ▼                                                       ▼
          ┌─────────────────┐                                     ┌─────────────────┐
          │ TemplateModal   │                                     │  SettingsModal  │
          └─────────────────┘                                     └─────────────────┘
```

### 4.2 Component Design Principles

Each component follows strict separation:

```typescript
// Example: Note component structure

// ❌ WRONG - Business logic in component
function createNoteCard(note: Note) {
  const card = document.createElement('div');
  // BAD: Direct storage access in component
  chrome.storage.local.set({ notes }); 
  return card;
}

// ✅ CORRECT - Pure UI component
function createNoteCard(
  note: Note 
  callbacks: {
    onDelete: (note: Note) => void;
    onEdit: (note: Note, text: string) => void;
    onTimestampClick: (seconds: number) => void;
  }
): HTMLElement {
  const card = document.createElement('div');
  
  // Component only handles rendering and event delegation
  deleteButton.addEventListener('click', () => callbacks.onDelete(note));
  
  return card;
}
```

---

## 5. State Management

### 5.1 Store Architecture

```typescript
// src/state/Store.ts

interface AppState {
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

class Store {
  private state: AppState;
  private listeners: Set<Listener>;
  private history: AppState[];      // Undo/Redo history
  private historyIndex: number;
  private maxHistorySize: number;   // 50 actions

  // Core API
  getState(): Readonly<AppState>
  setState(updater: StateUpdater | Partial<AppState>): void
  subscribe(listener: Listener): () => void
  
  // Undo/Redo
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  
  // Batch Operations
  batchUpdate(updater: () => void): void
}
```

### 5.2 Actions Pattern

```typescript
// src/state/actions.ts

export const actions = {
  // Note Actions
  addNote(note: Note): void,
  updateNote(noteId: string, updates: Partial<Note>): void,
  deleteNote(note: Note): Promise<void>,
  selectNote(note: Note | null): void,
  sortNotes(): void,
  setNotes(notes: Note[]): void,
  
  // Template Actions
  setTemplates(templates: string[]): void,
  addTemplate(template: string): void,
  
  // Theme Actions
  setTheme(theme: Theme): void,
  
  // UI State Actions
  setSidebarInitialized(initialized: boolean): void,
  setVideoTitle(title: string): void,
  setVideoGroup(group: string | null): void,
  setSaving(isSaving: boolean): void,
  
  // Batch Actions
  initializeState(notes: Note[], templates: string[], theme: Theme): void,
  
  // Persistence Actions
  saveNotes(): Promise<void>,
  loadState(): Promise<void>,
};

// Auto-save middleware
export function enableAutoSave(delayMs: number = 500): () => void
```

### 5.3 State Flow Example

```
User clicks "Add Note" → actions.addNote(note)
                              │
                              ▼
                        Store.setState()
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             Save to History      Notify Listeners
                    │                   │
                    │                   ▼
                    │            UI Updates
                    │         (updateSidebarNotes)
                    │
                    └──────────────────▶ After 500ms
                                              │
                                              ▼
                                     actions.saveNotes()
                                              │
                                              ▼
                                  chrome.storage.local.set()
```

---

## 6. Dependency Injection

### 6.1 Container Architecture

```typescript
// src/services/di/Container.ts

enum ServiceLifetime {
  SINGLETON = 'singleton',   // One instance forever
  TRANSIENT = 'transient',   // New instance each resolve
  SCOPED = 'scoped'          // One instance per scope
}

class Container {
  private services: Map<string, ServiceRegistration>;
  private scopedInstances: Map<string, any>;

  // Registration
  register<T>(name: string, definition: ServiceDefinition<T>, 
              lifetime?: ServiceLifetime, dependencies?: string[]): void
  singleton<T>(name: string, definition: ServiceDefinition<T>): void
  transient<T>(name: string, definition: ServiceDefinition<T>): void
  
  // Resolution
  resolve<T>(name: string): T
  has(name: string): boolean
  
  // Lifecycle
  clearScope(): void
  clear(): void
}

// Global container instance
export function getContainer(): Container
export function resetContainer(): void
```

### 6.2 Service Registration

```typescript
// src/services/di/services.ts

export function registerServices(): void {
  const container = getContainer();
  
  // Core Services (Singletons)
  container.singleton('Store', () => createStore(initialState));
  container.singleton('NoteStorage', () => new NoteStorage());
  container.singleton('ThemeService', () => new ThemeService());
  container.singleton('LanguageService', () => new LanguageService());
  container.singleton('SettingsService', () => new SettingsService());
  container.singleton('BackupService', () => new BackupService());
  container.singleton('EncryptionService', () => new EncryptionService());
  container.singleton('ShareService', () => new ShareService());
  container.singleton('ScreenshotService', () => new ScreenshotService());
}

// Type-safe getters
export function getStoreService(): Store
export function getStorageService(): NoteStorage
export function getThemeService(): ThemeService
// ... etc
```

### 6.3 Current vs Target Architecture

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Service Access | Direct imports (`themeService.getInstance()`) | DI container (`getThemeService()`) |
| Testing | Requires module mocking | Simple service substitution |
| Coupling | Components coupled to concrete services | Components dependent on interfaces |

---

## 7. Service Layer

### 7.1 Service Responsibilities

| Service | Responsibility | Key Methods |
|---------|----------------|-------------|
| **ThemeService** | Theme management, CSS variable application | `applyTheme()`, `toggleTheme()`, `getCurrentTheme()` |
| **LanguageService** | i18n, RTL support, translations | `getString()`, `getCurrentDirection()`, `setLocale()` |
| **SettingsService** | User preferences management | `get()`, `update()`, `reset()`, `export()` |
| **NoteStorage** | Note CRUD, caching, persistence | `saveNotes()`, `loadNotes()`, `deleteNote()` |
| **BackupService** | Data backup and restore | `createBackup()`, `restoreBackup()`, `listBackups()` |
| **EncryptionService** | AES-256-GCM encryption | `encrypt()`, `decrypt()`, `hashPassword()` |
| **ShareService** | Export notes in various formats | `exportAsJSON()`, `exportAsMarkdown()`, `share()` |
| **ScreenshotService** | Video frame capture | `captureFrame()`, `downloadScreenshot()` |

### 7.2 Service Implementation Examples

```typescript
// ThemeService
class ThemeService {
  private currentTheme: Theme = 'dark';
  
  applyTheme(theme: Theme): void {
    const root = document.documentElement;
    const colors = this.getThemeColors(theme);
    
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    this.currentTheme = theme;
    this.persistTheme(theme);
  }
}

// EncryptionService
class EncryptionService {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly ITERATIONS = 100000; // PBKDF2
  
  async encrypt(data: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      key,
      new TextEncoder().encode(data)
    );
    
    return this.combineAndEncode(salt, iv, encrypted);
  }
}
```

---

## 8. Security Architecture

### 8.1 Security Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐      ┌─────────────────────────────────────┐  │
│  │  Encryption Service │      │        Backup Service                │  │
│  │                     │      │                                      │  │
│  │  • AES-256-GCM      │─────►│  • Optional encryption              │  │
│  │  • PBKDF2 (100K)    │      │  • Integrity verification           │  │
│  │  • Random Salt/IV   │      │  • Backup rotation (last 5)         │  │
│  │  • Password hashing │      │  • Export/Import                    │  │
│  └─────────────────────┘      └─────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Error Boundary                              │   │
│  │                                                                   │   │
│  │  • Categorised errors (network, storage, validation, general)   │   │
│  │  • Severity levels (low, medium, high, critical)                │   │
│  │  • Error logging (last 100 errors)                              │   │
│  │  • User-friendly notifications                                   │   │
│  │  • Graceful degradation                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Encryption Flow

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│                   │     │                   │     │                   │
│   User Data       │────►│   Encryption      │────►│  Encrypted        │
│   (JSON string)   │     │   Process         │     │  (Base64)         │
│                   │     │                   │     │                   │
└───────────────────┘     └─────────┬─────────┘     └───────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                   ┌─────────────┐     ┌─────────────┐
                   │   Password  │     │   PBKDF2    │
                   │   Input     │────►│   100,000   │
                   │             │     │   iterations│
                   └─────────────┘     └──────┬──────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  AES Key    │
                                       │  (256-bit)  │
                                       └──────┬──────┘
                                              │
              ┌───────────────────────────────┴───────────────────────────┐
              ▼                               ▼                           ▼
       ┌─────────────┐                ┌─────────────┐              ┌─────────────┐
       │   Random    │                │   Random    │              │  AES-GCM    │
       │   Salt      │                │   IV        │              │  Encrypt    │
       │   (16 bytes)│                │   (12 bytes)│              │             │
       └──────┬──────┘                └──────┬──────┘              └──────┬──────┘
              │                              │                            │
              └──────────────────────────────┴────────────────────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────┐
                              │   Combined Output:          │
                              │   [SALT][IV][ENCRYPTED_DATA]│
                              │   → Base64 encoded          │
                              └─────────────────────────────┘
```

### 8.3 Permissions (Manifest V3)

```json
{
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://*.googlevideo.com/*"
  ]
}
```

| Permission | Justification |
|------------|---------------|
| `storage` | Store notes, settings, and backups locally |
| `youtube.com/*` | Inject UI and access video information |
| `googlevideo.com/*` | Capture video frames for screenshots |

---

## 9. Testing Architecture

### 9.1 Testing Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TESTING PYRAMID                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                            /\                                            │
│                           /  \                                           │
│                          / E2E\        Playwright                        │
│                         /──────\       (5-10 tests)                      │
│                        /        \                                        │
│                       / Integr.  \     Component + Service               │
│                      /────────────\    (20-30 tests)                     │
│                     /              \                                     │
│                    /     Unit       \   Jest                             │
│                   /──────────────────\  (100+ tests)                     │
│                  /                    \                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Test Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@state/(.*)$': '<rootDir>/src/state/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### 9.3 Test Examples

```typescript
// Unit Test: Store
describe('Store', () => {
  it('should update state immutably', () => {
    const store = new Store({ notes: [] });
    store.setState({ notes: [mockNote] });
    
    expect(store.getState().notes).toHaveLength(1);
  });
  
  it('should support undo/redo', () => {
    const store = new Store({ notes: [] });
    store.setState({ notes: [mockNote] });
    
    store.undo();
    expect(store.getState().notes).toHaveLength(0);
    
    store.redo();
    expect(store.getState().notes).toHaveLength(1);
  });
});

// E2E Test: Note Creation
test('user can add a timestamped note', async ({ page }) => {
  await page.goto('https://www.youtube.com/watch?v=testVideoId');
  
  await page.click('#vidscholar-add-note');
  await page.fill('#note-textarea', 'Test note content');
  
  await expect(page.locator('.note-card')).toBeVisible();
  await expect(page.locator('.note-timestamp')).toContainText('0:00');
});
```

---

## 10. Chrome Web Store Readiness

### 10.1 Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Manifest V3** | ✅ | Using service worker, not background pages |
| **Minimal Permissions** | ✅ | Only `storage`, no `tabs` |
| **Content Security Policy** | ✅ | Default CSP, no inline scripts |
| **Privacy Policy** | ⚠️ | Required for submission |
| **Clear Description** | ✅ | Comprehensive package.json description |
| **Quality Icons** | ✅ | 16x16, 48x48, 128x128 |
| **No Remote Code** | ✅ | All code bundled |

### 10.2 Store Listing Preparation

```json
{
  "name": "VidScholar",
  "version": "1.2.0",
  "description": "Elevate your learning on YouTube with timestamped notes, templates, and powerful study tools.",
  "categories": ["productivity", "education"],
  "languages": ["en", "ar"]
}
```

### 10.3 Pre-Launch Tasks

- [ ] Privacy policy document
- [ ] Screenshots (1280x800 or 640x400)
- [ ] Promotional tile (440x280)
- [ ] Detailed description (up to 132 chars short, unlimited detailed)
- [ ] Category selection
- [ ] Language support declaration
- [ ] Payment for developer account ($5 one-time)

---

## Appendix A: Type Definitions

```typescript
// Core Types
interface Note {
  timestamp: string;        // Display format "mm:ss"
  timestampInSeconds: number;
  text: string;
  tags?: string[];
  links?: string[];
  id?: string;
}

interface Video {
  id: string;
  title: string;
  thumbnail?: string;
  notes: Note[];
  lastModified: number;
  group?: string;
}

type Theme = 'light' | 'dark' | 'sepia' | 'high-contrast' | 'oled';

interface UserSettings {
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
}

// Error Types
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
type ErrorCategory = 'network' | 'storage' | 'general' | 'validation';

interface AppError {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  stack?: string;
}
```

---

## Appendix B: Migration Roadmap

### Phase 1: Foundation (COMPLETE)
- [x] Redux-like state store
- [x] DI container
- [x] TypeScript strict mode
- [x] Testing infrastructure
- [x] Encryption service
- [x] Backup service

### Phase 2: DI Adoption (IN PROGRESS)
- [ ] Migrate all components to use DI
- [ ] Remove direct service imports
- [ ] Implement service interfaces

### Phase 3: UI Modernisation (PLANNED)
- [ ] Migrate to React components
- [ ] Implement design system
- [ ] Add animation library

### Phase 4: Feature Completion (PLANNED)
- [ ] Backup/restore UI
- [ ] Encryption toggle UI
- [ ] Plugin system
- [ ] Cloud sync

---

*This document serves as the canonical reference for VidScholar's architecture. All development should align with these patterns and principles.*

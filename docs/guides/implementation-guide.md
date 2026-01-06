# VidScholar - Implementation Guide

> Practical examples and patterns for developing VidScholar

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Core Implementation Examples](#2-core-implementation-examples)
3. [Creating Components](#3-creating-components)
4. [Working with State](#4-working-with-state)
5. [Using Services](#5-using-services)
6. [Testing Guide](#6-testing-guide)
7. [Common Patterns](#7-common-patterns)

---

## 1. Quick Start

### Development Setup

```bash
# Clone and install
git clone <repository-url>
cd VidScholar
npm install

# Start development (hot reload)
npm run dev

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select: .output/chrome-mv3
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Production build (Chrome) |
| `npm run build:firefox` | Production build (Firefox) |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run type-check` | TypeScript verification |
| `npm run test` | Jest unit tests |
| `npm run e2e` | Playwright E2E tests |
| `npm run validate` | Full validation pipeline |

---

## 2. Core Implementation Examples

### 2.1 The Store (State Management)

```typescript
// src/state/Store.ts - Core implementation

import type { AppState, Note } from '../types';

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private history: AppState[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor(initialState: AppState) {
    this.state = this.deepClone(initialState);
    this.saveToHistory();
  }

  // Get current state (returns immutable copy)
  getState(): Readonly<AppState> {
    return this.deepClone(this.state);
  }

  // Subscribe to state changes
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Update state immutably
  setState(updater: Partial<AppState> | ((state: AppState) => Partial<AppState>)): void {
    const updates = typeof updater === 'function' 
      ? updater(this.deepClone(this.state))
      : updater;

    if (!updates) return;

    const newState = { ...this.state, ...updates };
    
    if (this.hasChanged(this.state, newState)) {
      this.state = newState;
      this.saveToHistory();
      this.notifyListeners();
    }
  }

  // Batch multiple updates (single notification)
  batchUpdate(updater: () => void): void {
    const originalNotify = this.notifyListeners.bind(this);
    let shouldNotify = false;

    this.notifyListeners = () => { shouldNotify = true; };
    updater();
    this.notifyListeners = originalNotify;

    if (shouldNotify) {
      this.notifyListeners();
    }
  }

  // Undo/Redo
  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = this.deepClone(this.history[this.historyIndex]);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = this.deepClone(this.history[this.historyIndex]);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  private saveToHistory(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(this.deepClone(this.state));

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  private notifyListeners(): void {
    const currentState = this.deepClone(this.state);
    this.listeners.forEach(listener => listener(currentState));
  }

  private hasChanged(oldState: AppState, newState: AppState): boolean {
    return JSON.stringify(oldState) !== JSON.stringify(newState);
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Singleton pattern
let storeInstance: Store | null = null;

export function createStore(initialState: AppState): Store {
  if (!storeInstance) {
    storeInstance = new Store(initialState);
  }
  return storeInstance;
}

export function getStore(): Store {
  if (!storeInstance) {
    throw new Error('Store not initialized. Call createStore first.');
  }
  return storeInstance;
}
```

### 2.2 The DI Container

```typescript
// src/services/di/Container.ts

type Constructor<T = unknown> = new (...args: unknown[]) => T;
type Factory<T = unknown> = (...args: unknown[]) => T;
type ServiceDefinition<T = unknown> = Constructor<T> | Factory<T>;

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped'
}

interface ServiceRegistration {
  definition: ServiceDefinition;
  lifetime: ServiceLifetime;
  instance?: unknown;
  dependencies?: string[];
}

export class Container {
  private services = new Map<string, ServiceRegistration>();
  private scopedInstances = new Map<string, unknown>();

  // Register a service
  register<T>(
    name: string,
    definition: ServiceDefinition<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: string[] = []
  ): void {
    this.services.set(name, {
      definition,
      lifetime,
      dependencies
    });
  }

  // Convenience methods
  singleton<T>(name: string, definition: ServiceDefinition<T>): void {
    this.register(name, definition, ServiceLifetime.SINGLETON);
  }

  transient<T>(name: string, definition: ServiceDefinition<T>): void {
    this.register(name, definition, ServiceLifetime.TRANSIENT);
  }

  // Resolve a service
  resolve<T>(name: string): T {
    const registration = this.services.get(name);

    if (!registration) {
      throw new Error(`Service "${name}" not registered`);
    }

    // Return existing singleton
    if (registration.lifetime === ServiceLifetime.SINGLETON && registration.instance) {
      return registration.instance as T;
    }

    // Return existing scoped instance
    if (registration.lifetime === ServiceLifetime.SCOPED && this.scopedInstances.has(name)) {
      return this.scopedInstances.get(name) as T;
    }

    // Resolve dependencies
    const dependencies = registration.dependencies?.map(dep => this.resolve(dep)) || [];

    // Create instance
    const instance = this.createInstance(registration.definition, dependencies);

    // Cache if needed
    if (registration.lifetime === ServiceLifetime.SINGLETON) {
      registration.instance = instance;
    } else if (registration.lifetime === ServiceLifetime.SCOPED) {
      this.scopedInstances.set(name, instance);
    }

    return instance as T;
  }

  private createInstance<T>(definition: ServiceDefinition<T>, dependencies: unknown[]): T {
    if (this.isConstructor(definition)) {
      return new definition(...dependencies);
    }
    return definition(...dependencies);
  }

  private isConstructor(obj: unknown): obj is Constructor {
    return typeof obj === 'function' && obj.prototype?.constructor === obj;
  }
}

// Global container
let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}
```

### 2.3 Actions (State Mutations)

```typescript
// src/state/actions.ts

import type { Note, Theme } from '../types';
import { getStore } from './Store';
import { noteStorage } from '../classes/NoteStorage';

export const actions = {
  // ═══════════════════════════════════════════════════════════
  // NOTE ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  addNote(note: Note): void {
    const store = getStore();
    const state = store.getState();
    
    store.setState({
      notes: [...state.notes, note],
      selectedNote: note,
      newlyAddedNote: note
    });
  },

  updateNote(noteId: string, updates: Partial<Note>): void {
    const store = getStore();
    const state = store.getState();
    
    store.setState({
      notes: state.notes.map(note => 
        note.timestamp === noteId 
          ? { ...note, ...updates }
          : note
      )
    });
  },

  async deleteNote(note: Note): Promise<void> {
    const store = getStore();
    const state = store.getState();
    
    // Optimistic update
    store.setState({
      notes: state.notes.filter(n => n.timestamp !== note.timestamp),
      selectedNote: state.selectedNote?.timestamp === note.timestamp 
        ? null 
        : state.selectedNote
    });

    // Persist
    await noteStorage.deleteNote(note.timestamp);
  },

  setNotes(notes: Note[]): void {
    getStore().setState({ notes });
  },

  sortNotes(): void {
    const store = getStore();
    const state = store.getState();
    
    store.setState({
      notes: [...state.notes].sort((a, b) => 
        a.timestampInSeconds - b.timestampInSeconds
      )
    });
  },

  // ═══════════════════════════════════════════════════════════
  // TEMPLATE ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  setTemplates(templates: string[]): void {
    getStore().setState({ templates });
  },

  addTemplate(template: string): void {
    const store = getStore();
    const state = store.getState();
    
    store.setState({
      templates: [...state.templates, template]
    });
  },

  // ═══════════════════════════════════════════════════════════
  // UI STATE ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  setTheme(theme: Theme): void {
    getStore().setState({ currentTheme: theme });
  },

  setSidebarInitialized(initialized: boolean): void {
    getStore().setState({ sidebarInitialized: initialized });
  },

  setVideoTitle(title: string): void {
    getStore().setState({ videoTitle: title });
  },

  setVideoGroup(group: string | null): void {
    getStore().setState({ currentVideoGroup: group });
  },

  // ═══════════════════════════════════════════════════════════
  // BATCH ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  initializeState(notes: Note[], templates: string[], theme: Theme): void {
    const store = getStore();
    
    store.batchUpdate(() => {
      store.setState({ notes, templates, currentTheme: theme });
    });
  },

  // ═══════════════════════════════════════════════════════════
  // PERSISTENCE ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  async saveNotes(): Promise<void> {
    const state = getStore().getState();
    await noteStorage.saveNotes(state.notes, state.currentVideoGroup);
  },

  async loadState(): Promise<void> {
    const notes = await noteStorage.loadNotes();
    getStore().setState({ notes: notes || [] });
  }
};

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: Auto-save
// ═══════════════════════════════════════════════════════════

export function enableAutoSave(delayMs: number = 500): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const unsubscribe = getStore().subscribe(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      actions.saveNotes().catch(console.error);
    }, delayMs);
  });

  return unsubscribe;
}
```

---

## 3. Creating Components

### 3.1 Component Template

```typescript
// src/components/example/ExampleComponent.ts

import type { Note } from '../../types';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface ExampleComponentCallbacks {
  onAction: (data: string) => void;
  onCancel: () => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function createExampleComponent(
  data: string,
  callbacks: ExampleComponentCallbacks
): HTMLElement {
  // CREATE CONTAINER
  const container = document.createElement('div');
  container.className = 'example-component';
  container.setAttribute('data-testid', 'example-component');

  // APPLY STYLES
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--color-bg)',
    borderRadius: '8px',
  });

  // CREATE CHILD ELEMENTS
  const title = document.createElement('h3');
  title.textContent = data;
  title.className = 'example-title';

  const actionButton = document.createElement('button');
  actionButton.textContent = 'Action';
  actionButton.className = 'btn btn-primary';

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'btn btn-secondary';

  // ATTACH EVENT LISTENERS (delegate to callbacks)
  actionButton.addEventListener('click', () => {
    callbacks.onAction(data);
  });

  cancelButton.addEventListener('click', () => {
    callbacks.onCancel();
  });

  // COMPOSE
  container.appendChild(title);
  container.appendChild(actionButton);
  container.appendChild(cancelButton);

  return container;
}

// ═══════════════════════════════════════════════════════════
// UPDATE FUNCTION (for reactive updates)
// ═══════════════════════════════════════════════════════════

export function updateExampleComponent(
  container: HTMLElement,
  newData: string
): void {
  const title = container.querySelector('.example-title');
  if (title) {
    title.textContent = newData;
  }
}
```

### 3.2 Note Card Component (Real Example)

```typescript
// src/components/notes/NoteCard.ts

import type { Note } from '../../types';
import { formatTimestamp } from '../../utils/time';
import { languageService } from '../../services/LanguageService';

interface NoteCardCallbacks {
  onTimestampClick: (seconds: number) => void;
  onEdit: (note: Note, newText: string) => void;
  onDelete: (note: Note) => void;
}

export function createNoteCard(
  note: Note,
  callbacks: NoteCardCallbacks
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.setAttribute('data-note-id', note.timestamp);
  card.setAttribute('data-testid', 'note-card');

  Object.assign(card.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--color-card-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    transition: 'box-shadow 0.2s ease',
  });

  // Timestamp button
  const timestampBtn = document.createElement('button');
  timestampBtn.className = 'note-timestamp';
  timestampBtn.textContent = note.timestamp;
  timestampBtn.title = languageService.getString('jumpToTimestamp');
  
  Object.assign(timestampBtn.style, {
    alignSelf: 'flex-start',
    padding: '4px 8px',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  });

  timestampBtn.addEventListener('click', () => {
    callbacks.onTimestampClick(note.timestampInSeconds);
  });

  // Note content
  const content = document.createElement('div');
  content.className = 'note-content';
  content.textContent = note.text;
  
  Object.assign(content.style, {
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'var(--color-text)',
    whiteSpace: 'pre-wrap',
  });

  // Actions row
  const actionsRow = document.createElement('div');
  actionsRow.className = 'note-actions';
  
  Object.assign(actionsRow.style, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  });

  const editBtn = createIconButton('edit', () => {
    const newText = prompt(languageService.getString('editNote'), note.text);
    if (newText !== null && newText !== note.text) {
      callbacks.onEdit(note, newText);
    }
  });

  const deleteBtn = createIconButton('delete', () => {
    if (confirm(languageService.getString('confirmDelete'))) {
      callbacks.onDelete(note);
    }
  });

  actionsRow.appendChild(editBtn);
  actionsRow.appendChild(deleteBtn);

  // Compose card
  card.appendChild(timestampBtn);
  card.appendChild(content);
  card.appendChild(actionsRow);

  // Hover effect
  card.addEventListener('mouseenter', () => {
    card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  });

  card.addEventListener('mouseleave', () => {
    card.style.boxShadow = 'none';
  });

  return card;
}

function createIconButton(icon: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = `icon-btn icon-${icon}`;
  btn.innerHTML = `<span class="material-icons">${icon}</span>`;
  
  Object.assign(btn.style, {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: '0.7',
    transition: 'opacity 0.2s',
  });

  btn.addEventListener('click', onClick);
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.7'; });

  return btn;
}
```

---

## 4. Working with State

### 4.1 Subscribing to State Changes

```typescript
// In content.ts or any component

import { getStore } from './src/state/Store';
import { updateSidebarNotes } from './src/components/sidebar/Sidebar';

// Subscribe to all state changes
const unsubscribe = getStore().subscribe((newState) => {
  // Skip update if user is typing
  const activeElement = document.activeElement;
  if (activeElement?.tagName === 'TEXTAREA') {
    return;
  }
  
  // Update UI
  updateSidebarNotes(newState);
});

// Later, cleanup
unsubscribe();
```

### 4.2 Dispatching Actions

```typescript
import { actions } from './src/state/actions';
import type { Note } from './src/types';

// Add a new note
const newNote: Note = {
  timestamp: '1:30',
  timestampInSeconds: 90,
  text: 'Important concept explained here',
  id: crypto.randomUUID(),
};

actions.addNote(newNote);

// Update a note
actions.updateNote(newNote.timestamp, { 
  text: 'Updated note content' 
});

// Delete a note
await actions.deleteNote(newNote);

// Batch multiple updates
const store = getStore();
store.batchUpdate(() => {
  actions.setNotes(loadedNotes);
  actions.setTemplates(loadedTemplates);
  actions.setTheme('dark');
});
```

### 4.3 Using Undo/Redo

```typescript
import { getStore } from './src/state/Store';

const store = getStore();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      store.redo();
    } else {
      store.undo();
    }
  }
});

// UI buttons
undoButton.disabled = !store.canUndo();
redoButton.disabled = !store.canRedo();

undoButton.addEventListener('click', () => store.undo());
redoButton.addEventListener('click', () => store.redo());
```

---

## 5. Using Services

### 5.1 Theme Service

```typescript
import { themeService } from './src/services/ThemeService';

// Apply a theme
themeService.applyTheme('dark');

// Toggle theme
themeService.toggleTheme();

// Get current theme
const currentTheme = themeService.getCurrentTheme();
```

### 5.2 Language Service

```typescript
import { languageService } from './src/services/LanguageService';

// Initialize (async)
await languageService.init();

// Get localized string
const label = languageService.getString('addNote');

// Get text direction
const direction = languageService.getCurrentDirection(); // 'ltr' or 'rtl'

// Listen to direction changes
languageService.addDirectionListener((dir) => {
  container.setAttribute('dir', dir);
});
```

### 5.3 Encryption Service

```typescript
import { encryptionService } from './src/services/EncryptionService';

// Encrypt data
const encrypted = await encryptionService.encrypt(
  JSON.stringify(notesData), 
  userPassword
);

// Decrypt data
const decrypted = await encryptionService.decrypt(encrypted, userPassword);
const notesData = JSON.parse(decrypted);

// Check if data is encrypted
if (encryptionService.isEncrypted(data)) {
  // Prompt for password
}

// Hash password for storage
const hash = await encryptionService.hashPassword(password);

// Verify password
const isValid = await encryptionService.verifyPassword(password, hash);
```

### 5.4 Using DI Container

```typescript
import { getContainer, registerServices } from './src/services/di/services';

// Initialize services (call once at startup)
registerServices();

// Resolve services
const container = getContainer();
const store = container.resolve<Store>('Store');
const noteStorage = container.resolve<NoteStorage>('NoteStorage');

// Using type-safe getters
import { getStoreService, getStorageService } from './src/services/di/services';

const store = getStoreService();
const storage = getStorageService();
```

---

## 6. Testing Guide

### 6.1 Unit Test Example

```typescript
// tests/state/Store.test.ts

import { Store } from '../../src/state/Store';
import type { AppState, Note } from '../../src/types';

const createInitialState = (): AppState => ({
  notes: [],
  templates: [],
  currentTheme: 'dark',
  selectedNote: null,
  newlyAddedNote: null,
  sidebarInitialized: false,
  isInitialized: false,
  isSaving: false,
  lastSavedContent: '',
  videoTitle: '',
  autoAddTranscript: false,
  currentVideoGroup: null,
});

const mockNote: Note = {
  timestamp: '1:30',
  timestampInSeconds: 90,
  text: 'Test note',
};

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(createInitialState());
  });

  describe('getState', () => {
    it('should return immutable state', () => {
      const state1 = store.getState();
      const state2 = store.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('setState', () => {
    it('should update state with partial object', () => {
      store.setState({ notes: [mockNote] });
      expect(store.getState().notes).toHaveLength(1);
    });

    it('should update state with function', () => {
      store.setState((state) => ({ notes: [...state.notes, mockNote] }));
      expect(store.getState().notes).toHaveLength(1);
    });

    it('should not update if state has not changed', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.setState({ notes: [] });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.setState({ notes: [mockNote] });
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        notes: [mockNote]
      }));
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);
      
      unsubscribe();
      store.setState({ notes: [mockNote] });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('undo/redo', () => {
    it('should undo last change', () => {
      store.setState({ notes: [mockNote] });
      expect(store.getState().notes).toHaveLength(1);
      
      store.undo();
      expect(store.getState().notes).toHaveLength(0);
    });

    it('should redo undone change', () => {
      store.setState({ notes: [mockNote] });
      store.undo();
      store.redo();
      
      expect(store.getState().notes).toHaveLength(1);
    });

    it('should return false when cannot undo', () => {
      expect(store.undo()).toBe(false);
    });

    it('should return false when cannot redo', () => {
      expect(store.redo()).toBe(false);
    });
  });

  describe('batchUpdate', () => {
    it('should only notify once for multiple updates', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.batchUpdate(() => {
        store.setState({ notes: [mockNote] });
        store.setState({ currentTheme: 'light' });
        store.setState({ videoTitle: 'Test Video' });
      });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 6.2 Service Test Example

```typescript
// tests/services/EncryptionService.test.ts

import { encryptionService } from '../../src/services/EncryptionService';

describe('EncryptionService', () => {
  const testData = 'Hello, World!';
  const testPassword = 'SecurePassword123!';

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      const decrypted = await encryptionService.decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(testData);
    });

    it('should produce different output for same input', async () => {
      const encrypted1 = await encryptionService.encrypt(testData, testPassword);
      const encrypted2 = await encryptionService.encrypt(testData, testPassword);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail with wrong password', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      
      await expect(
        encryptionService.decrypt(encrypted, 'wrong-password')
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted data', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(encryptionService.isEncrypted('plain text')).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should produce consistent hash', async () => {
      const hash1 = await encryptionService.hashPassword(testPassword);
      const hash2 = await encryptionService.hashPassword(testPassword);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await encryptionService.hashPassword(testPassword);
      const isValid = await encryptionService.verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await encryptionService.hashPassword(testPassword);
      const isValid = await encryptionService.verifyPassword('wrong', hash);
      
      expect(isValid).toBe(false);
    });
  });
});
```

### 6.3 E2E Test Example

```typescript
// tests/e2e/sidebar.spec.ts

import { test, expect } from '@playwright/test';

test.describe('VidScholar Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Wait for sidebar to appear
    await page.waitForSelector('#vidscholar-root', { timeout: 10000 });
  });

  test('should display sidebar', async ({ page }) => {
    const sidebar = page.locator('#vidscholar-root');
    await expect(sidebar).toBeVisible();
  });

  test('should add a note', async ({ page }) => {
    // Click add note button
    await page.click('[data-testid="add-note-btn"]');
    
    // Type note content
    await page.fill('[data-testid="note-textarea"]', 'My test note');
    
    // Verify note appears
    const noteCard = page.locator('[data-testid="note-card"]');
    await expect(noteCard).toBeVisible();
    await expect(noteCard).toContainText('My test note');
  });

  test('should jump to timestamp on click', async ({ page }) => {
    // Add a note first
    await page.click('[data-testid="add-note-btn"]');
    await page.fill('[data-testid="note-textarea"]', 'Test note');
    
    // Click timestamp
    await page.click('.note-timestamp');
    
    // Verify video seeks (check video currentTime)
    const videoTime = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.currentTime ?? -1;
    });
    
    expect(videoTime).toBeGreaterThanOrEqual(0);
  });

  test('should toggle theme', async ({ page }) => {
    // Click theme toggle
    await page.click('[data-testid="theme-toggle"]');
    
    // Verify theme changed
    const sidebar = page.locator('#vidscholar-root');
    const bgColor = await sidebar.evaluate(el => 
      getComputedStyle(el).getPropertyValue('--color-bg')
    );
    
    expect(bgColor).toBeTruthy();
  });
});
```

---

## 7. Common Patterns

### 7.1 Video Timestamp Utilities

```typescript
// src/utils/time.ts

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }
  return `${minutes}:${padZero(secs)}`;
}

export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

export function getCurrentVideoTime(): number {
  const video = document.querySelector('video');
  return video?.currentTime ?? 0;
}

export function seekToTime(seconds: number): void {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.focus();
  }
}

function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}
```

### 7.2 Toast Notifications

```typescript
// src/utils/toast.ts

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function showToast(
  message: string, 
  type: ToastType = 'info',
  duration: number = 3000
): void {
  // Remove existing toast
  const existing = document.querySelector('.vidscholar-toast');
  existing?.remove();

  const toast = document.createElement('div');
  toast.className = `vidscholar-toast toast-${type}`;
  toast.textContent = message;

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    zIndex: '999999',
    animation: 'slideIn 0.3s ease',
    backgroundColor: getToastColor(type),
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getToastColor(type: ToastType): string {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
  return colors[type];
}
```

### 7.3 Debounce Utility

```typescript
// src/utils/debounce.ts

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Usage example
const debouncedSave = debounce(async () => {
  await actions.saveNotes();
}, 500);

textarea.addEventListener('input', debouncedSave);
```

### 7.4 Storage Abstraction

```typescript
// src/utils/storage.ts

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    });
  },

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getAll(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
  },
};
```

---

## Summary

This implementation guide covers:

1. **Core Store** - Redux-like immutable state management with undo/redo
2. **DI Container** - Dependency injection for testability
3. **Actions** - Type-safe state mutations with auto-save
4. **Components** - Pure UI components with callback patterns
5. **Services** - Theme, Language, Encryption, and more
6. **Testing** - Unit tests with Jest, E2E with Playwright
7. **Utilities** - Common patterns for timestamps, toasts, and storage

Follow these patterns to maintain consistency and code quality across the codebase.

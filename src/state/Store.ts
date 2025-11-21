// src/state/Store.ts
import type { AppState, Note } from '../types';

type Listener = (state: AppState) => void;
type StateUpdater = (state: AppState) => Partial<AppState> | void;

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

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<AppState> {
    return this.deepClone(this.state);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update state immutably
   */
  setState(updater: StateUpdater | Partial<AppState>): void {
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

  /**
   * Batch multiple updates
   */
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

  /**
   * Undo last change
   */
  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = this.deepClone(this.history[this.historyIndex]);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Redo last undone change
   */
  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = this.deepClone(this.history[this.historyIndex]);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [this.deepClone(this.state)];
    this.historyIndex = 0;
  }

  /**
   * Reset to initial state
   */
  reset(initialState: AppState): void {
    this.state = this.deepClone(initialState);
    this.clearHistory();
    this.notifyListeners();
  }

  private saveToHistory(): void {
    // Remove any redo history when making new changes
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(this.deepClone(this.state));

    // Limit history size
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

// Singleton instance
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
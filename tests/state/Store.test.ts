// tests/state/Store.test.ts
import { Store } from '../../src/state/Store';
import type { AppState, Note } from '../../src/types';

describe('Store', () => {
  let store: Store;
  let initialState: AppState;

  beforeEach(() => {
    initialState = {
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
    store = new Store(initialState);
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = store.getState();
      expect(state).toEqual(initialState);
    });

    it('should return immutable state', () => {
      const state = store.getState();
      (state as any).notes.push({ text: 'test' });
      expect(store.getState().notes).toHaveLength(0);
    });
  });

  describe('setState', () => {
    it('should update state with partial updates', () => {
      store.setState({ videoTitle: 'Test Video' });
      expect(store.getState().videoTitle).toBe('Test Video');
    });

    it('should accept updater function', () => {
      store.setState((state) => ({
        notes: [...state.notes, createTestNote()]
      }));
      expect(store.getState().notes).toHaveLength(1);
    });

    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.setState({ videoTitle: 'Test' });
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ videoTitle: 'Test' })
      );
    });

    it('should not notify if state unchanged', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.setState({ videoTitle: '' });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);
      
      store.setState({ videoTitle: 'Test' });
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      store.setState({ videoTitle: 'Test 2' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('undo/redo', () => {
    it('should undo last change', () => {
      store.setState({ videoTitle: 'First' });
      store.setState({ videoTitle: 'Second' });
      
      const undone = store.undo();
      
      expect(undone).toBe(true);
      expect(store.getState().videoTitle).toBe('First');
    });

    it('should redo undone change', () => {
      store.setState({ videoTitle: 'First' });
      store.setState({ videoTitle: 'Second' });
      store.undo();
      
      const redone = store.redo();
      
      expect(redone).toBe(true);
      expect(store.getState().videoTitle).toBe('Second');
    });

    it('should return false when cannot undo', () => {
      expect(store.undo()).toBe(false);
    });

    it('should return false when cannot redo', () => {
      expect(store.redo()).toBe(false);
    });

    it('should clear redo history on new change', () => {
      store.setState({ videoTitle: 'First' });
      store.setState({ videoTitle: 'Second' });
      store.undo();
      store.setState({ videoTitle: 'Third' });
      
      expect(store.redo()).toBe(false);
    });
  });

  describe('batchUpdate', () => {
    it('should batch multiple updates', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      
      store.batchUpdate(() => {
        store.setState({ videoTitle: 'Test' });
        store.setState({ isSaving: true });
        store.setState({ sidebarInitialized: true });
      });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear undo/redo history', () => {
      store.setState({ videoTitle: 'First' });
      store.setState({ videoTitle: 'Second' });
      
      store.clearHistory();
      
      expect(store.canUndo()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to new initial state', () => {
      store.setState({ videoTitle: 'Test' });
      
      const newInitialState = { ...initialState, videoTitle: 'New' };
      store.reset(newInitialState);
      
      expect(store.getState().videoTitle).toBe('New');
      expect(store.canUndo()).toBe(false);
    });
  });
});

function createTestNote(): Note {
  return {
    timestamp: '00:00',
    timestampInSeconds: 0,
    text: 'Test note'
  };
}
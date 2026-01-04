// src/state/actions.ts
import type { Note } from '../types';
import { getStore } from './Store';
import { noteStorage } from '../classes/NoteStorage';

/**
 * State Actions - Pure functions that update state
 */

export const actions = {
  // Note Actions
  addNote(note: Note): void {
    const store = getStore();
    const state = store.getState();
    const newNotes = [...state.notes, note];

    store.setState({
      notes: newNotes,
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

    // Optimistically update the UI
    store.setState({
      notes: state.notes.filter(n => n.timestamp !== note.timestamp),
      selectedNote: state.selectedNote?.timestamp === note.timestamp
        ? null
        : state.selectedNote
    });

    // Persist the change
    await noteStorage.deleteNote(note.timestamp);
  },

  selectNote(note: Note | null): void {
    getStore().setState({ selectedNote: note });
  },

  sortNotes(): void {
    const store = getStore();
    const state = store.getState();

    store.setState({
      notes: [...state.notes].sort((a, b) =>
        b.timestampInSeconds - a.timestampInSeconds
      )
    });
  },

  setNotes(notes: Note[]): void {
    getStore().setState({ notes });
  },

  // Template Actions
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

  // Theme Actions
  setTheme(theme: 'light' | 'dark'): void {
    getStore().setState({ currentTheme: theme });
  },

  // UI State Actions
  setSidebarInitialized(initialized: boolean): void {
    getStore().setState({ sidebarInitialized: initialized });
  },

  setVideoTitle(title: string): void {
    getStore().setState({ videoTitle: title });
  },

  setVideoGroup(group: string | null): void {
    getStore().setState({ currentVideoGroup: group });
  },

  setSaving(isSaving: boolean): void {
    getStore().setState({ isSaving });
  },

  toggleAutoAddTranscript(): void {
    const store = getStore();
    const state = store.getState();
    store.setState({ autoAddTranscript: !state.autoAddTranscript });
  },

  // Batch Actions
  initializeState(notes: Note[], templates: string[], theme: 'light' | 'dark'): void {
    const store = getStore();

    store.batchUpdate(() => {
      store.setState({ notes, templates, currentTheme: theme });
    });
  },

  // Persistence Actions
  async saveNotes(): Promise<void> {
    const state = getStore().getState();
    await noteStorage.saveNotes(state.notes, state.currentVideoGroup);
  },

  async loadState(): Promise<void> {
    const notes = await noteStorage.loadNotes();
    getStore().setState({ notes: notes || [] });
  }
};

// Middleware for auto-save
export function enableAutoSave(delayMs: number = 500): () => void {
  let timeoutId: any;

  const unsubscribe = getStore().subscribe((state) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      actions.saveNotes().catch(console.error);
    }, delayMs);
  });

  return unsubscribe;
}
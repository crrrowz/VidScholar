// src/services/NoteActionsService.ts
/**
 * NoteActionsService - Centralized note creation and management
 * 
 * This service provides a single source of truth for creating notes.
 * Both the floating button and the addNoteButton should use this service.
 */

import type { Note } from '../types';
import { actions } from '../state/actions';
import { getStore } from '../state/Store';
import { formatTimestamp } from '../utils/time';
import { showToast } from '../utils/toast';
import { languageService } from './LanguageService';
import { scrollToNewNote, focusNoteTextarea } from '../components/notes/NotesList';

const DUPLICATE_THRESHOLD = 10; // seconds - same as in FloatingButton and MainToolbar

export interface CreateNoteOptions {
    timestamp: number;
    text?: string;
    onConflict?: (existingNote: Note) => void;
    scrollToNote?: boolean;
    focusTextarea?: boolean;
}

export interface CreateNoteResult {
    success: boolean;
    note?: Note;
    conflict?: Note;
}

class NoteActionsService {
    private static instance: NoteActionsService;

    private constructor() { }

    static getInstance(): NoteActionsService {
        if (!NoteActionsService.instance) {
            NoteActionsService.instance = new NoteActionsService();
        }
        return NoteActionsService.instance;
    }

    /**
     * Create a new note at the specified timestamp
     * This is the single source of truth for note creation
     */
    async createNote(options: CreateNoteOptions): Promise<CreateNoteResult> {
        const { timestamp, text = '', onConflict, scrollToNote = true, focusTextarea = false } = options;
        const notes = getStore().getState().notes;

        // Check for existing note within threshold
        const conflictingNote = notes.find(note =>
            Math.abs(note.timestampInSeconds - timestamp) < DUPLICATE_THRESHOLD
        );

        if (conflictingNote) {
            // Call conflict handler if provided
            if (onConflict) {
                onConflict(conflictingNote);
            }
            return {
                success: false,
                conflict: conflictingNote
            };
        }

        // Create the new note
        const newNote: Note = {
            id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: formatTimestamp(timestamp),
            timestampInSeconds: timestamp,
            text: text
        };

        // Add note at the beginning of the list (top)
        actions.addNote(newNote);

        // Save to storage
        try {
            await actions.saveNotes();
        } catch (error) {
            console.error('Failed to save note:', error);
            showToast(languageService.translate("failedToAddNote"), 'error');
            return { success: false };
        }

        // Scroll to the new note if requested
        if (scrollToNote) {
            setTimeout(() => scrollToNewNote(newNote.timestamp), 100);
        }

        // Focus on the textarea if requested
        if (focusTextarea) {
            setTimeout(() => focusNoteTextarea(newNote.timestamp), 150);
        }

        return {
            success: true,
            note: newNote
        };
    }

    /**
     * Update an existing note's text
     */
    async updateNoteText(noteTimestamp: string, newText: string): Promise<boolean> {
        try {
            actions.updateNote(noteTimestamp, { text: newText });
            await actions.saveNotes();
            return true;
        } catch (error) {
            console.error('Failed to update note:', error);
            showToast(languageService.translate("failedToSaveChanges"), 'error');
            return false;
        }
    }

    /**
     * Select and scroll to an existing note (for conflict resolution)
     */
    selectExistingNote(note: Note, focusTextarea: boolean = true): void {
        actions.selectNote(note);
        scrollToNewNote(note.timestamp);

        if (focusTextarea) {
            setTimeout(() => focusNoteTextarea(note.timestamp), 150);
        }
    }
}

export const noteActionsService = NoteActionsService.getInstance();
export default noteActionsService;

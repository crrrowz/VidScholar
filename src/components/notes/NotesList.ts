// components/notes/NotesList.ts
import type { AppState, Note } from '../../types';
import { createNoteElement } from './Note';
import { showToast } from '../../utils/toast';
import { isElementInView } from '../../utils/video';
import { languageService } from '../../services/LanguageService';
import { actions } from '../../state/actions';
import { getStore } from '../../state/Store';

interface NotesListCallbacks {
  onAutoSave: () => void;
  onNoteSelect: (note: Note) => void;
}

export function createNotesList(
  callbacks: NotesListCallbacks
): HTMLElement {
  const container = document.createElement("div");
  container.id = "notesContainer";
  
  Object.assign(container.style, {
    flex: '1',
    overflowY: "auto",
    paddingRight: "4px"
  });

  updateNotesList(container, getStore().getState(), callbacks);
  
  return container;
}

export function updateNotesList(
  container: HTMLElement,
  state: AppState,
  callbacks: NotesListCallbacks
): void {
  container.innerHTML = "";

  state.notes.forEach(note => {
    const noteElement = createNoteElement(
      state,
      note,
      state.selectedNote,
      {
        onUpdate: callbacks.onAutoSave,
        onDelete: async (noteToDelete: Note) => {
          try {
            await actions.deleteNote(noteToDelete);
            showToast(languageService.translate("noteDeleted"), 'success');
          } catch (error) {
            console.error('Failed to delete note:', error);
            showToast(languageService.translate("failedToDeleteNote"), 'error');
          }
        },
        onSelect: (selectedNote: Note) => {
          actions.selectNote(selectedNote);
        }
      }
    );

    container.appendChild(noteElement);
  });
}

export function scrollToNewNote(timestamp: string): void {
  const noteElements = document.querySelectorAll(".note");
  for (const element of noteElements) {
    const timestampElement = element.querySelector('[data-timestamp="true"]');
    if (timestampElement && timestampElement.textContent === timestamp) {
      if (!isElementInView(element as HTMLElement, element.parentElement as HTMLElement)) {
        (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      (element as HTMLElement).style.animation = 'none';
      requestAnimationFrame(() => {
        (element as HTMLElement).style.animation = 'highlightNew 1.5s ease-out';
      });
      break;
    }
  }
}
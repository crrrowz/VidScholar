// components/notes/Note.ts
import type { Note, AppState } from '../../types';
import { createButton } from '../ui/Button';
import { createNoteTextArea } from './NoteTextArea';
import { themeService } from '../../services/ThemeService';
import { shareService } from '../../services/ShareService';
import { jumpToTimestamp } from '../../utils/video';
import config from '../../utils/config';
import { languageService } from '../../services/LanguageService';

interface NoteCallbacks {
  onUpdate: (immediate?: boolean) => void;
  onDelete: (note: Note) => void;
  onSelect: (note: Note) => void;
}

function updateNoteElementText(noteElement: HTMLElement): void {
  const shareButton = noteElement.querySelector('.share-button') as HTMLButtonElement;
  if (shareButton) shareButton.setAttribute('title', languageService.translate("shareOnX"));

  const timestampButton = noteElement.querySelector('.timestamp-button') as HTMLButtonElement;
  if (timestampButton) timestampButton.setAttribute('title', languageService.translate("jumpToTimestamp"));

  const deleteButton = noteElement.querySelector('.delete-button') as HTMLButtonElement;
  if (deleteButton) deleteButton.setAttribute('title', languageService.translate("deleteNote"));
}

export function createNoteElement(
  state: AppState,
  note: Note,
  selectedNote: Note | null,
  callbacks: NoteCallbacks
): HTMLElement {
  const noteElement = document.createElement("div");
  noteElement.className = "note";
  if (selectedNote === note) {
    noteElement.classList.add('selected');
  }
  
  const leftControls = createLeftControls(note, callbacks.onDelete);
  const textarea = createNoteTextArea(state, note, callbacks.onUpdate);
  
  noteElement.appendChild(leftControls);
  noteElement.appendChild(textarea);
  
  setupNoteSelection(noteElement, note, callbacks.onSelect, selectedNote);
  setupHoverEffect(noteElement, note, selectedNote);
  
  themeService.addListener(() => {
    if (selectedNote === note) {
      noteElement.classList.add('selected');
    } else {
      noteElement.classList.remove('selected');
    }
  });

  languageService.addListener(() => updateNoteElementText(noteElement));
  updateNoteElementText(noteElement);
  
  return noteElement;
}

function createLeftControls(note: Note, onDelete: (note: Note) => void): HTMLElement {
  const leftControls = document.createElement("div");
  leftControls.className = "note-left-controls";

  const topButtons = document.createElement('div');
  topButtons.className = "note-top-buttons";

  const shareButton = createShareButton(note);
  const deleteButton = createDeleteButton(note, onDelete);
  topButtons.appendChild(shareButton);
  topButtons.appendChild(deleteButton);

  const timestampButton = createTimestamp(note);

  leftControls.appendChild(topButtons);
  leftControls.appendChild(timestampButton);

  return leftControls;
}

function createTimestamp(note: Note): HTMLElement {
  const timestampButton = createButton(
    null,
    note.timestamp,
    () => jumpToTimestamp(note.timestamp),
    null,
    'default'
  );
  timestampButton.classList.add('btn--timestamp');
  timestampButton.title = languageService.translate("jumpToTimestamp");

  return timestampButton;
}

function createShareButton(note: Note): HTMLElement {
  const icons = config.getIcons();
  const button = createButton(
    icons.COPY,
    null,
    async (e: MouseEvent) => {
      e.stopPropagation();
      await shareService.shareNote(note);
    },
    null,
    'default'
  );
  button.classList.add('share-button', 'btn--icon');
  button.title = languageService.translate("shareOnX");
  return button;
}

function createDeleteButton(note: Note, onDelete: (note: Note) => void): HTMLElement {
  const icons = config.getIcons();
  const button = createButton(
    icons.DELETE,
    null,
    () => onDelete(note),
    null,
    'default'
  );
  button.classList.add('delete-button', 'btn--icon');
  button.title = languageService.translate("deleteNote");
  return button;
}

function setupNoteSelection(
  noteElement: HTMLElement,
  note: Note,
  onSelect: (note: Note) => void,
  selectedNote: Note | null
): void {
  noteElement.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest('button') && 
        !(e.target as HTMLElement).closest('.btn--timestamp')) {
      onSelect(note);
      
      const allNotes = document.querySelectorAll(".note");
      allNotes.forEach((n: Element) => {
        n.classList.remove('selected');
      });
      noteElement.classList.add('selected');
    }
  });
}

function setupHoverEffect(
  noteElement: HTMLElement,
  note: Note,
  selectedNote: Note | null
): void {
  noteElement.addEventListener("mouseenter", () => {
    if (selectedNote !== note) {
      noteElement.classList.add('note-hover-effect');
    }
  });
  
  noteElement.addEventListener("mouseleave", () => {
    if (selectedNote !== note) {
      noteElement.classList.remove('note-hover-effect');
    }
  });
}


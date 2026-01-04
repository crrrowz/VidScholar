// components/notes/NoteTextArea.ts
import type { Note, AppState } from '../../types';
import { themeService } from '../../services/ThemeService';
import config from '../../utils/config';
import { setActiveInput } from '../../utils/activeInputTracker'; // Import the tracker
import { actions } from '../../state/actions';

export function createNoteTextArea(state: AppState, note: Note, onUpdate: (immediate?: boolean) => void): HTMLElement {
  const parentDiv = document.createElement("div");
  Object.assign(parentDiv.style, {
    display: "flex",
    flex: "1",
    position: "relative",
  });

  const textarea = document.createElement("textarea");
  textarea.value = note.text;
  // Add unique ID for easy focus finding
  textarea.id = `note-textarea-${note.timestamp.replace(/:/g, '-')}`;

  // FIXED & UNIFIED Height Style
  Object.assign(textarea.style, {
    width: "100%",
    height: "130px", // Unified fixed height
    overflowY: "auto", // Always scrollable if content overflows
    marginLeft: "8px",
    marginRight: "8px",
    padding: "8px 10px",
    lineHeight: "22px",
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: `1px solid var(--color-border)`,
    borderRadius: "8px",
    resize: "none",
    fontSize: "14px",
    fontFamily: "inherit",
    boxSizing: 'border-box'
  });

  textarea.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  textarea.addEventListener("focus", () => {
    setActiveInput(textarea);
    state.selectedNote = note;
  });

  textarea.addEventListener("blur", () => {
    onUpdate(true);

    setTimeout(() => {
      const focusedElement = document.activeElement;
      // ... existing active input check logic can remain or simplified
      // simplified for brevity as the original tracking logic was mainly for shortcuts
      setActiveInput(null);
    }, 50);
  });

  let debounceTimer: any;
  textarea.addEventListener("input", () => {
    note.text = textarea.value;
    actions.updateNote(note.timestamp, { text: textarea.value });

    // No adjustHeight() call here anymore

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      onUpdate();
    }, 500);
  });

  themeService.addListener(() => {
    textarea.style.backgroundColor = 'var(--color-surface)';
    textarea.style.color = 'var(--color-text-primary)';
    textarea.style.border = `1px solid var(--color-border)`;
  });

  parentDiv.appendChild(textarea);

  if (note.text === '') {
    textarea.focus();
    setActiveInput(textarea);
  }

  return parentDiv;
}
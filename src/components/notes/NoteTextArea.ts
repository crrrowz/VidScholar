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
  
  const uiConfig = config.getUIConfig();
  
  Object.assign(textarea.style, {
    width: "100%",
    minHeight: uiConfig.noteMinHeight,
    maxHeight: uiConfig.noteMaxHeight,
    overflow: "hidden",
    marginLeft: "8px",
    marginRight: "8px",
    padding: "6px 10px",
    lineHeight: "22px",
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: `1px solid var(--color-border)`,
    borderRadius: "8px",
    resize: "none",
    fontSize: "14px",
    fontFamily: "inherit"
  });

  const adjustHeight = () => {
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const baseHeight = 40;
  
    textarea.style.height = Math.max(scrollHeight, baseHeight) + "px";
  };


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
        const sidebar = document.getElementById('memoSidebar');
        const videoManager = document.getElementById('videoManager');
        const importDecisionManager = document.getElementById('importDecisionManager');

        if (focusedElement && (
              (sidebar && sidebar.contains(focusedElement)) ||
              (videoManager && videoManager.contains(focusedElement)) ||
              (importDecisionManager && importDecisionManager.contains(focusedElement))
           )) {
        } else {
          setActiveInput(null);
        }
      }, 50);
    });
  let debounceTimer: any;
  textarea.addEventListener("input", () => {
    note.text = textarea.value;
    actions.updateNote(note.timestamp, { text: textarea.value });
    adjustHeight();

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
  setTimeout(adjustHeight, 0);
  
  if (note.text === '') { // Assuming new notes have empty text initially
    textarea.focus();
    setActiveInput(textarea); // Explicitly set active input on autofocus
  }
  
  return parentDiv;
}
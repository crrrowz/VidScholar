// components/sidebar/Sidebar.ts
import type { AppState } from '../../types';
import { getStore } from '../../state/Store';
import { createMainToolbar } from '../toolbar/MainToolbar';
import { createSubToolbar } from '../toolbar/SubToolbar';
import { createNotesList, updateNotesList } from '../notes/NotesList';
import { themeService } from '../../services/ThemeService';
import config from '../../utils/config';
import { languageService } from '../../services/LanguageService';
import { actions } from '../../state/actions';

export async function createSidebar(): Promise<HTMLElement> {
  const existingSidebar = document.getElementById("memoSidebar");
  if (existingSidebar) {
    existingSidebar.remove();
  }

  const container = document.createElement("div");
  container.id = "vidscholar-root";
  container.classList.add("vidscholar-app");

  const uiConfig = config.getUIConfig();

  Object.assign(container.style, {
    width: uiConfig.sidebarWidth,
    marginBottom: "20px",
    padding: "0",
    border: `1px solid var(--color-border, #333)`, /* Added fallback */
    borderRadius: "12px",
    fontSize: "14px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    position: "relative",
    backgroundColor: `var(--color-bg, #1f1f1f)`, /* Added fallback */
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    alignSelf: "flex-start",
    maxHeight: uiConfig.maxSidebarHeight
  });
  container.setAttribute('dir', languageService.getCurrentDirection());

  const updateDirection = () => {
    container.setAttribute('dir', languageService.getCurrentDirection());
  };
  languageService.addDirectionListener(updateDirection);

  const innerContainer = document.createElement("div");
  Object.assign(innerContainer.style, {
    padding: "12px",
    flex: '1',
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
  });

  const mainToolbar = await createMainToolbar();
  const notesList = createNotesList({ onAutoSave: () => actions.saveNotes(), onNoteSelect: (note) => actions.selectNote(note) });
  const subToolbar = await createSubToolbar();

  innerContainer.appendChild(mainToolbar);
  innerContainer.appendChild(notesList);

  container.appendChild(innerContainer);
  container.appendChild(subToolbar);

  container.addEventListener('mouseenter', () => {
    (window as any).isMouseOverSidebar = true;
  });

  container.addEventListener('mouseleave', () => {
    (window as any).isMouseOverSidebar = false;
  });

  return container;
}

export function updateSidebarNotes(state: AppState): void {
  const notesContainer = document.querySelector("#notesContainer") as HTMLElement;
  if (notesContainer) {
    updateNotesList(notesContainer, state, { onAutoSave: () => actions.saveNotes(), onNoteSelect: (note) => actions.selectNote(note) });
  }
}
// components/toolbar/MainToolbar.ts
import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { createButton } from '../ui/Button';
import { themeService } from '../../services/ThemeService';
import { showToast } from '../../utils/toast';
import { formatTimestamp, parseTimestamp } from '../../utils/time';
import { getVideoPlayer, openTranscript } from '../../utils/video';
import { scrollToNewNote } from '../notes/NotesList';
import config from '../../utils/config';
import { languageService } from '../../services/LanguageService';
import { getActiveInput, getLastActiveInput } from '../../utils/activeInputTracker'; // Added getLastActiveInput
import { showConfirmDialog } from '../modals/ConfirmDialog';

export async function createMainToolbar(): Promise<HTMLElement> {
  const state = getStore().getState();
  const container = document.createElement("div");
  container.className = "main-button-container";
  
  Object.assign(container.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    width: "100%"
  });

  const icons = config.getIcons();
  
  const addNoteButton = createButton(
    icons.ADD_NOTE,
    null,
    async () => {
      try {
        const player = getVideoPlayer();
        if (!player) return;

        const state = getStore().getState();
        const currentTime = player.currentTime;
        let selectedTimestampInSeconds = currentTime;
        let selectedTimestampFormatted = formatTimestamp(currentTime);
        let transcriptText = '';

        if (state.autoAddTranscript) {
            await openTranscript(); 
            // Add a small delay to allow the transcript to render
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const transcriptContainer = document.querySelector('ytd-transcript-renderer');
            if (transcriptContainer && getComputedStyle(transcriptContainer).display !== 'none') {
                const segments = transcriptContainer.querySelectorAll('ytd-transcript-segment-renderer');
                let closestSegment = null;
                let minDiff = Infinity;

                segments.forEach(segment => {
                    const timestampElement = segment.querySelector('.segment-timestamp');
                    const textElement = segment.querySelector('.segment-text');

                    if (timestampElement && textElement) {
                        const segmentTimestampStr = timestampElement.textContent.trim();
                        const segmentTimeInSeconds = parseTimestamp(segmentTimestampStr);

                        const diff = Math.abs(currentTime - segmentTimeInSeconds);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestSegment = {
                                timestampInSeconds: segmentTimeInSeconds,
                                timestamp: segmentTimestampStr,
                                text: textElement.textContent.trim()
                            };
                        }
                    }
                });

                if (closestSegment) {
                    selectedTimestampInSeconds = closestSegment.timestampInSeconds;
                    selectedTimestampFormatted = closestSegment.timestamp;
                    transcriptText = closestSegment.text;
                }
            }
        }

        const newNote = {
            timestamp: selectedTimestampFormatted,
            timestampInSeconds: selectedTimestampInSeconds,
            text: transcriptText
        };

        const notes = getStore().getState().notes;
        const tenSeconds = 10;
        const conflictingNote = notes.find(note => 
          Math.abs(note.timestampInSeconds - newNote.timestampInSeconds) < tenSeconds
        );

        if (conflictingNote) {
          showConfirmDialog({ title: languageService.translate("warningTitle"), message: languageService.translate("noteTooClose"), hideCancelButton: true, confirmText: languageService.translate("okButton") });
          return;
        }
        
        actions.addNote(newNote);
        actions.sortNotes();
        
        setTimeout(() => scrollToNewNote(newNote.timestamp), 100);
      } catch (error) {
        console.error('Failed to add note:', error);
        showToast(languageService.translate("failedToAddNote"), 'error');
      }
    },
    'addNoteButton',
    'success'
  );
  addNoteButton.title = languageService.translate("addNote");

  const templateSelect = document.createElement("select");
  templateSelect.id = 'templateSelect';
  
  Object.assign(templateSelect.style, {
      flex: "1",
      width: "0", 
      minWidth: "0",
      padding: "8px",
      borderRadius: "8px",
      textOverflow: "ellipsis"
  });
  
  templateSelect.style.border = `1px solid var(--color-border)`;
  templateSelect.style.backgroundColor = `var(--color-surface)`;
  templateSelect.style.color = `var(--color-text-primary)`;

  const insertTemplateButton = createButton(
    icons.INSERT_TEMPLATE,
    null,
    () => {
      if (templateSelect.value) {
        insertTemplate(templateSelect.value);
      }
    },
    'insertTemplateButton',
    'primary'
  );
  insertTemplateButton.title = languageService.translate("insertTemplate");
  
  const currentPreset = await noteStorage.getCurrentPreset();
  await initializeTemplates();
  updateTemplateSelect(templateSelect, state.templates, currentPreset);
  insertTemplateButton.disabled = !templateSelect.value || templateSelect.value === "0";

  noteStorage.addPresetListener(async (preset) => {
    const newTemplates = await noteStorage.loadPresetTemplates(preset);
    actions.setTemplates(newTemplates);
    updateTemplateSelect(templateSelect, newTemplates, preset);
    insertTemplateButton.disabled = !templateSelect.value || templateSelect.value === "0";
  });

  noteStorage.addTemplateListener(async () => {
    const currentPreset = await noteStorage.getCurrentPreset();
    const newTemplates = await noteStorage.loadPresetTemplates(currentPreset);
actions.setTemplates(newTemplates);
    updateTemplateSelect(templateSelect, newTemplates, currentPreset);
    insertTemplateButton.disabled = !templateSelect.value || templateSelect.value === "0";
  });

  templateSelect.onchange = () => {
    insertTemplateButton.disabled = !templateSelect.value || templateSelect.value === "0";
  };
  
  container.appendChild(addNoteButton);
  container.appendChild(templateSelect);
  container.appendChild(insertTemplateButton);

  languageService.addListener(async () => {
    addNoteButton.title = languageService.translate("addNote");
    insertTemplateButton.title = languageService.translate("insertTemplate");
    const currentPreset = await noteStorage.getCurrentPreset();
    updateTemplateSelect(templateSelect, getStore().getState().templates, currentPreset);
  });

  return container;
}

async function initializeTemplates(): Promise<void> {
  try {
    const currentPreset = await noteStorage.getCurrentPreset();
    const loadedTemplates = await noteStorage.loadPresetTemplates(currentPreset);
    actions.setTemplates(loadedTemplates);
  } catch (error) {
    console.error('Failed to initialize templates:', error);
    actions.setTemplates(noteStorage.getDefaultTemplates(1));
  }
}

export async function updateTemplateSelect(
  select: HTMLSelectElement, 
  templates: string[], 
  presetNumber: number = 1
): Promise<void> {
  if (!select) return;
  
  select.innerHTML = "";

  const placeholderLabel = (await noteStorage.loadPresetName(presetNumber)) || noteStorage.getPresetDefaultName(presetNumber);

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "0";
  placeholderOption.text = placeholderLabel;
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  placeholderOption.hidden = true;
  
  placeholderOption.style.color = 'var(--color-text-muted)'; 
  placeholderOption.style.fontWeight = "bold";

  select.add(placeholderOption);

  templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template;
    option.text = template;
    select.add(option);
  });
}

function insertTemplate(template: string): void {
  const currentActiveInput = getActiveInput();
  let targetInput = currentActiveInput;

  if (!template) {
    return;
  }

  if (!targetInput) {
    targetInput = getLastActiveInput();
  }

  if (targetInput) {
    targetInput.value += template;
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    actions.saveNotes();
  } else {
    showToast(languageService.translate("focusNoteInputWarning"), 'warning');
  }
}
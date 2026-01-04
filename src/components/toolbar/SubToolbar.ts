// components/toolbar/SubToolbar.ts
import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { createButton } from '../ui/Button';
import { createPresetButtons } from './PresetButtons';
import { themeService } from '../../services/ThemeService';
import { shareService } from '../../services/ShareService';
import { showTemplateEditor } from '../modals/TemplateEditor';
import { showVideoManager } from '../modals/VideoManager';
import config from '../../utils/config';
import { languageService } from '../../services/LanguageService';
import { settingsService } from '../../services/SettingsService';
import { showConfirmDialog } from '../modals/ConfirmDialog';
import { isTranscriptAvailable, openTranscript } from '../../utils/video';

export async function createSubToolbar(): Promise<HTMLElement> {
  const container = document.createElement("div");
  container.className = "sub-toolbar-container";

  const icons = config.getIcons();

  const leftGroupContainer = document.createElement("div");
  leftGroupContainer.className = "sub-toolbar-left-group-container sub-toolbar-flex-fill";

  const rightButtonGroup = document.createElement("div");
  rightButtonGroup.className = "sub-toolbar-button-group right sub-toolbar-flex-fill";

  const presetGroup = await createPresetButtons();

  // Group Select (created first for top placement)
  const groupSelect = document.createElement("select");
  groupSelect.id = 'groupSelect';
  groupSelect.classList.add('sub-toolbar-group-select');

  const updateGroupSelect = () => {
    const currentGroups = settingsService.get('videoGroups');
    const currentVideoGroup = getStore().getState().currentVideoGroup;

    groupSelect.innerHTML = '';

    // Create a default/placeholder option that is not selectable
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.text = languageService.translate("noGroup", "None");
    groupSelect.add(placeholderOption);

    currentGroups.forEach(group => {
      const option = document.createElement("option");
      option.value = group;
      option.text = group;
      groupSelect.add(option);
    });

    // Set the selected value
    if (currentVideoGroup && currentGroups.includes(currentVideoGroup)) {
      groupSelect.value = currentVideoGroup;
    } else {
      groupSelect.value = ""; // Select the placeholder value
    }
  };

  updateGroupSelect();

  groupSelect.onchange = async () => {
    const selectedGroup = groupSelect.value;
    actions.setVideoGroup(selectedGroup || null);
    // Save immediately to ensure sync with VideoManager
    await actions.saveNotes();
  };

  settingsService.subscribe(updateGroupSelect);
  getStore().subscribe(updateGroupSelect); // To update when video group changes


  // Container for all other buttons (bottom part)
  const bottomButtonsContainer = document.createElement("div");
  bottomButtonsContainer.className = "sub-toolbar-bottom-buttons";
  bottomButtonsContainer.classList.add('sub-toolbar-bottom-buttons-group');

  const editTemplateButton = createButton(
    icons.EDIT,
    null,
    () => showTemplateEditor(),
    'editTemplatesButton',
    'default'
  );
  editTemplateButton.title = languageService.translate("editTemplates");

  const copyAllButton = createButton(
    icons.COPY,
    null,
    () => shareService.copyAllNotes(getStore().getState().notes),
    'copyAllNotesButton',
    'default'
  );
  copyAllButton.title = languageService.translate("copyAllNotes");

  const downloadNotesButton = createButton(
    icons.DOWNLOAD,
    null,
    () => {
      const currentState = getStore().getState();
      shareService.exportNotesAsJson(currentState.notes, currentState.videoTitle || 'notes', 'video_notes');
    },
    'downloadNotesButton',
    'default'
  );
  downloadNotesButton.title = languageService.translate("downloadNotesJson");

  const uploadNotesButton = createButton(
    icons.UPLOAD,
    null,
    async () => {
      await shareService.importNotesFromJson(false);
    },
    'uploadNotesButton',
    'default'
  );
  uploadNotesButton.title = languageService.translate("uploadNotesJson");

  const manageVideosButton = createButton(
    icons.MANAGE,
    null,
    () => showVideoManager(),
    'manageSavedVideosButton',
    'default'
  );
  manageVideosButton.title = languageService.translate("manageSavedVideos");

  const toggleThemeButton = createButton(
    themeService.getCurrentTheme() === 'light' ? 'light_mode' : 'dark_mode',
    null,
    () => themeService.toggleTheme(),
    'toggleThemeButton',
    'default'
  );
  toggleThemeButton.title = languageService.translate("switchTheme");

  const toggleLanguageButton = createButton(
    null,
    null,
    async () => {
      const newLocale = languageService.currentLocale === 'en' ? 'ar' : 'en';
      await languageService.setPreferredLocale(newLocale);
    },
    'toggleLanguageButton',
    'default'
  );
  const currentLocale = languageService.currentLocale;
  toggleLanguageButton.innerHTML = `<span id="currentLanguageText">${currentLocale.toUpperCase()}</span>`;
  toggleLanguageButton.setAttribute('aria-label', languageService.translate("switchLanguage"));

  const toggleAutoAddTranscriptButton = createButton(
    getStore().getState().autoAddTranscript ? 'closed_caption' : 'closed_caption_off',
    null,
    async () => {
      const transcriptAvailable = await openTranscript();
      if (!transcriptAvailable) {
        console.warn('Transcript not available, button disabled. Action blocked.');
        await showConfirmDialog({
          title: languageService.translate("warningTitle"),
          message: languageService.translate("transcriptNotAvailable"),
          confirmText: languageService.translate("okButton"),
          hideCancelButton: true
        });
        return; // Prevents any action completely
      }

      // Toggle auto mode
      actions.toggleAutoAddTranscript();

      // تحديث أيقونة الزر
      const toggleEl = document.getElementById('toggleAutoAddTranscriptButton');
      if (toggleEl) {
        toggleEl.setAttribute('data-icon', getStore().getState().autoAddTranscript ? 'closed_caption' : 'closed_caption_off');
      }

    },
    'toggleAutoAddTranscriptButton',
    'default'
  );



  const updateAutoAddTranscriptButton = () => {
    const state = getStore().getState();
    const transcriptAvailable = isTranscriptAvailable();

    toggleAutoAddTranscriptButton.title = state.autoAddTranscript ? languageService.translate("disableAutoAddTranscript") : languageService.translate("enableAutoAddTranscript");
    const icon = toggleAutoAddTranscriptButton.querySelector('.material-icons');
    if (icon) {
      icon.textContent = state.autoAddTranscript ? 'closed_caption' : 'closed_caption_off';
    }

    if (!transcriptAvailable) {
      toggleAutoAddTranscriptButton.disabled = true;
      toggleAutoAddTranscriptButton.title = languageService.translate("transcriptNotAvailable");
      toggleAutoAddTranscriptButton.classList.remove('active');
    } else {
      toggleAutoAddTranscriptButton.disabled = false;
      if (state.autoAddTranscript) {
        toggleAutoAddTranscriptButton.classList.add('active');
        document.body.classList.add('vidscholar-hide-transcript');
      } else {
        toggleAutoAddTranscriptButton.classList.remove('active');
      }
    }
  };

  getStore().subscribe(updateAutoAddTranscriptButton);
  updateAutoAddTranscriptButton();

  bottomButtonsContainer.appendChild(editTemplateButton);
  bottomButtonsContainer.appendChild(copyAllButton);
  bottomButtonsContainer.appendChild(downloadNotesButton);
  bottomButtonsContainer.appendChild(uploadNotesButton);
  bottomButtonsContainer.appendChild(manageVideosButton);
  bottomButtonsContainer.appendChild(toggleThemeButton);
  bottomButtonsContainer.appendChild(toggleLanguageButton);
  bottomButtonsContainer.appendChild(toggleAutoAddTranscriptButton);

  leftGroupContainer.appendChild(groupSelect); // Group select at top
  leftGroupContainer.appendChild(bottomButtonsContainer); // All other buttons at bottom

  rightButtonGroup.appendChild(presetGroup);

  container.appendChild(leftGroupContainer);
  container.appendChild(rightButtonGroup);

  const updateTexts = () => {
    copyAllButton.title = languageService.translate("copyAllNotes");
    downloadNotesButton.title = languageService.translate("downloadNotesJson");
    uploadNotesButton.title = languageService.translate("uploadNotesJson");
    editTemplateButton.title = languageService.translate("editTemplates");
    manageVideosButton.title = languageService.translate("manageSavedVideos");

    const langBtn = container.querySelector('#toggleLanguageButton');
    if (langBtn) {
      langBtn.setAttribute('aria-label', languageService.translate("switchLanguage"));
      const span = langBtn.querySelector('#currentLanguageText');
      if (span) span.textContent = languageService.currentLocale.toUpperCase();
    }

    const themeBtn = container.querySelector('#toggleThemeButton');
    if (themeBtn) {
      const isLight = themeService.getCurrentTheme() === 'light';
      themeBtn.title = languageService.translate("switchTheme");
      const icon = themeBtn.querySelector('.material-icons');
      if (icon) icon.textContent = isLight ? 'light_mode' : 'dark_mode';
    }
    updateGroupSelect(); // Update group select dropdown for translation
  };
  languageService.addListener(updateTexts);
  themeService.addListener(updateTexts);
  updateTexts();

  return container;
}
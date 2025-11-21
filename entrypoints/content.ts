// entrypoints/content.ts
import './content/design-tokens.css';
import './content/components.css';
import type { AppState } from '../src/types';
import { noteStorage } from '../src/classes/NoteStorage';
import { NoteError, showUserFriendlyError } from '../src/classes/NoteError';
import { themeService } from '../src/services/ThemeService';
import { waitForYouTubeUI, getVideoTitle } from '../src/utils/video';
import { addMaterialIconsSupport } from '../src/utils/icons';
import { createFloatingButton } from '../src/components/video/FloatingButton';
import { createSidebar, updateSidebarNotes } from '../src/components/sidebar/Sidebar';
import config from '../src/utils/config';
import { languageService } from '../src/services/LanguageService';
import { settingsService } from '../src/services/SettingsService';
import { createStore, getStore } from '../src/state/Store';
import { actions, enableAutoSave } from '../src/state/actions';

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  runAt: 'document_idle',
  main() {
    async function init() {
      // Initialize Language Service first
      await languageService.init();
      // Initialize Settings Service
      try {
        await settingsService.initialize();
      } catch (error) {
        console.error('Content script init: Failed to initialize SettingsService:', error);
      }

      // Create the central store
      createStore({
        notes: [],
        templates: [],
        currentTheme: themeService.getCurrentTheme(),
        selectedNote: null,
        newlyAddedNote: null,
        sidebarInitialized: false,
        isInitialized: false,
        isSaving: false,
        lastSavedContent: '',
        videoTitle: '',
        autoAddTranscript: false,
        currentVideoGroup: null
      });

      let navigationTimeout: any;
      let initializationInProgress = false;
      let unsubscribeStore: () => void;

      // Initialize video features
      async function initializeVideoFeatures() {
        const store = getStore();
        const state = store.getState();

        if (state.sidebarInitialized) return;
        if (initializationInProgress) return;

        initializationInProgress = true;

        try {
          // Load initial data and initialize the store
          const notes = await noteStorage.loadNotes() || [];
          const templates = await noteStorage.loadPresetTemplates(await noteStorage.getCurrentPreset());
          actions.initializeState(notes, templates, themeService.getCurrentTheme());

          await createMemoSidebar();
          actions.setVideoTitle(await getVideoTitle());

          // Enable auto-save after initial load
          enableAutoSave(config.getUIConfig().autoSaveDelay);

          // Subscribe to store changes to update the UI
          unsubscribeStore = store.subscribe((newState) => {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'TEXTAREA' && activeElement.closest('#notesContainer')) {
              return; // Don't re-render while typing in a note
            }
            updateSidebarNotes(newState);
          });

        } catch (error) {
          console.error('Initialization failed:', error);
          if (error instanceof NoteError) {
            showUserFriendlyError(error, initializeVideoFeatures);
          } else {
            showUserFriendlyError(new NoteError('Unexpected error occurred', 'general'));
          }
        } finally {
          initializationInProgress = false;
        }
      }

      // Create memo sidebar
      async function createMemoSidebar() {
        const existingSidebar = document.querySelector("#vidscholar-root");
        if (existingSidebar) {
          const notes = await noteStorage.loadNotes() || [];
          actions.setNotes(notes);
          return true;
        }

        try {
          const sideBarContainer = await waitForYouTubeUI();
          if (!sideBarContainer) {
            throw new Error('Sidebar container not found');
          }

          const sidebar = await createSidebar();
          const floatingButton = createFloatingButton();
          const videoPlayerContainer = document.querySelector('.html5-video-player');
          if (videoPlayerContainer) {
            videoPlayerContainer.appendChild(floatingButton);
          }

          if (!sidebar) {
            throw new Error('Failed to create base sidebar');
          }

          sideBarContainer.insertBefore(sidebar, sideBarContainer.firstChild);

          addMaterialIconsSupport();
          actions.setSidebarInitialized(true);

          return true;

        } catch (error) {
          console.error('Failed to create memo sidebar:', error);
          return false;
        }
      }

      // Event listeners
      window.addEventListener("yt-navigate-finish", () => {
        if (unsubscribeStore) unsubscribeStore();
        const existingSidebar = document.querySelector("#vidscholar-root");
        if (existingSidebar) {
          existingSidebar.remove();
        }

        actions.setSidebarInitialized(false);
        actions.setVideoTitle('');
        actions.setVideoGroup(null); // Explicitly reset video group on navigation
        clearTimeout(navigationTimeout);

        const uiConfig = config.getUIConfig();
        navigationTimeout = setTimeout(() => {
          initializeVideoFeatures();
        }, uiConfig.navigationDelay);
      });



      chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.type === 'LOAD_VIDEO_DATA') {
          initializeVideoFeatures();
          return true;
        } else if (message.type === 'NOTES_UPDATED_GLOBALLY') {
          const notes = await noteStorage.loadNotes();
          actions.setNotes(notes);
          return true;
        }
      });

      // Initialize
      themeService.applyTheme(themeService.getCurrentTheme());
      await waitForYouTubeUI();
      await initializeVideoFeatures();
    }

    init();

    window.addEventListener('keydown', (e) => {
      if ((window as any).isMouseOverSidebar) {
        e.stopImmediatePropagation();
      }
    }, true);
  }
});
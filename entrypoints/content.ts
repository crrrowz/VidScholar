// entrypoints/content.ts
import './content/design-tokens.css';
import './content/components.css';
import './content/styles/modal-core.css';
import type { AppState } from '../src/types';
import { noteStorage } from '../src/classes/NoteStorage';
import { NoteError, showUserFriendlyError } from '../src/classes/NoteError';
import { themeService } from '../src/services/ThemeService';
import { waitForYouTubeUI, getVideoTitle, getCurrentVideoId } from '../src/utils/video';
import { addMaterialIconsSupport } from '../src/utils/icons';
import { createFloatingButton } from '../src/components/video/FloatingButton';
import { createSidebar, updateSidebarNotes } from '../src/components/sidebar/Sidebar';
import config from '../src/utils/config';
import { languageService } from '../src/services/LanguageService';
import { settingsService } from '../src/services/SettingsService';
import { createStore, getStore } from '../src/state/Store';
import { actions, enableAutoSave } from '../src/state/actions';
import { setupKeyboardManager } from '../src/utils/keyboardManager';
// Note Notification System
import { noteNotificationService } from '../src/services/NoteNotificationService';

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  runAt: 'document_idle',
  main() {
    async function init() {
      // Initialize Settings Service FIRST to load cloud settings
      try {
        await settingsService.initialize();
      } catch (error) {
        console.error('Content script init: Failed to initialize SettingsService:', error);
      }

      // Initialize Language Service AFTER settings are loaded from cloud
      await languageService.init();

      // Setup keyboard manager to allow YouTube shortcuts when not focused on extension inputs
      setupKeyboardManager();

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

            // Update note notification service with current notes
            noteNotificationService.updateNotes(newState.notes);

            // Start watching if not already active and notes exist
            const vid = getCurrentVideoId();
            if (vid && newState.notes.length > 0 && !noteNotificationService.isActive()) {
              noteNotificationService.startWatching(vid, newState.notes);
              console.log('[VidScholar] Note notifications started dynamically for', newState.notes.length, 'notes');
            }
          });

          // Initialize Note Notification System - start watching
          const videoId = getCurrentVideoId();
          if (videoId) {
            if (notes.length > 0) {
              noteNotificationService.startWatching(videoId, notes);
              console.log('[VidScholar] Note notifications started for', notes.length, 'notes');
            } else {
              console.log('[VidScholar] Note notifications ready (no notes yet)');
            }
          }

          // Robust Polling: Check for cloud updates at intervals (2s, 5s, 10s)
          // Uses forceRefresh=true to bypass local cache
          // Robust Polling: Check for cloud updates at intervals (2s, 5s, 10s)
          // Uses forceRefresh=true to bypass local cache
          const checkCloudUpdates = async (attempt: number) => {
            if (!document.querySelector("#vidscholar-root")) return; // Stop if sidebar closed

            try {
              const state = getStore().getState();

              // Skip refresh if we have unsaved local changes!
              // This acts as a "lock" to prevent race conditions when user is actively adding notes
              const currentNotesJson = JSON.stringify(state.notes);
              if (state.isSaving || currentNotesJson !== state.lastSavedContent) {
                console.log(`Cloud sync skipped (Attempt ${attempt}): Local changes pending.`);
                // Retry later if it's an early attempt
                if (attempt < 3) {
                  setTimeout(() => checkCloudUpdates(attempt + 1), 2000);
                }
                return;
              }

              const refreshedNotes = await noteStorage.loadNotes(true) || [];
              const currentNotes = state.notes;

              if (JSON.stringify(refreshedNotes) !== JSON.stringify(currentNotes)) {
                console.log(`Cloud sync detected (Attempt ${attempt}), updating UI...`);
                actions.setNotes(refreshedNotes);
              } else if (attempt < 3) {
                // Schedule next attempt
                const delays = [2000, 5000, 10000];
                setTimeout(() => checkCloudUpdates(attempt + 1), delays[attempt]);
              }
            } catch (err) {
              // Silent fail on polling errors
            }
          };

          // Start first check after 2 seconds
          setTimeout(() => checkCloudUpdates(1), 2000);

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

          // Only add floating button if it doesn't already exist
          const existingFloatingButton = document.getElementById('floating-add-note-button');
          if (!existingFloatingButton) {
            const floatingButton = createFloatingButton();
            const videoPlayerContainer = document.querySelector('.html5-video-player');
            if (videoPlayerContainer) {
              videoPlayerContainer.appendChild(floatingButton);
            }
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

        // Stop note notifications for previous video
        noteNotificationService.stopWatching();

        actions.setSidebarInitialized(false);
        actions.setVideoTitle('');
        actions.setVideoGroup(null); // Explicitly reset video group on navigation
        actions.setNotes([]); // Clear notes from previous video
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
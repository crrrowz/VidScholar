import { getCurrentVideoId } from '../../utils/video';
import type { Video, Note, StoredVideoData } from '../../types';
import { noteStorage } from '../../classes/NoteStorage';
import { actions } from '../../state/actions';
import { createButton } from '../ui/Button';
import { showToast } from '../../utils/toast';
import config from '../../utils/config';
import { formatTimestamp } from '../../utils/time';
import { languageService } from '../../services/LanguageService';
import { normalizeStringForSearch } from '../../utils/ui';
import { shareService } from '../../services/ShareService';
import { showConfirmDialog } from './ConfirmDialog';
import { showPromptDialog } from './PromptDialog';
import Sortable from 'sortablejs';
import { settingsService } from '../../services/SettingsService';

// Extended interface for filtered search results
interface FilteredVideo extends Video {
  filteredNotes?: Note[];
  isSearchResult?: boolean;
}

function debounce(func: Function, wait: number) {
  let timeout: any;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export async function showVideoManager(): Promise<void> {
  if (document.querySelector("#videoManager")) return;

  const overlay = document.createElement('div');
  overlay.id = "videoManager";
  overlay.className = "video-manager-overlay";

  const closeManager = () => {
    shareService.setCloseVideoManagerCallback(null);
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 200);
  };

  document.querySelector("#vidscholar-root")?.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  try {
    // Force save any pending changes before loading the library
    await actions.saveNotes();

    const [videos, retentionDays] = await Promise.all([
      noteStorage.loadSavedVideos().catch(() => []),
      noteStorage.getRetentionDays().catch(() => 30)
    ]);

    const videoManagerUI = createVideoManagerUI(videos || [], retentionDays, closeManager);
    overlay.appendChild(videoManagerUI);
    document.body.style.overflow = 'hidden';
    shareService.setCloseVideoManagerCallback(closeManager);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeManager();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeManager(); });

  } catch (error) {
    console.error('Manager Error:', error);
    showToast(languageService.translate("couldNotLoadData"), 'error');
    closeManager();
  }
}

function createVideoManagerUI(
  initialVideos: Video[],
  initialRetention: number,
  closeCallback: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'video-manager-ui';
  container.setAttribute('dir', languageService.getCurrentDirection());

  const openGroups = new Set<string>();

  const updateDirection = () => {
    container.setAttribute('dir', languageService.getCurrentDirection());
  };
  languageService.addDirectionListener(updateDirection);

  const header = document.createElement('div');
  header.className = 'video-manager-header';

  const titleGroup = document.createElement('div');
  titleGroup.innerHTML = `<h2>${languageService.translate("savedVideos")}</h2> <span class="video-count">${initialVideos.length} ${languageService.translate("itemsTerm")}</span>`;

  const icons = config.getIcons();
  const closeButton = createButton(icons.CLOSE, null, closeCallback, undefined, 'default');
  closeButton.classList.add('btn--icon');

  header.appendChild(titleGroup);
  header.appendChild(closeButton);

  const toolbar = document.createElement('div');
  toolbar.className = 'video-manager-toolbar';

  const searchContainer = document.createElement('div');
  searchContainer.className = 'video-manager-search';

  const searchInput = document.createElement('input');
  searchInput.placeholder = languageService.translate("searchPlaceholder");
  const searchIcon = document.createElement('span');
  searchIcon.className = 'material-icons';
  searchIcon.textContent = icons.SEARCH;

  searchContainer.appendChild(searchIcon);
  searchContainer.appendChild(searchInput);

  const getRetentionDisplay = (retention: number) => {
    if (retention === Infinity) {
      return languageService.translate("infiniteTerm");
    } else if (retention === 1) {
      return `${retention} ${languageService.translate("dayUnit")}`;
    } else {
      return `${retention} ${languageService.translate("daysUnit")}`;
    }
  };

  const retentionBtn = createButton(
    null,
    null,
    async () => {
      const currentVal = initialRetention === Infinity ? languageService.translate("infiniteTerm") : initialRetention.toString();
      const daysStr = await showPromptDialog({
        title: languageService.translate("autoDeleteTitle"),
        message: languageService.translate("retentionDaysPrompt"),
        defaultValue: currentVal,
        inputType: 'text'
      });

      if (daysStr === null) return;

      const parsedDays = parseInt(daysStr);
      let newRetention = parsedDays;

      if (daysStr.trim().toLowerCase() === languageService.translate("infiniteTerm").toLowerCase() || parsedDays > 30) {
        newRetention = Infinity;
      }

      if (!isNaN(newRetention)) {
        await noteStorage.setRetentionDays(newRetention);
        const displayValue = getRetentionDisplay(newRetention);
        showToast(languageService.translate("savedDays", [displayValue]), 'success');
        retentionBtn.innerHTML = `<span class="retention-label">${languageService.translate("autoDeleteLabel")}</span> <b>${displayValue}</b>`;
        initialRetention = newRetention;
      }
    },
    'retention-btn',
    'default'
  );
  const retentionDisplay = getRetentionDisplay(initialRetention);
  retentionBtn.innerHTML = `<span class="retention-label">${languageService.translate("autoDeleteLabel")}</span> <b>${retentionDisplay}</b>`;

  const deleteAllBtn = createButton(
    icons.DELETE_SWEEP,
    null,
    async () => {
      const confirmed = await showConfirmDialog({
        title: languageService.translate("confirmDeleteAllTitle"),
        message: languageService.translate("confirmDeleteAllMessage"),
        confirmButtonType: 'danger'
      });
      if (confirmed) {
        await noteStorage.clearAllNotes();
        actions.setNotes([]);
        closeCallback();
        chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' }).catch(e => console.warn('Failed to send NOTES_UPDATED_GLOBALLY message:', e));
      }
    },
    'delete-all-btn',
    'danger'
  );
  deleteAllBtn.title = languageService.translate("confirmDeleteAll");

  const globalActionsGroup = document.createElement('div');
  globalActionsGroup.className = 'video-manager-global-actions';

  const downloadAllNotesBtn = createButton(
    icons.DOWNLOAD,
    null,
    () => shareService.exportNotesAsJson([], '', 'all_notes'),
    'downloadAllNotesBtn',
    'primary'
  );
  downloadAllNotesBtn.title = languageService.translate("downloadAllNotesJson");

  const uploadAllNotesBtn = createButton(
    icons['UPLOAD'] ?? null,
    null,
    async () => {
      await shareService.importNotesFromJson(true, (storedVideos: StoredVideoData[]) => {
        // Convert StoredVideoData[] to Video[] for display with robust fallbacks
        const videos: Video[] = storedVideos.map(sv => ({
          id: sv.videoId || (sv as any).id || '',
          title: sv.videoTitle || (sv as any).title || 'Untitled',
          thumbnail: sv.thumbnail || (sv as any).thumbnailUrl || '',
          notes: sv.notes || [],
          lastModified: sv.lastModified || Date.now(),
          firstNoteTimestamp: sv.firstNoteTimestamp || 0,
          group: sv.group,
          channelName: sv.channelName,
          channelId: sv.channelId
        })).filter(v => !!v.id); // Filter out invalid items immediately

        renderList(videos, '');
      });
    },
    'uploadAllNotesBtn',
    'primary'
  );
  uploadAllNotesBtn.title = languageService.translate("uploadAllNotesJson");

  globalActionsGroup.append(downloadAllNotesBtn, uploadAllNotesBtn);
  toolbar.append(searchContainer, retentionBtn, deleteAllBtn, globalActionsGroup);

  const contentList = document.createElement('div');
  contentList.className = 'video-manager-content';

  // Overloaded renderList to support filtered search results
  // Note: FilteredVideo extends Video, so this accepts both types
  const renderList = (list: (Video | FilteredVideo)[], searchQuery: string = '') => {
    contentList.innerHTML = '';

    if (!list || list.length === 0) {
      const message = searchQuery
        ? languageService.translate("noSearchResults", "No results found")
        : languageService.translate("noSavedVideos");
      contentList.innerHTML = `<div class="empty-list-message">${message}</div>`;
      return;
    }

    const groupedVideos: { [key: string]: Video[] } = {};
    const noGroupKey = languageService.translate("noGroup", "No Group");

    list.forEach(video => {
      const groupName = video.group || noGroupKey;
      if (!groupedVideos[groupName]) {
        groupedVideos[groupName] = [];
      }
      groupedVideos[groupName].push(video as FilteredVideo);
    });

    const groupOrder = settingsService.get('videoGroups');

    // ✅ FIXED: Filter out empty groups from UI display (Issue #2)
    // Note: Group data remains in SettingsService.videoGroups - only UI display is affected
    const sortedGroupNames = Object.keys(groupedVideos)
      .filter(groupName => groupedVideos[groupName].length > 0) // Skip empty groups in UI
      .sort((a, b) => {
        const aIndex = groupOrder.indexOf(a);
        const bIndex = groupOrder.indexOf(b);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        if (a === noGroupKey) return -1;
        if (b === noGroupKey) return 1;
        return a.localeCompare(b);
      });

    sortedGroupNames.forEach(groupName => {
      const groupContainer = document.createElement('div');
      groupContainer.className = 'video-group-section';
      groupContainer.dataset.groupName = groupName;

      const groupToggle = document.createElement('div');
      groupToggle.className = 'video-group-toggle';
      groupToggle.innerHTML = `<span class="material-icons group-drag-handle" style="cursor: grab;">drag_indicator</span><h3>${groupName}</h3> <span class="video-count">${groupedVideos[groupName].length} ${languageService.translate("itemsTerm")}</span> <span class="material-icons">${icons.EXPAND_MORE}</span>`;

      const groupContentContainer = document.createElement('div');
      groupContentContainer.className = 'video-group-content';
      groupContentContainer.style.display = 'none';

      if (openGroups.has(groupName)) {
        groupContentContainer.style.display = 'flex';
        groupToggle.querySelector('.material-icons:not(.group-drag-handle)')!.classList.add('rotated');
      }

      groupedVideos[groupName].forEach(video => {
        if (!video.id) return;
        // ✅ ISSUE #4: Pass searchQuery and filteredNotes for precise search
        const card = createCard(
          video,
          closeCallback,
          () => {
            card.remove();

            // ✅ FIX: Check if group is now empty and hide/remove it
            const remainingCards = groupContentContainer.querySelectorAll('.video-card');
            if (remainingCards.length === 0) {
              // Hide the entire group section
              groupContainer.style.display = 'none';
            } else {
              // Update the count in the group toggle
              const countSpan = groupToggle.querySelector('.video-count');
              if (countSpan) {
                countSpan.textContent = `${remainingCards.length} ${languageService.translate("itemsTerm")}`;
              }
            }

            // Update total video count in header
            const headerCount = container.querySelector('.video-manager-header .video-count');
            if (headerCount) {
              const allCards = contentList.querySelectorAll('.video-card');
              headerCount.textContent = `${allCards.length} ${languageService.translate("itemsTerm")}`;
            }
          },
          searchQuery,
          video.filteredNotes
        );
        groupContentContainer.appendChild(card);
      });

      new Sortable(groupContentContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        handle: '.drag-handle',
        swapThreshold: 0.5,
        invertSwap: true,
        scroll: false,
        onStart: () => {
          let scrollInterval: ReturnType<typeof setInterval> | null = null;
          let currentScrollSpeed = 0;

          const handleDragOver = (e: DragEvent) => {
            const rect = container.getBoundingClientRect();
            const mouseY = e.clientY;
            const containerHeight = rect.height;
            const scrollZone = containerHeight * 0.45;
            const maxSpeed = 30;
            const minSpeed = 5;

            const distanceFromTop = mouseY - rect.top;
            const distanceFromBottom = rect.bottom - mouseY;

            if (distanceFromTop < scrollZone && distanceFromTop >= 0) {
              const proximity = 1 - (distanceFromTop / scrollZone);
              currentScrollSpeed = -(minSpeed + (maxSpeed - minSpeed) * proximity);
            }
            else if (distanceFromBottom < scrollZone && distanceFromBottom >= 0) {
              const proximity = 1 - (distanceFromBottom / scrollZone);
              currentScrollSpeed = minSpeed + (maxSpeed - minSpeed) * proximity;
            }
            else if (mouseY < rect.top) {
              currentScrollSpeed = -maxSpeed;
            }
            else if (mouseY > rect.bottom) {
              currentScrollSpeed = maxSpeed;
            }
            else {
              currentScrollSpeed = 0;
            }
          };

          scrollInterval = setInterval(() => {
            if (currentScrollSpeed !== 0) {
              container.scrollTop += currentScrollSpeed;
            }
          }, 16);

          // استخدام dragover لأن Sortable.js يستخدم drag events
          document.addEventListener('dragover', handleDragOver, { capture: true });

          (groupContentContainer as any).__dragCleanup = () => {
            document.removeEventListener('dragover', handleDragOver, { capture: true });
            if (scrollInterval) clearInterval(scrollInterval);
          };
        },
        onEnd: async () => {
          if ((groupContentContainer as any).__dragCleanup) {
            (groupContentContainer as any).__dragCleanup();
            delete (groupContentContainer as any).__dragCleanup;
          }

          const allVideoElements = [...contentList.querySelectorAll('.video-card')] as HTMLElement[];
          const allVideoIds = allVideoElements.map(card => card.dataset.videoId as string);
          await noteStorage.saveVideoOrder(allVideoIds);
        }
      });

      groupToggle.onclick = (e) => {
        if ((e.target as HTMLElement).classList.contains('group-drag-handle')) return;

        const isHid = groupContentContainer.style.display === 'none';
        if (isHid) {
          openGroups.add(groupName);
        } else {
          openGroups.delete(groupName);
        }
        groupContentContainer.style.display = isHid ? 'flex' : 'none';
        groupToggle.querySelector('.material-icons:not(.group-drag-handle)')!.classList.toggle('rotated', isHid);
      };

      groupContainer.appendChild(groupToggle);
      groupContainer.appendChild(groupContentContainer);
      contentList.appendChild(groupContainer);
    });
  };

  renderList(initialVideos);

  new Sortable(contentList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    chosenClass: 'sortable-chosen',
    handle: '.group-drag-handle',
    swapThreshold: 0.5,
    invertSwap: true,
    scroll: false,
    onStart: () => {
      let scrollInterval: ReturnType<typeof setInterval> | null = null;
      let currentScrollSpeed = 0;

      const handleDragOver = (e: DragEvent) => {
        const rect = container.getBoundingClientRect();
        const mouseY = e.clientY;
        const containerHeight = rect.height;
        const scrollZone = containerHeight * 0.45;
        const maxSpeed = 30;
        const minSpeed = 5;

        const distanceFromTop = mouseY - rect.top;
        const distanceFromBottom = rect.bottom - mouseY;

        if (distanceFromTop < scrollZone && distanceFromTop >= 0) {
          const proximity = 1 - (distanceFromTop / scrollZone);
          currentScrollSpeed = -(minSpeed + (maxSpeed - minSpeed) * proximity);
        }
        else if (distanceFromBottom < scrollZone && distanceFromBottom >= 0) {
          const proximity = 1 - (distanceFromBottom / scrollZone);
          currentScrollSpeed = minSpeed + (maxSpeed - minSpeed) * proximity;
        }
        else if (mouseY < rect.top) {
          currentScrollSpeed = -maxSpeed;
        }
        else if (mouseY > rect.bottom) {
          currentScrollSpeed = maxSpeed;
        }
        else {
          currentScrollSpeed = 0;
        }
      };

      scrollInterval = setInterval(() => {
        if (currentScrollSpeed !== 0) {
          container.scrollTop += currentScrollSpeed;
        }
      }, 16);

      document.addEventListener('dragover', handleDragOver, { capture: true });

      (contentList as any).__dragCleanup = () => {
        document.removeEventListener('dragover', handleDragOver, { capture: true });
        if (scrollInterval) clearInterval(scrollInterval);
      };
    },
    onEnd: async () => {
      if ((contentList as any).__dragCleanup) {
        (contentList as any).__dragCleanup();
        delete (contentList as any).__dragCleanup;
      }

      const groupElements = [...contentList.querySelectorAll('.video-group-section')] as HTMLElement[];
      const newGroupOrder = groupElements.map(el => el.dataset.groupName!);
      settingsService.update({ videoGroups: newGroupOrder });
    }
  });

  // ✅ ISSUE #4: Precise Note Search - Filter notes within videos, not just entire videos
  searchInput.addEventListener('input', debounce(async (e: Event) => {
    const rawQ = (e.target as HTMLInputElement).value;
    const q = normalizeStringForSearch(rawQ);

    // If empty query, show all videos normally
    if (!q.trim()) {
      const allVideos = await noteStorage.loadSavedVideos();
      renderList(allVideos, '');
      return;
    }

    const allVideos = await noteStorage.loadSavedVideos();

    // Filter videos and their notes precisely
    const filteredVideos: FilteredVideo[] = allVideos
      .map(video => {
        const normalizedTitle = normalizeStringForSearch(video.title || '');
        const normalizedGroup = normalizeStringForSearch(video.group || '');
        const titleMatch = normalizedTitle.includes(q);
        const groupMatch = normalizedGroup.includes(q);

        // Filter notes that match the query
        const matchingNotes = (video.notes || []).filter(n =>
          normalizeStringForSearch(n.text || '').includes(q)
        );

        // Include video if title/group matches OR has matching notes
        if (titleMatch || groupMatch || matchingNotes.length > 0) {
          return {
            ...video,
            // If title/group match, show all notes; otherwise only show matching notes
            filteredNotes: (titleMatch || groupMatch) ? video.notes : matchingNotes,
            isSearchResult: true
          } as FilteredVideo;
        }
        return null;
      })
      .filter((v): v is FilteredVideo => v !== null);

    renderList(filteredVideos, q);
  }, 300));

  container.append(header, toolbar, contentList);
  return container;
}

// ✅ ISSUE #4: Updated createCard to support search highlighting
function createCard(
  video: FilteredVideo,
  closeCallback: () => void,
  onDelete: () => void,
  searchQuery: string = '',
  filteredNotes?: Note[]
): HTMLElement {
  const icons = config.getIcons();
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.videoId = video.id;

  // Add search result indicator if searching
  if (searchQuery) {
    card.classList.add('video-card--search-result');
  }

  const topRow = document.createElement('div');
  topRow.className = 'video-card-top-row';

  const thumbWrapper = document.createElement('div');
  thumbWrapper.className = 'video-card-thumbnail';
  thumbWrapper.onclick = () => { closeCallback(); setTimeout(() => noteStorage.handleVideoOpen(video.id, video.firstNoteTimestamp), 50); };
  const thumb = document.createElement('img');
  thumb.src = video.thumbnail || '';

  const playO = document.createElement('div');
  playO.className = 'play-overlay';
  playO.innerHTML = `<span class="material-icons">${icons['PLAY_CIRCLE']}</span>`;

  thumbWrapper.append(thumb, playO);

  const info = document.createElement('div');
  info.className = 'video-card-info';

  const title = document.createElement('h3');
  title.textContent = video.title || 'Untitled';

  const handle = document.createElement('span');
  handle.className = 'material-icons drag-handle';
  handle.textContent = 'drag_indicator';

  const titleWrapper = document.createElement('div');
  titleWrapper.appendChild(title);

  const btns = document.createElement('div');
  btns.className = 'video-card-actions';

  const openBtn = createButton(icons['OPEN'] ?? null, languageService.translate("openVideo"), () => { closeCallback(); setTimeout(() => noteStorage.handleVideoOpen(video.id, video.firstNoteTimestamp), 50); }, undefined, 'primary');

  const delBtn = createButton(icons['DELETE'] ?? null, languageService.translate("delete"), async () => {
    const confirmed = await showConfirmDialog({
      title: languageService.translate("confirmDeleteTitle"),
      message: languageService.translate("confirmDelete", [video.title]),
      confirmButtonType: 'danger'
    });
    if (confirmed) {
      await noteStorage.deleteVideo(video.id);
      onDelete();
      chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' }).catch(e => console.warn('Failed to send NOTES_UPDATED_GLOBALLY message:', e));
    }
  }, undefined, 'danger');

  btns.append(openBtn, delBtn);
  info.append(titleWrapper, handle, btns);
  topRow.append(thumbWrapper, info);

  const notesContainer = document.createElement('div');
  notesContainer.className = 'video-card-notes-container';

  // ✅ ISSUE #4: Use filteredNotes if provided (during search), otherwise show all notes
  const notesToDisplay = filteredNotes || video.notes || [];
  const totalNotesCount = video.notes?.length || 0;

  if (notesToDisplay.length > 0) {
    const toggle = document.createElement('div');
    toggle.className = 'notes-toggle';

    // Show "X matching notes out of Y total" during search
    if (searchQuery && filteredNotes && filteredNotes.length < totalNotesCount) {
      toggle.innerHTML = `<span class="material-icons">${icons['EXPAND_MORE']}</span> <b>${filteredNotes.length}</b>/${totalNotesCount} ${languageService.translate("matchingNotes", "matching notes")}`;
      toggle.classList.add('notes-toggle--search');
    } else {
      toggle.innerHTML = `<span class="material-icons">${icons['EXPAND_MORE']}</span> <b>${notesToDisplay.length}</b> ${languageService.translate("notesTerm")}`;
    }

    // Auto-expand notes during search to show matching content
    if (searchQuery) {
      notesContainer.style.display = 'flex';
      toggle.querySelector('.material-icons')!.classList.add('rotated');
    }

    toggle.onclick = () => {
      const isHid = notesContainer.style.display === 'none';
      notesContainer.style.display = isHid ? 'flex' : 'none';
      toggle.querySelector('.material-icons')!.classList.toggle('rotated', isHid);
    };

    const list = document.createElement('div');
    list.className = 'notes-list';

    // Helper function to highlight search matches
    const highlightText = (text: string, query: string): string => {
      if (!query) return text;
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase();
      const index = normalizedText.indexOf(normalizedQuery);
      if (index === -1) return text;

      const before = text.slice(0, index);
      const match = text.slice(index, index + query.length);
      const after = text.slice(index + query.length);
      return `${before}<mark class="search-highlight">${match}</mark>${after}`;
    };

    notesToDisplay.forEach(note => {
      const row = document.createElement('div');
      row.className = 'note-row';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px'; // Add some padding

      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content-wrapper';
      contentDiv.style.flex = '1';
      contentDiv.style.cursor = 'pointer';
      contentDiv.style.display = 'flex';
      contentDiv.style.alignItems = 'center';

      const safeTime = Math.floor(note.timestampInSeconds || 0);

      // Click on content opens video (UNLESS editing)
      contentDiv.onclick = (e) => {
        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
          return;
        }
        closeCallback();
        setTimeout(() => noteStorage.handleVideoOpen(video.id, safeTime), 50);
      };

      const timeSpan = document.createElement('span');
      timeSpan.textContent = formatTimestamp(safeTime);
      timeSpan.classList.add('btn--note-timestamp');
      timeSpan.style.marginRight = '8px';

      const txt = document.createElement('span');
      txt.className = 'note-text';
      // ✅ ISSUE #4: Apply search highlighting if there's a search query
      if (searchQuery) {
        txt.innerHTML = highlightText(note.text, searchQuery);
      } else {
        txt.textContent = note.text;
      }
      Object.assign(txt.style, {
        flex: '1',
        padding: '4px',
        borderRadius: '4px',
        transition: 'all 0.2s ease',
        display: 'block', // Ensure it takes width
        whiteSpace: 'pre-wrap', // Respect newlines
        wordBreak: 'break-word' // Prevent overflow
      });

      contentDiv.append(timeSpan, txt);

      // Actions container
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'note-actions';
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '4px';

      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn--icon btn--ghost';
      editBtn.innerHTML = `<span class="material-icons" style="font-size: 16px;">edit</span>`;
      editBtn.title = languageService.translate("edit");

      editBtn.onclick = (e) => {
        e.stopPropagation();

        // 1. Enter Edit Mode styling
        txt.contentEditable = 'true';
        Object.assign(txt.style, {
          width: '100%', // Ensure full width
          backgroundColor: 'var(--color-surface, #fff)',
          border: '2px solid var(--color-primary, #2196f3)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '15px',
          lineHeight: '1.5',
          outline: 'none',
          minHeight: '60px',
          maxHeight: '200px', // Increased max height
          overflowY: 'auto',  // Force scrollbar
          display: 'block',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          zIndex: '100'
        });
        txt.focus();

        // Prevent clicks on text from bubbling to row navigation
        txt.onclick = (ev) => ev.stopPropagation();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(txt);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        let isSaving = false;

        // Helper to cleanup and save
        const saveChanges = async () => {
          if (isSaving) return;
          isSaving = true;

          // Stop editing interaction
          txt.onclick = null;

          const newText = txt.textContent?.trim();

          // If changed, save
          if (newText && newText !== note.text) {
            note.text = newText;
            await noteStorage.saveNotes(video.notes, video.group, video.id, video.title);

            // Update global store if this is the current video
            if (getCurrentVideoId() === video.id) {
              actions.setNotes([...video.notes]);
            }

            showToast(languageService.translate("noteSaved"), 'success');
          } else if (!newText) {
            // Revert if empty
            txt.textContent = note.text;
          }

          // Revert Styling
          txt.contentEditable = 'false';
          // Reset to default styles (preserving structural ones)
          Object.assign(txt.style, {
            backgroundColor: '',
            border: '',
            padding: '4px',
            borderRadius: '4px',
            boxShadow: '',
            fontSize: '',
            lineHeight: '',
            outline: '',
            minWidth: '',
            cursor: '',
            position: '',
            zIndex: '',
            maxHeight: '',
            overflowY: '',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          });

          // Remove listeners
          txt.removeEventListener('blur', blurHandler);
          txt.removeEventListener('keydown', keyHandler);
        };

        // Listener: Save on blur (click away)
        const blurHandler = () => {
          setTimeout(saveChanges, 100);
        };
        txt.addEventListener('blur', blurHandler);

        // Listener: Save on Enter, Revert on Escape
        const keyHandler = (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' && !ev.shiftKey) { // Allow Shift+Enter for new lines
            ev.preventDefault();
            txt.blur();
          } else if (ev.key === 'Escape') {
            // Revert immediately
            txt.textContent = note.text;
            isSaving = true; // prevent save logic
            txt.blur();

            // Manual cleanup 
            txt.onclick = null;
            txt.contentEditable = 'false';
            Object.assign(txt.style, {
              backgroundColor: '',
              border: '',
              padding: '4px',
              borderRadius: '4px',
              boxShadow: '',
              fontSize: '',
              lineHeight: '',
              outline: '',
              minWidth: '',
              cursor: '',
              position: '',
              zIndex: '',
              maxHeight: '',
              overflowY: '',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            });
            txt.removeEventListener('blur', blurHandler);
            txt.removeEventListener('keydown', keyHandler);
          }
        };
        txt.addEventListener('keydown', keyHandler);
      };

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn--icon btn--ghost';
      deleteBtn.innerHTML = `<span class="material-icons" style="font-size: 16px; color: var(--color-danger);">delete</span>`;
      deleteBtn.title = languageService.translate("delete");
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();

        // Direct delete (Reference Note: user requested no confirmation)
        const updatedNotes = video.notes.filter(n => n !== note);
        await noteStorage.saveNotes(updatedNotes, video.group, video.id, video.title);

        // Update local object reference so further edits/deletes work on correct data
        video.notes = updatedNotes;

        // Update global store if this is the current video
        if (getCurrentVideoId() === video.id) {
          actions.setNotes([...updatedNotes]);
        }

        // Remove the row from UI
        row.remove();

        // Update the count in the toggle
        if (toggle) {
          const countEl = toggle.querySelector('b');
          if (countEl) countEl.textContent = updatedNotes.length.toString();
        }

        showToast(languageService.translate("noteDeleted"), 'success');
      };

      actionsDiv.append(editBtn, deleteBtn);
      row.append(contentDiv, actionsDiv);

      row.onmouseover = () => row.style.backgroundColor = 'var(--color-primary-hover)';
      row.onmouseout = () => row.style.backgroundColor = '';

      list.appendChild(row);
    });

    notesContainer.appendChild(list);
    card.append(topRow, toggle, notesContainer);
  } else {
    card.appendChild(topRow);
  }

  return card;
}

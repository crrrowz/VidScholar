// src/components/modals/VideoManager.ts
import type { Video } from '../../types';
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
    icons.UPLOAD,
    null,
    async () => {
      await shareService.importNotesFromJson(true, (videos) => renderList(videos));
    },
    'uploadAllNotesBtn',
    'primary'
  );
  uploadAllNotesBtn.title = languageService.translate("uploadAllNotesJson");

  globalActionsGroup.append(downloadAllNotesBtn, uploadAllNotesBtn);
  toolbar.append(searchContainer, retentionBtn, deleteAllBtn, globalActionsGroup);

  const contentList = document.createElement('div');
  contentList.className = 'video-manager-content';

  const renderList = (list: Video[]) => {
    contentList.innerHTML = '';

    if (!list || list.length === 0) {
      contentList.innerHTML = `<div class="empty-list-message">${languageService.translate("noSavedVideos")}</div>`;
      return;
    }

    const groupedVideos: { [key: string]: Video[] } = {};
    const noGroupKey = languageService.translate("noGroup", "No Group");

    list.forEach(video => {
      const groupName = video.group || noGroupKey;
      if (!groupedVideos[groupName]) {
        groupedVideos[groupName] = [];
      }
      groupedVideos[groupName].push(video);
    });

    const groupOrder = settingsService.get('videoGroups');

    const sortedGroupNames = Object.keys(groupedVideos).sort((a, b) => {
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
        const card = createCard(video, closeCallback, () => card.remove());
        groupContentContainer.appendChild(card);
      });

      new Sortable(groupContentContainer, {
        animation: 150,
        ghostClass: 'blue-background-class',
        handle: '.drag-handle',
        direction: languageService.getCurrentDirection(),
        onEnd: async () => {
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
    handle: '.group-drag-handle',
    direction: languageService.getCurrentDirection(),
    onEnd: async () => {
      const groupElements = [...contentList.querySelectorAll('.video-group-section')] as HTMLElement[];
      const newGroupOrder = groupElements.map(el => el.dataset.groupName!);
      settingsService.update({ videoGroups: newGroupOrder });
    }
  });

  searchInput.addEventListener('input', debounce(async (e: Event) => {
    const rawQ = (e.target as HTMLInputElement).value;
    const q = normalizeStringForSearch(rawQ);
    const allVideos = await noteStorage.loadSavedVideos();
    const filteredVideos = allVideos.filter(v => {
      const normalizedTitle = normalizeStringForSearch(v.title || '');
      const normalizedGroup = normalizeStringForSearch(v.group || '');
      const notesMatch = (v.notes || []).some(n => normalizeStringForSearch(n.text || '').includes(q));
      return normalizedTitle.includes(q) || normalizedGroup.includes(q) || notesMatch;
    });
    renderList(filteredVideos);
  }, 300));

  container.append(header, toolbar, contentList);
  return container;
}

function createCard(video: Video, closeCallback: () => void, onDelete: () => void): HTMLElement {
  const icons = config.getIcons();
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.videoId = video.id;

  const topRow = document.createElement('div');
  topRow.className = 'video-card-top-row';

  const thumbWrapper = document.createElement('div');
  thumbWrapper.className = 'video-card-thumbnail';
  thumbWrapper.onclick = () => { closeCallback(); setTimeout(() => noteStorage.handleVideoOpen(video.id, video.firstNoteTimestamp), 50); };
  const thumb = document.createElement('img');
  thumb.src = video.thumbnail || '';

  const playO = document.createElement('div');
  playO.className = 'play-overlay';
  playO.innerHTML = `<span class="material-icons">${icons.PLAY_CIRCLE}</span>`;

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

  const openBtn = createButton(icons.OPEN, languageService.translate("openVideo"), () => { closeCallback(); setTimeout(() => noteStorage.handleVideoOpen(video.id, video.firstNoteTimestamp), 50); }, undefined, 'primary');

  const delBtn = createButton(icons.DELETE, languageService.translate("delete"), async () => {
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

  const notes = video.notes || [];
  if (notes.length > 0) {
    const toggle = document.createElement('div');
    toggle.className = 'notes-toggle';
    toggle.innerHTML = `<span class="material-icons">${icons.EXPAND_MORE}</span> <b>${notes.length}</b> ${languageService.translate("notesTerm")}`;

    toggle.onclick = () => {
      const isHid = notesContainer.style.display === 'none';
      notesContainer.style.display = isHid ? 'flex' : 'none';
      toggle.querySelector('.material-icons')!.classList.toggle('rotated', isHid);
    };

    const list = document.createElement('div');
    list.className = 'notes-list';

    notes.forEach(note => {
      const row = document.createElement('div');
      row.className = 'note-row';

      const safeTime = Math.floor(note.timestampInSeconds || 0);
      row.onclick = () => { closeCallback(); setTimeout(() => noteStorage.handleVideoOpen(video.id, safeTime), 50); };
      row.onmouseover = () => row.style.backgroundColor = 'var(--color-primary-hover)';
      row.onmouseout = () => row.style.backgroundColor = '';

      const timeSpan = document.createElement('span');
      timeSpan.textContent = formatTimestamp(safeTime);
      timeSpan.classList.add('btn--note-timestamp');

      const txt = document.createElement('span');
      txt.className = 'note-text';
      txt.textContent = note.text;

      row.append(timeSpan, txt);
      list.appendChild(row);
    });

    notesContainer.appendChild(list);
    card.append(topRow, toggle, notesContainer);
  } else {
    card.appendChild(topRow);
  }

  return card;
}

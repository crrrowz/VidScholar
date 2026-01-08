// classes/NoteStorage.ts
import type { Note, Video, StoredVideoData } from '../types';
import { NoteCache } from './NoteCache';
import { NoteError } from './NoteError';
import config from '../utils/config';
import { getCurrentVideoId, getVideoTitle, getChannelName, getChannelId } from '../utils/video';
import { showToast } from '../utils/toast';
import { languageService } from '../services/LanguageService';
import { actions } from '../state/actions';
import { storageAdapter } from '../storage/StorageAdapter';
import { settingsService } from '../services/SettingsService';

export class NoteStorage {
  private cache: NoteCache;
  private retentionDays: number;
  private _initialized: boolean;
  private defaultPresets: { [key: number]: string[] };
  private presetListeners: Set<(preset: number) => void> = new Set();
  private templateListeners: Set<() => void> = new Set();

  constructor() {
    this.cache = new NoteCache();
    const storageConfig = config.getStorageConfig();
    this.retentionDays = storageConfig.retentionDays;
    this._initialized = false;

    // Load presets from config
    const presets = config.getPresets();
    this.defaultPresets = {};
    Object.keys(presets).forEach(key => {
      this.defaultPresets[parseInt(key)] = presets[key].templates;
    });
  }

  async initialize(): Promise<boolean> {
    if (this._initialized) return true;

    try {
      await storageAdapter.initialize();
      this._initialized = true;
      return true;
    } catch (error) {
      console.error('Storage initialization failed:', error);
      return false;
    }
  }

  // ==========================================
  // PRESETS & TEMPLATES
  // ==========================================

  async getCurrentPreset(): Promise<number> {
    const result = await storageAdapter.get<number>('current_preset');
    return result ?? 1;
  }

  async savePresetNumber(number: number): Promise<boolean> {
    const success = await storageAdapter.set('current_preset', number);
    if (success) {
      this.notifyPresetListeners(number);
    }
    return success;
  }

  async savePresetTemplates(presetNumber: number, templates: string[]): Promise<boolean> {
    try {
      const currentSettings = settingsService.getSettings();
      const currentPresets = currentSettings.presets || {};

      // Ensure preset object exists
      if (!currentPresets[presetNumber]) {
        currentPresets[presetNumber] = {
          name: this.getPresetDefaultName(presetNumber),
          description: '',
          templates: []
        };
      }

      // Update templates
      currentPresets[presetNumber].templates = templates;

      // Save via SettingsService (Syncs to Cloud)
      await settingsService.update({ presets: currentPresets });

      this.notifyTemplateListeners();
      return true;
    } catch (error) {
      console.error('Failed to save preset templates:', error);
      return false;
    }
  }

  async loadPresetTemplates(presetNumber: number): Promise<string[]> {
    const currentSettings = settingsService.getSettings();
    const presets = currentSettings.presets || {};

    if (presets[presetNumber] && presets[presetNumber].templates) {
      return presets[presetNumber].templates;
    }

    // Fallback to legacy or defaults
    return this.defaultPresets[presetNumber] || [];
  }

  async savePresetName(presetNumber: number, name: string): Promise<void> {
    try {
      const currentSettings = settingsService.getSettings();
      const currentPresets = currentSettings.presets || {};

      if (!currentPresets[presetNumber]) {
        currentPresets[presetNumber] = {
          name: name,
          description: '',
          templates: this.defaultPresets[presetNumber] || []
        };
      } else {
        currentPresets[presetNumber].name = name;
      }

      await settingsService.update({ presets: currentPresets });
      this.notifyTemplateListeners();
    } catch (error) {
      console.error('Failed to save preset name:', error);
    }
  }

  async loadPresetName(presetNumber: number): Promise<string | undefined> {
    const currentSettings = settingsService.getSettings();
    const presets = currentSettings.presets || {};

    return presets[presetNumber]?.name;
  }

  // ==========================================
  // CORE NOTE OPERATIONS
  // ==========================================

  async saveNotes(
    notes: Note[],
    group?: string | null,
    targetVideoId?: string,
    videoTitle?: string,
    channelName?: string,
    channelId?: string
  ): Promise<boolean> {
    const videoId = targetVideoId || getCurrentVideoId();
    if (!videoId) {
      throw new NoteError('Video ID not found', 'loading');
    }

    if (notes.length === 0) {
      try {
        await storageAdapter.deleteVideo(videoId);
        this.cache.delete(videoId);
        return true;
      } catch (error) {
        throw new NoteError('Failed to remove empty notes', 'network');
      }
    }

    try {
      const title = videoTitle || getVideoTitle();
      const success = await storageAdapter.saveVideoNotes({
        videoId,
        videoTitle: title,
        notes,
        group: group || undefined,
        channelName: channelName || getChannelName(),
        channelId: channelId || getChannelId()
      });

      this.cache.set(videoId, notes);
      return success;
    } catch (error: any) {
      console.error('Failed to save notes:', error);
      throw new NoteError('Failed to save notes', 'storage');
    }
  }

  async loadNotes(forceRefresh: boolean = false): Promise<Note[]> {
    const videoId = getCurrentVideoId();
    if (!videoId) {
      throw new NoteError('Video ID not found', 'loading');
    }

    if (!forceRefresh) {
      const cachedNotes = this.cache.get(videoId);
      if (cachedNotes) {
        return cachedNotes;
      }
    }

    try {
      const notes = await storageAdapter.loadVideoNotes(videoId);

      // Update store with group info (if we can find it)
      const allVideos = await storageAdapter.loadAllVideos();
      const videoData = allVideos.find(v => v.videoId === videoId);

      if (videoData?.group) {
        actions.setVideoGroup(videoData.group);
      } else {
        // Auto-detect group from channel history
        // Retry capturing channel info as it might load late
        let attempts = 0;
        const tryDetectGroup = () => {
          const currentChannelId = getChannelId();
          const currentChannelName = getChannelName();

          if (!currentChannelId && !currentChannelName && attempts < 5) {
            attempts++;
            setTimeout(tryDetectGroup, 500);
            return;
          }

          // Find last video from same channel that has a group
          const lastChannelVideo = allVideos
            .filter(v => v.group && (
              (currentChannelId && v.channelId === currentChannelId) ||
              (!currentChannelId && currentChannelName && v.channelName === currentChannelName)
            ))
            .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0];

          if (lastChannelVideo?.group) {
            actions.setVideoGroup(lastChannelVideo.group);
            showToast(languageService.translate("autoAssignedGroup") + ": " + lastChannelVideo.group, 'success');
          } else {
            actions.setVideoGroup(null);
          }
        };

        tryDetectGroup();
      }

      this.cache.set(videoId, notes);
      return notes;
    } catch (error: any) {
      console.error('Failed to load notes:', error);
      throw new NoteError('Failed to load notes', 'storage');
    }
  }

  async deleteNote(noteId: string, videoId?: string): Promise<boolean> {
    const targetVideoId = videoId || getCurrentVideoId();
    if (!targetVideoId) return false;

    try {
      const notes = await this.loadNotes();
      const updatedNotes = notes.filter(note => note.timestamp !== noteId);
      const success = await this.saveNotes(updatedNotes, null, targetVideoId);

      if (success) {
        showToast(languageService.translate("noteDeleted"), 'success');
      }
      return success;
    } catch (error) {
      showToast(languageService.translate("failedToDeleteNote"), 'error');
      return false;
    }
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      await storageAdapter.deleteVideo(videoId);
      this.cache.delete(videoId);

      // Clean up order list
      const videoOrder = await this.loadVideoOrder();
      const index = videoOrder.indexOf(videoId);
      if (index > -1) {
        videoOrder.splice(index, 1);
        await this.saveVideoOrder(videoOrder);
      }

      if (getCurrentVideoId() === videoId) {
        actions.setNotes([]);
      }

      return true;
    } catch (error) {
      showToast(languageService.translate("failedToDeleteVideo"), 'error');
      return false;
    }
  }

  // ==========================================
  // LIBRARY OPERATIONS
  // ==========================================

  async loadSavedVideos(): Promise<Video[]> {
    try {
      const retentionDays = await this.getRetentionDays();
      const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
      const currentTime = Date.now();

      const storedVideos = await storageAdapter.loadAllVideos();
      const videos: Video[] = [];

      for (const data of storedVideos) {
        // Retention check
        const videoDate = data.lastModified || 0;
        if (retentionDays !== Infinity && currentTime - videoDate > retentionPeriod) {
          await storageAdapter.deleteVideo(data.videoId);
          continue;
        }

        const notes = data.notes || [];
        let firstNoteTimestamp: number | undefined = undefined;

        if (notes.length > 0) {
          firstNoteTimestamp = notes.reduce((min, note) => {
            return note.timestampInSeconds < min ? note.timestampInSeconds : min;
          }, notes[0].timestampInSeconds);
        }

        videos.push({
          id: data.videoId,
          title: data.videoTitle || `Video ${data.videoId}`,
          thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.videoId}/mqdefault.jpg`,
          notes: notes,
          lastModified: data.lastModified,
          firstNoteTimestamp: firstNoteTimestamp,
          group: data.group,
          channelName: data.channelName,
          channelId: data.channelId
        });
      }

      // Apply sort order
      const videoOrder = await this.loadVideoOrder();
      const videoMap = new Map(videos.map(v => [v.id, v]));
      const orderedVideos: Video[] = [];

      videoOrder.forEach(id => {
        if (videoMap.has(id)) {
          orderedVideos.push(videoMap.get(id)!);
          videoMap.delete(id);
        }
      });

      const remainingVideos = [...videoMap.values()]
        .sort((a, b) => b.lastModified - a.lastModified);

      return [...remainingVideos, ...orderedVideos];
    } catch (error) {
      console.error('Failed to load saved videos:', error);
      throw new Error('Failed to load saved videos');
    }
  }

  /**
   * Overwrite all notes - delegates to NotesRepository which has safety measures
   */
  async overwriteAllNotes(notesByVideo: StoredVideoData[]): Promise<boolean> {
    try {
      // Import notesRepository to use the fixed implementation with auto-backup
      const { notesRepository } = await import('../storage/NotesRepository');
      const result = await notesRepository.overwriteAllNotes(notesByVideo);

      if (result) {
        showToast(languageService.translate("allNotesImportedSuccess"), 'success');
      } else {
        showToast(languageService.translate("allNotesImportedError"), 'error');
      }
      return result;
    } catch (error) {
      console.error('NoteStorage.overwriteAllNotes failed:', error);
      showToast(languageService.translate("allNotesImportedError"), 'error');
      return false;
    }
  }

  async clearAllNotes(): Promise<boolean> {
    try {
      await storageAdapter.clearAllNotes();
      this.cache.clear();
      showToast(languageService.translate("libraryCleared"), 'success');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  async saveVideoOrder(videoIds: string[]): Promise<boolean> {
    return await storageAdapter.set('videoOrder', videoIds);
  }

  async loadVideoOrder(): Promise<string[]> {
    const order = await storageAdapter.get<string[]>('videoOrder');
    return order || [];
  }

  async setRetentionDays(days: number): Promise<boolean> {
    const valueToStore = days === Infinity ? 99999 : days;
    this.retentionDays = days;

    // ✅ FIXED (Issue #3): Sync retention setting to cloud via SettingsService
    // This ensures the setting is preserved across devices and after reinstall
    try {
      await settingsService.update({ retentionDays: valueToStore });
    } catch (error) {
      console.warn('[NoteStorage] Failed to sync retention to cloud:', error);
    }

    return await storageAdapter.set('retentionDays', valueToStore);
  }

  async getRetentionDays(): Promise<number> {
    const days = await storageAdapter.get<number>('retentionDays');
    const value = days || this.retentionDays;
    return value === 99999 ? Infinity : value;
  }

  getPresetDefaultName(presetNumber: number): string {
    const presets = config.getPresets();
    return presets[presetNumber]?.name || `Preset ${presetNumber}`;
  }

  async handleVideoOpen(videoId: string, timestamp?: number): Promise<boolean> {
    let url = `https://www.youtube.com/watch?v=${videoId}`;
    if (timestamp) {
      url += `&t=${Math.floor(timestamp)}s`;
    }
    window.open(url, '_blank');
    return true;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Listener helpers
  addPresetListener(listener: (preset: number) => void): void { this.presetListeners.add(listener); }
  removePresetListener(listener: (preset: number) => void): void { this.presetListeners.delete(listener); }
  addTemplateListener(listener: () => void): void { this.templateListeners.add(listener); }
  removeTemplateListener(listener: () => void): void { this.templateListeners.delete(listener); }
  private notifyPresetListeners(preset: number): void { this.presetListeners.forEach(listener => listener(preset)); }
  private notifyTemplateListeners(): void { this.templateListeners.forEach(listener => listener()); }
  getDefaultTemplates(presetNumber: number): string[] { return this.defaultPresets[presetNumber] || this.defaultPresets[1]; }
}

export const noteStorage = new NoteStorage();

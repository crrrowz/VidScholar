// classes/NoteStorage.ts
import type { Note, Video, StoredVideoData } from '../types';
import { NoteCache } from './NoteCache';
import { NoteError } from './NoteError';
import config from '../utils/config';
import { getCurrentVideoId, getVideoTitle } from '../utils/video';
import { showToast } from '../utils/toast';
import { languageService } from '../services/LanguageService';
import { actions } from '../state/actions';

export class NoteStorage {
  private cache: NoteCache;
  private cacheTimeout: number;
  private retentionDays: number;
  private _initialized: boolean;
  private presetLock: boolean;
  private presetInitQueue: any[];
  private defaultPresets: { [key: number]: string[] };
  private presetListeners: Set<(preset: number) => void> = new Set();
  private templateListeners: Set<() => void> = new Set();

  constructor() {
    this.cache = new NoteCache();
    const storageConfig = config.getStorageConfig();
    this.cacheTimeout = storageConfig.cacheDuration;
    this.retentionDays = storageConfig.retentionDays;
    this._initialized = false;
    this.presetLock = false;
    this.presetInitQueue = [];
    
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
      await this._verifyStorageAccess();
      this._initialized = true;
      return true;
    } catch (error) {
      console.error('Storage initialization failed:', error);
      return false;
    }
  }

  private async _verifyStorageAccess(): Promise<boolean> {
    try {
      await chrome.storage.sync.get('test');
      return true;
    } catch (error) {
      console.error('Storage access verification failed:', error);
      throw new Error('Storage access denied');
    }
  }

  private async _acquirePresetLock(): Promise<void> {
    while (this.presetLock) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.presetLock = true;
  }

  private _releasePresetLock(): void {
    this.presetLock = false;
  }

  async getCurrentPreset(): Promise<number> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      const result = await chrome.storage.sync.get('current_preset');
      return result.current_preset || 1;
    } catch (error) {
      console.error('Failed to get current preset:', error);
      return 1;
    }
  }

  async savePresetTemplates(presetNumber: number, templates: string[]): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    await this._acquirePresetLock();
    try {
      const key = `preset_templates_${presetNumber}`;
      await chrome.storage.sync.set({ [key]: templates });
      this.notifyTemplateListeners();
      return true;
    } catch (error) {
      console.error('Failed to save preset templates:', error);
      throw error;
    } finally {
      this._releasePresetLock();
    }
  }

  async loadPresetTemplates(presetNumber: number): Promise<string[]> {
    if (!this._initialized) {
      await this.initialize();
    }

    await this._acquirePresetLock();
    try {
      const key = `preset_templates_${presetNumber}`;
      const result = await chrome.storage.sync.get(key);
      return result[key] || this.defaultPresets[presetNumber];
    } catch (error) {
      console.error('Failed to load preset templates:', error);
      return this.defaultPresets[presetNumber];
    } finally {
      this._releasePresetLock();
    }
  }

  async saveNotes(notes: Note[], group?: string | null, targetVideoId?: string, videoTitle?: string): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    const videoId = targetVideoId || getCurrentVideoId();
    if (!videoId) {
      throw new NoteError('Video ID not found', 'loading');
    }

    const storageKey = `notes_${videoId}`;

    // If the notes array is empty, remove the video entry from storage
    if (notes.length === 0) {
      try {
        await chrome.storage.sync.remove(storageKey);
        this.cache.delete(videoId);
        return true;
      } catch (error) {
        console.error('noteStorage.saveNotes: Failed to remove empty notes for', videoId, error);
        throw new NoteError('Failed to remove empty notes', 'network');
      }
    }

    // Otherwise, proceed with saving the non-empty notes
    try {
      const title = videoTitle || getVideoTitle(); // This will get the current video title, consider passing it if targetVideoId is different
      const dataToSave: StoredVideoData = {
        videoId: videoId,
        videoTitle: title,
        notes: notes,
        lastModified: Date.now(),
        group: group || undefined
      };
      
      await chrome.storage.sync.set({ [storageKey]: dataToSave });

      this.cache.set(videoId, notes);
      return true;
    } catch (error: any) {
      console.error('noteStorage.saveNotes: Failed to save notes for', videoId, error); // ENHANCED LOG
      throw new NoteError(
        'Failed to save notes',
        error.message.includes('quota') ? 'storage' : 'network'
      );
    }
  }

  async loadNotes(): Promise<Note[]> {
    const currentVideoId = getCurrentVideoId();
    if (!this._initialized) {
      await this.initialize();
    }

    const videoId = currentVideoId; // Use currentVideoId directly
    if (!videoId) {
      throw new NoteError('Video ID not found', 'loading');
    }

    const cachedNotes = this.cache.get(videoId);
    if (cachedNotes) {
      return cachedNotes;
    }

    try {
      const storageKey = `notes_${videoId}`;
      const result = await chrome.storage.sync.get(storageKey);
      const data = result[storageKey] as StoredVideoData;
      const notes = data?.notes || [];
      
      if (data?.group) {
        actions.setVideoGroup(data.group);
      } else {
        actions.setVideoGroup(null);
      }
      
      this.cache.set(videoId, notes);
      return notes;
    } catch (error: any) {
      console.error('noteStorage.loadNotes: Failed to load notes from storage for video:', videoId, error);
      throw new NoteError(
        'Failed to load notes from storage',
        error.message.includes('quota') ? 'storage' : 'network'
      );
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async savePresetNumber(number: number): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      await chrome.storage.sync.set({ 'current_preset': number });
      this.notifyPresetListeners(number);
      return true;
    } catch (error) {
      console.error('Failed to save preset number:', error);
      return false;
    }
  }

  addPresetListener(listener: (preset: number) => void): void {
    this.presetListeners.add(listener);
  }

  removePresetListener(listener: (preset: number) => void): void {
    this.presetListeners.delete(listener);
  }

  private notifyPresetListeners(preset: number): void {
    this.presetListeners.forEach(listener => listener(preset));
  }

  addTemplateListener(listener: () => void): void {
    this.templateListeners.add(listener);
  }

  removeTemplateListener(listener: () => void): void {
    this.templateListeners.delete(listener);
  }

  private notifyTemplateListeners(): void {
    this.templateListeners.forEach(listener => listener());
  }

  getDefaultTemplates(presetNumber: number): string[] {
    return this.defaultPresets[presetNumber] || this.defaultPresets[1];
  }

  async savePresetName(presetNumber: number, name: string): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      const key = `preset_name_${presetNumber}`;
      await chrome.storage.sync.set({ [key]: name });
    } catch (error) {
      console.error(`Failed to save preset name for preset ${presetNumber}:`, error);
      throw error;
    }
  }

  async loadPresetName(presetNumber: number): Promise<string | undefined> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      const key = `preset_name_${presetNumber}`;
      const result = await chrome.storage.sync.get(key);
      return result[key];
    } catch (error) {
      console.error(`Failed to load preset name for preset ${presetNumber}:`, error);
      return undefined;
    }
  }

  async saveVideoOrder(videoIds: string[]): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      await chrome.storage.sync.set({ videoOrder: videoIds });
      return true;
    } catch (error) {
      console.error('Failed to save video order:', error);
      return false;
    }
  }

  async loadVideoOrder(): Promise<string[]> {
    if (!this._initialized) {
      await this.initialize();
    }
    try {
      const result = await chrome.storage.sync.get('videoOrder');
      return result.videoOrder || [];
    } catch (error) {
      console.error('Failed to load video order:', error);
      return [];
    }
  }

  getPresetDefaultName(presetNumber: number): string {
    const presets = config.getPresets();
    return presets[presetNumber]?.name || `Preset ${presetNumber}`;
  }
  async setRetentionDays(days: number): Promise<boolean> {
    const storageConfig = config.getStorageConfig();
    const valueToStore = days === Infinity ? 99999 : days;

    if (valueToStore === 99999 || (days >= storageConfig.minRetentionDays && days <= storageConfig.maxRetentionDays)) {
      this.retentionDays = days;
      await chrome.storage.sync.set({ retentionDays: valueToStore });
      return true;
    }
    return false;
  }

  async getRetentionDays(): Promise<number> {
    try {
      const result = await chrome.storage.sync.get('retentionDays');
      const storedValue = result.retentionDays || this.retentionDays;
      return storedValue === 99999 ? Infinity : storedValue;
    } catch {
      return this.retentionDays;
    }
  }

  async loadSavedVideos(): Promise<Video[]> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      const retentionDays = await this.getRetentionDays();
      const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
      const currentTime = Date.now();

      const allData = await chrome.storage.sync.get(null);
      const videos: Video[] = [];

      for (const [key, value] of Object.entries(allData)) {
        if (!key.startsWith('notes_')) continue;

        const videoId = key.replace('notes_', '');
        const data = value as StoredVideoData; // Data from chrome.storage.sync
        const videoDate = data.lastModified || 0; // Use lastModified for retention check

        if (retentionDays !== Infinity && currentTime - videoDate > retentionPeriod) {
          await chrome.storage.sync.remove(key);
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
          thumbnail: `https://i.ytimg.com/vi/${data.videoId}/mqdefault.jpg`,
          notes: notes,
          lastModified: data.lastModified,
          firstNoteTimestamp: firstNoteTimestamp,
          group: data.group
        });
      }

      const videoOrder = await this.loadVideoOrder();
      const videoMap = new Map(videos.map(v => [v.id, v]));

      const orderedVideos: Video[] = [];
      videoOrder.forEach(id => {
        if (videoMap.has(id)) {
          orderedVideos.push(videoMap.get(id)!);
          videoMap.delete(id);
        }
      });

      const newVideos = [...videoMap.values()];
      newVideos.sort((a, b) => b.lastModified - a.lastModified);

      return [...newVideos, ...orderedVideos];
    } catch (error) {
      console.error('Failed to load saved videos:', error);
      throw new Error('Failed to load saved videos');
    }
  }

  async handleVideoOpen(videoId: string, timestamp?: number): Promise<boolean> {
    let url = `https://www.youtube.com/watch?v=${videoId}`;
    if (timestamp) {
      url += `&t=${Math.floor(timestamp)}s`;
    }
    window.open(url, '_blank');
    return true;
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      await chrome.storage.sync.remove(`notes_${videoId}`);
      this.cache.delete(videoId);

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
      console.error('Failed to delete video:', error);
      showToast(languageService.translate("failedToDeleteVideo"), 'error');
      return false;
    }
  }

  async deleteNote(noteId: string, videoId?: string): Promise<boolean> {
    const targetVideoId = videoId || getCurrentVideoId();
    if (!targetVideoId) {
      console.error("deleteNote: No video ID provided or found.");
      showToast(languageService.translate("failedToDeleteNote"), 'error');
      return false;
    }

    try {
      const notes = await this.loadNotes();
      const updatedNotes = notes.filter(note => note.timestamp !== noteId);
      
      await this.saveNotes(updatedNotes, targetVideoId);
      
      showToast(languageService.translate("noteDeleted"), 'success');
      return true;
    } catch (error) {
      console.error(`Failed to delete note ${noteId} from video ${targetVideoId}:`, error);
      showToast(languageService.translate("failedToDeleteNote"), 'error');
      return false;
    }
  }

  async overwriteAllNotes(notesByVideo: StoredVideoData[]): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      await this.clearAllNotes(); 
      this.cache.clear();

      const newStorageItems: { [key: string]: StoredVideoData } = {};
      for (const videoData of notesByVideo) {
        newStorageItems[`notes_${videoData.videoId}`] = {
          videoId: videoData.videoId,
          videoTitle: videoData.videoTitle,
          notes: videoData.notes,
          lastModified: videoData.lastModified || Date.now(),
          group: videoData.group
        };
      }
      await chrome.storage.sync.set(newStorageItems);
      showToast(languageService.translate("allNotesImportedSuccess"), 'success');
      return true;
    } catch (error) {
      console.error('overwriteAllNotes: Failed to overwrite all notes:', error);
      showToast(languageService.translate("allNotesImportedError"), 'error');
      return false;
    }
  }

  async clearAllNotes(): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      const allData = await chrome.storage.sync.get(null);
      const noteKeys = Object.keys(allData).filter(key => key.startsWith('notes_'));
      await chrome.storage.sync.remove(noteKeys);
      this.cache.clear();
      showToast(languageService.translate("libraryCleared"), 'success');
      return true;
    } catch (error) {
      console.error('Failed to clear all notes:', error);
      return false;
    }
  }
}

export const noteStorage = new NoteStorage();

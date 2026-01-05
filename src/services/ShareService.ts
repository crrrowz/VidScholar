// services/ShareService.ts
import config from '../utils/config';
import { getStore } from '../state/Store';
import { generateVideoUrl, getCurrentVideoId, getVideoTitle } from '../utils/video';
import { showToast } from '../utils/toast';
import type { Note, VideoNotesExport, AllNotesExport, StoredVideoData } from '../types';
import { languageService } from '../services/LanguageService';
import { settingsService } from './SettingsService';
import { noteStorage } from '../classes/NoteStorage';
import { showImportDecisionManager, ImportDecision, ImportDecisionModalOptions } from '../components/modals/ImportDecisionManager';
import { showConfirmDialog } from '../components/modals/ConfirmDialog';
import { actions } from '../state/actions'; // Correctly placed import

export class ShareService {
  private static instance: ShareService;
  private closeVideoManagerCallback: (() => void) | null = null;

  private constructor() { }

  public static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  public setCloseVideoManagerCallback(callback: (() => void) | null): void {
    this.closeVideoManagerCallback = callback;
  }

  private _shortenVideoTitle(title: string): string {
    if (!title) return '';
    const words = title.split(' ');
    if (words.length <= 2) return title;
    return `${words[0]} ${words[1]}...`;
  }

  async generateShareText(note: Note): Promise<string> {
    const videoUrl = await generateVideoUrl(note.timestamp);
    const hashtags = config.getHashtag();
    return `${note.text}\n\n${videoUrl}\n${hashtags}`;
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(languageService.translate("copiedLinkToClipboard"), 'success');
      return true;
    } catch (err) {
      console.error('Failed to copy: ', err);
      showToast(languageService.translate("failedToCopyLink"), 'error');
      return false;
    }
  }

  async shareNote(note: Note): Promise<void> {
    try {
      const shareText = await this.generateShareText(note);
      await this.copyToClipboard(shareText);
    } catch (error) {
      console.error('Failed to generate share text:', error);
      showToast(languageService.translate("failedToPrepareLink"), 'error');
    }
  }

  async copyAllNotes(notes: Note[]): Promise<void> {
    const sortedNotes = [...notes].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );

    const formattedText = await Promise.all(
      sortedNotes.map(async note => await this.generateShareText(note))
    );

    try {
      await navigator.clipboard.writeText(formattedText.join("\n\n"));
      showToast(languageService.translate("allNotesCopiedToClipboard"), "success");
    } catch (err) {
      console.error("Could not copy notes to clipboard: ", err);
      showToast(languageService.translate("failedToCopyNotesToClipboard"), "error");
    }
  }

  async exportNotesAsJson(notes: Note[], videoTitle: string, exportType: 'video_notes' | 'all_notes'): Promise<void> {
    let dataToExport: VideoNotesExport | AllNotesExport;
    let filename: string;

    if (exportType === 'video_notes') {
      const videoId = getCurrentVideoId();
      if (!videoId) {
        showToast(languageService.translate("exportErrorNoVideoId"), 'error');
        console.error('exportNotesAsJson: No video ID found for video_notes export.');
        return;
      }
      const currentVideoGroup = getStore().getState().currentVideoGroup;

      // Try to get channel info from storage or current page
      let channelName = '';
      let channelId = '';
      try {
        // If we are on the video page, try to grab them
        const { getChannelName, getChannelId } = await import('../utils/video');
        if (videoId === getCurrentVideoId()) {
          channelName = getChannelName() || '';
          channelId = getChannelId() || '';
        }
      } catch (e) { console.warn('Failed to load video utils in ShareService', e); }

      dataToExport = {
        type: "video_notes",
        videoId: videoId,
        videoTitle: videoTitle,
        notes: notes,
        group: currentVideoGroup || '',
        channelName: channelName || '',
        channelId: channelId || ''
      };
      filename = `${videoTitle}_notes.json`;
    } else { // exportType === 'all_notes'
      try {
        const allSavedVideos = await noteStorage.loadSavedVideos();
        console.log('ShareService Export Debug - Raw Videos:', allSavedVideos); // Debug log

        const notesByVideo: StoredVideoData[] = allSavedVideos.map(video => ({
          videoId: video.id,
          videoTitle: video.title,
          notes: video.notes,
          lastModified: video.lastModified,
          group: video.group || '',
          channelName: video.channelName || '',
          channelId: video.channelId || ''
        }));

        dataToExport = {
          type: "all_notes",
          notesByVideo: notesByVideo
        };
        console.log('ShareService Export Debug - Final Data:', dataToExport); // Debug log

        filename = `all_oshimemo_notes.json`;
      } catch (error) {
        console.error('exportNotesAsJson: Error loading saved videos for all_notes export:', error);
        showToast(languageService.translate("failedToExportNotes"), 'error');
        return;
      }
    }

    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showToast(languageService.translate("notesExportedSuccess"), 'success');
    } catch (error) {
      console.error('exportNotesAsJson: Error during download process:', error);
      showToast(languageService.translate("failedToExportNotes"), 'error');
    }
  }

  async importNotesFromJson(isGlobalImportUI: boolean = false, onAllNotesUpdateCallback?: (videos: StoredVideoData[]) => void): Promise<void> {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        showToast(languageService.translate("noFileSelected"), 'warning');
        return;
      }

      try {
        const fileContent = await file.text();
        const importedData: VideoNotesExport | AllNotesExport = JSON.parse(fileContent);
        const currentVideoId = getCurrentVideoId();

        let decisions: ImportDecision[] | null = null;

        if (importedData.type === 'video_notes') {
          if (isGlobalImportUI) {
            await showConfirmDialog({
              title: languageService.translate("videoImportNotAllowedTitle"),
              message: languageService.translate("videoImportNotAllowedHere"),
              confirmText: languageService.translate("ok"),
              hideCancelButton: true
            });
            return;
          }
          const data = importedData as VideoNotesExport;

          if (!data.videoId || !Array.isArray(data.notes) || !data.notes.every(note =>
            typeof note.timestamp === 'string' && typeof note.timestampInSeconds === 'number' && typeof note.text === 'string'
          )) {
            throw new Error(languageService.translate("invalidJsonFormat"));
          }

          if (data.videoId !== currentVideoId) {
            const importedVideoTitle = this._shortenVideoTitle(data.videoTitle || data.videoId);
            const currentVideoTitle = this._shortenVideoTitle(getVideoTitle() || currentVideoId || 'N/A');

            const confirmed = await showConfirmDialog({
              title: languageService.translate("importVideoIdMismatchTitle"),
              message: languageService.translate("importVideoIdMismatchMessage", [importedVideoTitle, currentVideoTitle]),
              confirmText: languageService.translate("openVideo"),
            });
            if (confirmed) {
              await noteStorage.saveNotes(data.notes, data.group, data.videoId, data.videoTitle, data.channelName, data.channelId);
              await noteStorage.handleVideoOpen(data.videoId);
            }
            return;
          }

          decisions = await showImportDecisionManager({
            type: 'video_notes',
            importedData: data,
            currentVideoId: currentVideoId
          });

          if (!decisions || decisions.length === 0 || decisions[0].action === 'skip') {
            showToast(languageService.translate("importCancelled"), 'info');
            return;
          }

          const decision = decisions[0];
          if (decision.action === 'replace') {
            await noteStorage.saveNotes(data.notes, data.group, data.videoId, data.videoTitle, data.channelName, data.channelId);
            actions.setNotes(data.notes);
            if (data.group) {
              actions.setVideoGroup(data.group);
            }
            showToast(languageService.translate("notesImportedSuccess"), 'success');
          } else if (decision.action === 'merge') {
            const existingNotes = await noteStorage.loadNotes();
            const mergedNotes = this.mergeNotes(existingNotes, data.notes);
            await noteStorage.saveNotes(mergedNotes, data.group, data.videoId, data.videoTitle, data.channelName, data.channelId);
            actions.setNotes(mergedNotes);
            if (data.group) {
              actions.setVideoGroup(data.group);
            }
            showToast(languageService.translate("notesMergeSuccess"), 'success');
          }

          if (data.group) {
            const currentGroups = settingsService.get('videoGroups');
            if (!currentGroups.includes(data.group)) {
              await settingsService.update({ videoGroups: [...currentGroups, data.group] });
            }
            actions.setVideoGroup(data.group);
          }

        } else if (importedData.type === 'all_notes') {
          if (!isGlobalImportUI) {
            await showConfirmDialog({
              title: languageService.translate("globalImportNotAllowedTitle"),
              message: languageService.translate("globalImportNotAllowedHere"),
              confirmText: languageService.translate("ok"),
              hideCancelButton: true
            });
            return;
          }
          const data = importedData as AllNotesExport;
          if (!Array.isArray(data.notesByVideo)) {
            throw new Error(languageService.translate("invalidJsonFormat"));
          }

          // Filter out invalid videos but keep valid ones
          const validNotesByVideo = data.notesByVideo.filter(videoData =>
            videoData.videoId && Array.isArray(videoData.notes) && videoData.notes.every(note =>
              typeof note.timestamp === 'string' && typeof note.timestampInSeconds === 'number' && typeof note.text === 'string'
            )
          );

          if (validNotesByVideo.length === 0 && data.notesByVideo.length > 0) {
            throw new Error(languageService.translate("invalidJsonFormat"));
          }

          if (validNotesByVideo.length < data.notesByVideo.length) {
            console.warn(`Skipped ${data.notesByVideo.length - validNotesByVideo.length} invalid video entries.`);
          }

          // Use the cleaned data
          data.notesByVideo = validNotesByVideo;

          const existingVideos = await noteStorage.loadSavedVideos();

          // Convert Video[] to StoredVideoData[] AND filter out invalid entries
          const existingAllNotes: StoredVideoData[] = existingVideos
            .filter(v => v.id && typeof v.id === 'string') // Critical filter
            .map(v => ({
              videoId: v.id,
              videoTitle: v.title,
              notes: v.notes,
              lastModified: v.lastModified,
              group: v.group,
              channelName: v.channelName,
              channelId: v.channelId
            }));

          decisions = await showImportDecisionManager({
            type: 'all_notes',
            importedData: data,
            existingAllNotes: existingAllNotes // Pass original Video[] if component expects it, or use existingAllNotes if compatible
          });

          if (!decisions || decisions.length === 0) {
            showToast(languageService.translate("importCancelled"), 'info');
            return;
          }

          const finalNotesCollection: StoredVideoData[] = [];
          const existingNotesMap = new Map<string, StoredVideoData>(existingAllNotes.map(video => [video.videoId, video]));

          for (const decision of decisions) {
            const importedVideoData = (importedData as AllNotesExport).notesByVideo.find(v => v.videoId === decision.videoId);
            if (!importedVideoData) continue;

            if (decision.action === 'replace') {
              finalNotesCollection.push(importedVideoData);
              existingNotesMap.delete(decision.videoId);
            } else if (decision.action === 'merge') {
              const existingVideoData = existingNotesMap.get(decision.videoId);

              if (existingVideoData) {
                const mergedNotesForVideo = this.mergeNotes(existingVideoData.notes, importedVideoData.notes);

                finalNotesCollection.push({
                  ...existingVideoData,
                  notes: mergedNotesForVideo,
                  channelName: existingVideoData.channelName || importedVideoData.channelName,
                  channelId: existingVideoData.channelId || importedVideoData.channelId
                });
                existingNotesMap.delete(decision.videoId);
              } else {
                finalNotesCollection.push(importedVideoData);
              }
            }
          }

          existingNotesMap.forEach(video => finalNotesCollection.push(video));

          await noteStorage.overwriteAllNotes(finalNotesCollection);

          const importedGroups = new Set<string>();
          finalNotesCollection.forEach(video => {
            if (video.group) {
              importedGroups.add(video.group);
            }
          });

          const currentGroups = settingsService.get('videoGroups');
          const newGroups = [...currentGroups];
          importedGroups.forEach(group => {
            if (!newGroups.includes(group)) {
              newGroups.push(group);
            }
          });

          if (newGroups.length > currentGroups.length) {
            await settingsService.update({ videoGroups: newGroups });
          }

          if (currentVideoId) {
            const currentVideoData = finalNotesCollection.find(v => v.videoId === currentVideoId);
            if (currentVideoData) {
              actions.setNotes(currentVideoData.notes);
              actions.setVideoGroup(currentVideoData.group || null);
            }
          }

          showToast(languageService.translate("allNotesMergeSuccess"), 'success');
          if (onAllNotesUpdateCallback) {
            const videos: Video[] = finalNotesCollection.map(videoData => {
              let firstNoteTimestamp: number | undefined = undefined;
              if (videoData.notes.length > 0) {
                firstNoteTimestamp = videoData.notes.reduce((min, note) => {
                  return note.timestampInSeconds < min ? note.timestampInSeconds : min;
                }, videoData.notes[0].timestampInSeconds);
              }
              return {
                id: videoData.videoId,
                title: videoData.videoTitle,
                thumbnail: `https://i.ytimg.com/vi/${videoData.videoId}/mqdefault.jpg`,
                notes: videoData.notes,
                lastModified: videoData.lastModified,
                firstNoteTimestamp: firstNoteTimestamp,
                group: videoData.group
              };
            });
            onAllNotesUpdateCallback(videos);
          }
          chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' }).catch(e => console.warn('Failed to send NOTES_UPDATED_GLOBALLY message:', e));

        } else {
          throw new Error(languageService.translate("unknownJsonType"));
        }
      } catch (error: any) {
        console.error('Error importing notes:', error);
        showToast(languageService.translate("notesImportError", [error.message]), 'error');
      } finally {
        fileInput.remove();
      }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
  }

  private mergeNotes(existingNotes: Note[], importedNotes: Note[]): Note[] {
    const mergedNotesMap = new Map<number, Note>();

    existingNotes.forEach(note => mergedNotesMap.set(note.timestampInSeconds, note));

    importedNotes.forEach(note => {
      mergedNotesMap.set(note.timestampInSeconds, note);
    });

    const finalNotes = Array.from(mergedNotesMap.values()).sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);
    return finalNotes;
  }
}

export const shareService = ShareService.getInstance();
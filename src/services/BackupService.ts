// src/services/BackupService.ts
import { noteStorage } from '../classes/NoteStorage';
import { settingsService } from './SettingsService';
import { encryptionService } from './EncryptionService';
import type { StoredVideoData } from '../types';

interface Backup {
  version: string;
  timestamp: number;
  encrypted: boolean;
  data: {
    videos: StoredVideoData[];
    settings: any;
    templates: Record<number, string[]>;
  };
}

interface BackupMetadata {
  id: string;
  timestamp: number;
  size: number;
  videosCount: number;
  notesCount: number;
  encrypted: boolean;
}

class BackupService {
  private readonly VERSION = '1.0.0';
  private readonly MAX_BACKUPS = 5;
  private readonly BACKUP_KEY_PREFIX = 'backup_';
  private readonly METADATA_KEY = 'backup_metadata';

  /**
   * Create full backup
   */
  async createBackup(password?: string): Promise<string> {
    try {
      // Collect all data
      const videos = await noteStorage.loadSavedVideos();
      const settings = settingsService.getSettings();
      const templates = await this.collectTemplates();

      const backup: Backup = {
        version: this.VERSION,
        timestamp: Date.now(),
        encrypted: !!password,
        data: { videos, settings, templates }
      };

      let backupData = JSON.stringify(backup);

      // Encrypt if password provided
      if (password) {
        backupData = await encryptionService.encrypt(backupData, password);
      }

      // Generate backup ID
      const backupId = `${this.BACKUP_KEY_PREFIX}${Date.now()}`;

      // Save backup
      await this.saveBackup(backupId, backupData);

      // Update metadata
      await this.addMetadata({
        id: backupId,
        timestamp: backup.timestamp,
        size: backupData.length,
        videosCount: videos.length,
        notesCount: videos.reduce((sum, v) => sum + v.notes.length, 0),
        encrypted: backup.encrypted
      });

      // Cleanup old backups
      await this.cleanupOldBackups();

      return backupId;
    } catch (error) {
      throw new Error('Backup creation failed: ' + (error as Error).message);
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string, password?: string): Promise<void> {
    try {
      // Load backup data
      let backupData = await this.loadBackup(backupId);

      if (!backupData) {
        throw new Error('Backup not found');
      }

      // Decrypt if needed
      if (password) {
        backupData = await encryptionService.decrypt(backupData, password);
      }

      const backup: Backup = JSON.parse(backupData);

      // Verify version compatibility
      if (!this.isCompatibleVersion(backup.version)) {
        throw new Error('Incompatible backup version');
      }

      // Restore data
      await this.restoreData(backup.data);
    } catch (error) {
      throw new Error('Backup restore failed: ' + (error as Error).message);
    }
  }

  /**
   * Get all backup metadata
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const metadata = await this.loadMetadata();
    return metadata.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    await this.removeBackup(backupId);
    await this.removeMetadata(backupId);
  }

  /**
   * Export backup to file
   */
  async exportBackup(backupId: string): Promise<void> {
    const backupData = await this.loadBackup(backupId);
    if (!backupData) {
      throw new Error('Backup not found');
    }

    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oshimemo-backup-${backupId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import backup from file
   */
  async importBackup(file: File, password?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const backupData = e.target?.result as string;
          
          // Generate new backup ID
          const backupId = `${this.BACKUP_KEY_PREFIX}${Date.now()}`;
          
          // Verify and save
          let data = backupData;
          if (password) {
            // Verify decryption works
            data = await encryptionService.decrypt(backupData, password);
          }
          
          const backup: Backup = JSON.parse(data);
          
          await this.saveBackup(backupId, backupData);
          await this.addMetadata({
            id: backupId,
            timestamp: backup.timestamp,
            size: backupData.length,
            videosCount: backup.data.videos.length,
            notesCount: backup.data.videos.reduce((sum, v) => sum + v.notes.length, 0),
            encrypted: backup.encrypted
          });
          
          resolve(backupId);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Auto backup if enabled
   */
  async autoBackup(): Promise<void> {
    const settings = settingsService.getSettings();
    if (!settings.enableAutoBackup) return;

    const backups = await this.listBackups();
    const lastBackup = backups[0];

    // Check if need backup (once per day)
    if (!lastBackup || Date.now() - lastBackup.timestamp > 24 * 60 * 60 * 1000) {
      await this.createBackup();
    }
  }

  private async collectTemplates(): Promise<Record<number, string[]>> {
    const templates: Record<number, string[]> = {};
    for (let i = 1; i <= 3; i++) {
      templates[i] = await noteStorage.loadPresetTemplates(i);
    }
    return templates;
  }

  private async restoreData(data: Backup['data']): Promise<void> {
    // Restore videos
    for (const video of data.videos) {
      await noteStorage.saveVideoData(video);
    }

    // Restore settings
    await settingsService.update(data.settings);

    // Restore templates
    for (const [preset, templates] of Object.entries(data.templates)) {
      await noteStorage.savePresetTemplates(parseInt(preset), templates);
    }
  }

  private isCompatibleVersion(version: string): boolean {
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.VERSION.split('.').map(Number);
    return major === currentMajor;
  }

  private async saveBackup(id: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [id]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private async loadBackup(id: string): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([id], (result) => {
        resolve(result[id] || null);
      });
    });
  }

  private async removeBackup(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([id], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private async loadMetadata(): Promise<BackupMetadata[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.METADATA_KEY], (result) => {
        resolve(result[this.METADATA_KEY] || []);
      });
    });
  }

  private async addMetadata(metadata: BackupMetadata): Promise<void> {
    const current = await this.loadMetadata();
    current.push(metadata);
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.METADATA_KEY]: current }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private async removeMetadata(backupId: string): Promise<void> {
    const current = await this.loadMetadata();
    const filtered = current.filter(m => m.id !== backupId);
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.METADATA_KEY]: filtered }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    
    if (backups.length > this.MAX_BACKUPS) {
      const toDelete = backups.slice(this.MAX_BACKUPS);
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }
}

export const backupService = new BackupService();
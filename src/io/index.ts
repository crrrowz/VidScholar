/**
 * IO Module - Export & Import Services
 * 
 * This module provides unified services for data export and import operations.
 * 
 * @example
 * import { exportService, importService } from '@/io';
 * 
 * // Export current video notes
 * await exportService.exportCurrentVideoNotes({ format: 'json' });
 * 
 * // Export all notes as markdown
 * await exportService.exportAllNotes({ format: 'markdown' });
 * 
 * // Create full backup
 * await exportService.exportFullBackup({ password: 'secret' });
 * 
 * // Import from file
 * await importService.importFromFile({ isGlobalUI: true });
 */

// Export Service
export {
    exportService,
    type ExportFormat,
    type ExportOptions,
    type FullBackup
} from './ExportService';

// Import Service
export {
    importService,
    type ImportResult,
    type ImportOptions
} from './ImportService';

# Zone: Import/Export Data Flow Consolidation

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Import/Export zone handles bidirectional data transformation - converting internal note data to exportable formats (JSON, Markdown, plain text) and importing external data back into the application. This includes file picking, format detection, validation, encryption/decryption, and conflict resolution during imports.

**How it emerges from the current codebase:**
Three distinct locations handle import/export with overlapping logic:
- `src/io/ExportService.ts` (454 lines) - "Centralized" export
- `src/io/ImportService.ts` (583 lines) - "Centralized" import  
- `src/services/ShareService.ts` (429 lines) - Has its own `exportNotesAsJson()` and `importNotesFromJson()`

Additionally, `BackupService.ts` has its own export/import methods that bypass the IO layer.

---

## 2️⃣ Evidence From Code

### Overlapping Export Implementations

**ExportService.ts:**
```typescript
// src/io/ExportService.ts:100-125
async exportVideoAsJson(videoId, videoTitle, notes, group?, channelName?, channelId?): Promise<void> {
  const exportData: VideoNotesExport = {
    type: 'video_notes',
    version: this.VERSION,
    exportDate: new Date().toISOString(),
    videoId,
    videoTitle,
    videoUrl: `https://youtube.com/watch?v=${videoId}`,
    notes,
    group: group || undefined,
    channelName: channelName || undefined,
    channelId: channelId || undefined
  };
  await this.downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
}
```

**ShareService.ts:**
```typescript  
// src/services/ShareService.ts:85-162
async exportNotesAsJson(notes: Note[], videoTitle: string, exportType): Promise<void> {
  // Very similar structure but with slight differences
  const exportData = {
    type: exportType,
    version: '1.0.0',  // Different version format!
    exportDate: new Date().toISOString(),
    // ... same fields
  };
  // Uses same download approach
}
```

**BackupService.ts:**
```typescript
// src/services/BackupService.ts:129-145
async exportBackup(backupId: string): Promise<void> {
  // Completely separate export path
  const backup = await this.loadBackup(backupId);
  const blob = new Blob([backup], { type: 'application/json' });
  // Manual download implementation
}
```

### Overlapping Import Implementations

**ImportService.ts:**
```typescript
// src/io/ImportService.ts:73-97
async pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
```

**ShareService.ts:**
```typescript
// src/services/ShareService.ts:164-180 (approximate)
async importNotesFromJson(isGlobalImportUI = false, onCallback?): Promise<void> {
  // Builds its own file picker
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  // Nearly identical file reading logic
}
```

**BackupService.ts:**
```typescript
// src/services/BackupService.ts:147-189
async importBackup(file: File, password?: string): Promise<string> {
  // Yet another file reading implementation
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => { /* process */ };
    reader.readAsText(file);
  });
}
```

### Duplicate Validation Logic

Both `ImportService` and `ShareService` validate the same data structures:

```typescript
// ImportService.ts:498-512
validateVideoNotesData(data: any): data is VideoNotesExport {
  return data &&
    data.type === 'video_notes' &&
    typeof data.videoId === 'string' &&
    typeof data.videoTitle === 'string' &&
    Array.isArray(data.notes);
}

// ShareService has inline validation with same checks
```

---

## 3️⃣ Current Problems

### Code Duplication
- **File picker logic**: Implemented 3 times independently
- **FileReader usage**: 3 separate Promise-wrapped implementations
- **Download logic**: 2-3 implementations (Blob creation + anchor click)
- **Validation**: Same type guards duplicated

### Version Inconsistency
```typescript
// ExportService uses
private readonly VERSION = '2.0.0';

// ShareService uses
version: '1.0.0';

// BackupService uses
private readonly VERSION = '1.0.0';
```

Exported files from different paths have different version fields!

### Unclear Entry Points
- Should components use `exportService.exportAllNotes()` or `shareService.exportNotesAsJson()`?
- Both exist, both work, no guidance on which is canonical
- Import has 3 possible entry points

### Missing Unified Format Detection
```typescript
// ImportService.ts:115-151 - processImport()
// Manual if/else chain for format detection
if (this.isFullBackup(data)) { ... }
else if (this.isVideoNotesExport(data)) { ... }
else if (this.isAllNotesExport(data)) { ... }
```

This should be a pluggable format registry.

---

## 4️⃣ Unification & Merge Opportunities

### Extractable Primitives

| Duplicate Logic | Unified Primitive |
|-----------------|-------------------|
| 3 file pickers | `filePicker(accept): Promise<File>` |
| 3 file readers | `readFileAsText(file): Promise<string>` |
| 3 download implementations | `downloadAsFile(content, filename, mimeType)` |
| 3 validations | `validateImportData(data): ValidationResult` |
| 3 version strings | `EXPORT_VERSION` constant |

### Format Strategy Pattern

```typescript
// Proposed: Pluggable format handlers
interface ExportFormat {
  id: string;
  mimeType: string;
  extension: string;
  export(videos: Video[]): string;
}

interface ImportFormat {
  id: string;
  detect(data: unknown): boolean;
  parse(content: string): ImportResult;
}

// Formats as plugins
const formats: ExportFormat[] = [
  new JsonExportFormat(),
  new MarkdownExportFormat(),
  new PlainTextExportFormat()
];
```

### Consolidation Candidate

```typescript
// Single export function with format option
async function exportNotes(options: ExportOptions): Promise<void> {
  const { scope, format, encrypt } = options;
  
  const data = scope === 'current' 
    ? await getStore().getState().notes
    : await notesRepository.loadAllVideos();
    
  const formatted = formats.get(format).export(data);
  const output = encrypt ? await encrypt(formatted) : formatted;
  
  await downloadAsFile(output, generateFilename(scope, format), format.mimeType);
}
```

---

## 5️⃣ Proposed Target Shape

```
src/io/
├── core/                      # NEW: Shared primitives
│   ├── filePicker.ts          # Universal file picker
│   ├── fileReader.ts          # Promise-wrapped FileReader
│   ├── fileDownload.ts        # Blob + anchor download
│   └── types.ts               # Shared IO types
│
├── formats/                   # NEW: Format handlers
│   ├── FormatRegistry.ts      # Plugin registration
│   ├── json/
│   │   ├── JsonExporter.ts
│   │   └── JsonImporter.ts
│   ├── markdown/
│   │   └── MarkdownExporter.ts
│   ├── text/
│   │   └── TextExporter.ts
│   └── backup/
│       ├── BackupExporter.ts  # Moved from BackupService
│       └── BackupImporter.ts
│
├── ExportService.ts           # SIMPLIFIED: Orchestrates formats
├── ImportService.ts           # SIMPLIFIED: Orchestrates formats
└── index.ts
```

### Share Service After Cleanup

```typescript
// src/services/ShareService.ts - SIMPLIFIED
import { exportService, importService } from '../io';

class ShareService {
  // Delegates instead of duplicating
  async exportNotes(notes: Note[], title: string, type: ExportType): Promise<void> {
    return exportService.exportVideoNotes({ notes, title, type });
  }
  
  async importNotes(isGlobal: boolean, callback?: Function): Promise<void> {
    return importService.importFromFile({ global: isGlobal, onUpdate: callback });
  }
  
  // Keep only share-specific logic (clipboard, Twitter link generation)
  async shareNote(note: Note): Promise<void> { ... }
  async copyToClipboard(text: string): Promise<boolean> { ... }
}
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Extract Core Utilities (No Breaking Changes)
1. Create `src/io/core/filePicker.ts` - extract from ImportService
2. Create `src/io/core/fileReader.ts` - extract from ImportService
3. Create `src/io/core/fileDownload.ts` - extract from ExportService
4. Create `src/io/core/types.ts` - shared type definitions

### Phase 2: Unify Version & Constants
5. Create `src/io/version.ts` with single `EXPORT_VERSION`
6. Update all services to import version from this location
7. Add version migration notes to types

### Phase 3: Create Format Registry
8. Create `src/io/formats/FormatRegistry.ts`
9. Move JSON export logic to `JsonExporter.ts`
10. Move Markdown export logic to `MarkdownExporter.ts`
11. Move text export logic to `TextExporter.ts`

### Phase 4: Simplify Services
12. Update `ExportService.ts` to use core utilities + registry
13. Update `ImportService.ts` to use core utilities + registry
14. Update `ShareService.ts` to delegate to IO services
15. Move backup-specific logic from `BackupService` to formats

### Phase 5: Cleanup & Documentation
16. Remove duplicate code from ShareService
17. Remove duplicate code from BackupService
18. Update barrel exports
19. Document format extension points

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Download behavior**: Browser security may handle Blob URLs differently
- **File picker**: Different behavior in different browsers
- **Encrypted backups**: Password prompt flow must be preserved

### Validation Strategy

1. **Export Tests**:
   - [ ] Export current video as JSON → valid JSON with correct schema
   - [ ] Export all notes as JSON → valid JSON with all videos
   - [ ] Export as Markdown → readable formatting
   - [ ] Export as Text → plain text with timestamps
   - [ ] Export encrypted backup → decryption works

2. **Import Tests**:
   - [ ] Import single video JSON → notes appear in sidebar
   - [ ] Import all notes JSON → ImportDecisionManager shows correctly
   - [ ] Import old format (v1.0.0) → migrated correctly
   - [ ] Import encrypted backup → password prompt works
   - [ ] Import invalid file → error message shown

3. **Round-Trip Tests**:
   - [ ] Export → Close extension → Reimport → Identical data
   - [ ] Export from version N → Upgrade → Import → Works

### Format Compatibility
- Must parse both `version: '1.0.0'` and `version: '2.0.0'` exports
- Add migration logic for any structural changes
- Include `type` field to distinguish video_notes/all_notes/backup

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| File picker implementations | 3 | 1 |
| FileReader implementations | 3 | 1 |
| Download implementations | 3 | 1 |
| Version constants | 3 different | 1 unified |
| Total IO + Share lines | ~1,466 | ~900 |
| Format extensibility | None | Plugin registry |

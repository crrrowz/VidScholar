# 14 - UI Toast and Feedback Centralization

## 🎯 Zone Definition

### What This Zone Represents
The **UI Feedback Zone** encompasses all user-facing transient feedback:
- **Toast notifications** (success, error, warning, info)
- **Translation integration** for messages
- **Sound notifications**
- **Confirmation dialogs**

Currently, feedback is initiated from **deep within service layers**, coupling business logic to UI concerns.

### How It Emerged
As features were added, each service started showing its own feedback:
- `NoteStorage` shows toasts for delete/save results
- `ShareService` shows toasts for copy/export results
- `NotesRepository` logs but doesn't show toasts
- `SettingsService` shows nothing

This creates **inconsistent user feedback** depending on which layer handles the operation.

---

## 📊 Evidence From Code

### 1. Deep Toast Coupling in Storage Layer

```typescript
// NoteStorage.ts - Lines 395-396
deleteNote(noteId: string): Promise<boolean> {
  // ...
  if (success) {
    showToast(languageService.translate("noteDeleted"), 'success');  // ← UI in storage!
  }
}

// NoteStorage.ts - Lines 399-400
catch (error) {
  showToast(languageService.translate("failedToDeleteNote"), 'error');  // ← UI in storage!
}

// NoteStorage.ts - Lines 503, 505, 510
async overwriteAllNotes(): Promise<boolean> {
  if (result) {
    showToast(languageService.translate("allNotesImportedSuccess"), 'success');
  } else {
    showToast(languageService.translate("allNotesImportedError"), 'error');
  }
}

// NoteStorage.ts - Line 519
async clearAllNotes(): Promise<boolean> {
  showToast(languageService.translate("libraryCleared"), 'success');
}
```

Storage classes are making **UI decisions**.

### 2. Inconsistent Feedback by Layer

| Operation | NoteStorage | NotesRepository | StorageAdapter |
|-----------|-------------|-----------------|----------------|
| Save note | No toast | No toast | No toast |
| Delete note | Toast | No toast | No toast |
| Import all | Toast | Log only | No feedback |
| Clear all | Toast | No toast | No toast |
| Cloud sync | - | - | Toast on init only |

Different layers behave differently for the same outcome.

### 3. Translation Scattered Through Services

```typescript
// NoteStorage.ts
languageService.translate("noteDeleted")
languageService.translate("failedToDeleteNote")
languageService.translate("libraryCleared")
// ... 5 more calls

// ShareService.ts
languageService.translate("copiedLinkToClipboard")
languageService.translate("failedToCopyLink")
languageService.translate("notesExportedSuccess")
// ... 15+ more calls

// VideoManager.ts
languageService.translate("videoDeleted")
languageService.translate("deleteVideoConfirm")
// ... 10+ more calls
```

Every file imports `languageService` and calls `translate()` inline.

### 4. Sound Notification Isolated

```typescript
// NoteNotificationService.ts - Lines 146-177
private playSound(): void {
  // Standalone Audio API implementation
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const osc = ctx.createOscillator();
  // ... 30 lines of sound generation
}
```

Sound is hardcoded in one service, not reusable.

---

## ⚠️ Current Problems

### Problem 1: UI Logic in Storage Layer
```typescript
// Business logic shouldn't know about UI
class NoteStorage {
  async deleteNote() {
    // ... delete logic
    showToast(...);  // ← Violates separation of concerns
  }
}
```

**Impact**: Can't use `NoteStorage` in headless/test context without mocking `showToast`.

### Problem 2: No Feedback Customization
```typescript
// Cannot suppress toasts for batch operations:
for (const video of videos) {
  await noteStorage.deleteVideo(video.id);  // Shows toast each time!
}
// User sees 50 toasts in sequence
```

### Problem 3: No Feedback Aggregation
```typescript
// Import 10 videos:
// Shows: "Imported successfully" once
// But delete 10 videos:
// Shows: "Deleted" × 10 times
```

### Problem 4: Translation Key Duplication Risk
```typescript
// If translation key changes:
// Must find and update ALL locations manually
languageService.translate("noteDeleted")  // In NoteStorage
languageService.translate("noteDeleted")  // Maybe in another file too?
```

---

## 🔧 Unification & Merge Opportunities

### Opportunity 1: Notification Service
A dedicated service that owns all user feedback:
```typescript
notificationService.success('noteDeleted');
notificationService.error('deleteNoteFailed', { noteId });
```

### Opportunity 2: Silent Mode Option
Allow callers to suppress feedback for batch operations:
```typescript
await storage.deleteVideo(id, { silent: true });
```

### Opportunity 3: Feedback Aggregator
```typescript
const batch = notificationService.batch();
for (const video of videos) {
  await storage.deleteVideo(video.id);
  batch.add('deleted', video.title);
}
batch.commit();  // Shows: "Deleted 10 videos"
```

### Opportunity 4: Sound Abstraction
```typescript
notificationService.playSound('ping');
notificationService.playSound('success');
```

---

## 🏗️ Proposed Target Shape

### After Refactoring

```
src/
├── feedback/
│   ├── NotificationService.ts  # Unified feedback service
│   ├── NotificationTypes.ts    # Type definitions
│   ├── SoundManager.ts         # Audio feedback
│   └── translations.ts         # Centralized translation keys
│
├── classes/
│   └── NoteStorage.ts          # No more toast calls
│
├── services/
│   └── ShareService.ts         # No more toast calls
```

### Key Interfaces

```typescript
// NotificationTypes.ts
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  sound?: boolean;           // Play sound?
  duration?: number;         // Auto-dismiss time
  action?: {                 // Optional action button
    label: string;
    onClick: () => void;
  };
}

// NotificationService.ts
export class NotificationService {
  private static instance: NotificationService;
  private soundManager = new SoundManager();
  private batchQueue: string[] = [];
  private isBatching = false;
  
  static getInstance(): NotificationService;
  
  // Core methods
  success(messageKey: string, params?: Record<string, any>, options?: NotificationOptions): void {
    this.show('success', messageKey, params, options);
  }
  
  error(messageKey: string, params?: Record<string, any>, options?: NotificationOptions): void {
    this.show('error', messageKey, params, options);
  }
  
  warning(messageKey: string, params?: Record<string, any>, options?: NotificationOptions): void {
    this.show('warning', messageKey, params, options);
  }
  
  info(messageKey: string, params?: Record<string, any>, options?: NotificationOptions): void {
    this.show('info', messageKey, params, options);
  }
  
  private show(
    type: NotificationType,
    messageKey: string,
    params?: Record<string, any>,
    options?: NotificationOptions
  ): void {
    if (this.isBatching) {
      this.batchQueue.push(messageKey);
      return;
    }
    
    const message = languageService.translate(messageKey, params);
    showToast(message, type);
    
    if (options?.sound) {
      this.soundManager.play(type);
    }
  }
  
  // Batch operations
  startBatch(): void {
    this.isBatching = true;
    this.batchQueue = [];
  }
  
  endBatch(summaryKey?: string): void {
    this.isBatching = false;
    const count = this.batchQueue.length;
    if (count > 0 && summaryKey) {
      this.success(summaryKey, { count });
    }
    this.batchQueue = [];
  }
  
  // Context-specific helpers
  operationResult(success: boolean, successKey: string, errorKey: string): void {
    if (success) {
      this.success(successKey);
    } else {
      this.error(errorKey);
    }
  }
}

// SoundManager.ts
export class SoundManager {
  private audioContext: AudioContext | null = null;
  
  play(type: 'success' | 'error' | 'warning' | 'ping'): void {
    if (!this.isEnabled()) return;
    
    const frequencies: Record<string, number[]> = {
      success: [523, 659],    // C5 → E5 (pleasant)
      error: [330, 262],       // E4 → C4 (descending)
      warning: [392],          // G4 (single tone)
      ping: [523, 1046]        // C5 → C6 (the existing ping)
    };
    
    // ... audio generation logic
  }
  
  private isEnabled(): boolean {
    return settingsService.get('noteNotificationSound') ?? true;
  }
}

// translations.ts - Centralized keys
export const NotificationKeys = {
  // Note operations
  NOTE_SAVED: 'noteSaved',
  NOTE_DELETED: 'noteDeleted',
  NOTE_DELETE_FAILED: 'failedToDeleteNote',
  
  // Video operations
  VIDEO_DELETED: 'videoDeleted',
  VIDEO_DELETE_FAILED: 'failedToDeleteVideo',
  
  // Import/Export
  IMPORT_SUCCESS: 'notesImportedSuccess',
  IMPORT_ERROR: 'notesImportError',
  EXPORT_SUCCESS: 'notesExportedSuccess',
  
  // Clipboard
  COPIED: 'copiedLinkToClipboard',
  COPY_FAILED: 'failedToCopyLink',
  
  // Library
  LIBRARY_CLEARED: 'libraryCleared',
  
  // Batch
  BATCH_DELETED: 'batchDeleted',  // "Deleted {count} items"
} as const;
```

### Usage After Refactoring

```typescript
// NoteStorage.ts - BEFORE
showToast(languageService.translate("noteDeleted"), 'success');

// NoteStorage.ts - AFTER (option 1: no feedback)
// Simply don't call notification - let caller decide

// Caller - AFTER
const result = await noteStorage.deleteNote(id);
if (result) {
  notificationService.success(NotificationKeys.NOTE_DELETED);
}

// Batch operations
notificationService.startBatch();
for (const video of videos) {
  await noteStorage.deleteVideo(video.id);
}
notificationService.endBatch(NotificationKeys.BATCH_DELETED);
// Shows: "Deleted 10 items"

// With sound
notificationService.success(NotificationKeys.NOTE_SAVED, undefined, { sound: true });
```

---

## 📋 Refactoring Plan

### Phase 1: Create Notification Infrastructure (Low Risk)
1. Create `src/feedback/NotificationTypes.ts`
2. Create `src/feedback/SoundManager.ts` (extract from NoteNotificationService)
3. Create `src/feedback/NotificationService.ts`
4. **Test**: Unit tests for service

### Phase 2: Create Translation Keys Registry (Low Risk)
1. Create `src/feedback/translations.ts`
2. Document all existing notification keys
3. Make `NotificationKeys` constant
4. **Test**: All keys resolve correctly

### Phase 3: Migrate NoteStorage (Medium Risk)
1. Remove `showToast` calls from `NoteStorage`
2. Update callers to use `notificationService`
3. **Test**: Delete note still shows toast

### Phase 4: Migrate ShareService (Medium Risk)
1. Remove `showToast` calls from `ShareService`
2. Update import/export flows to use `notificationService`
3. **Test**: Import/export feedback works

### Phase 5: Add Batch Support (Medium Risk)
1. Update VideoManager batch delete to use batching
2. Update import flows to aggregate feedback
3. **Test**: Batch operations show single summary

### Phase 6: Cleanup
1. Remove direct `showToast` imports from services
2. Consolidate all feedback through `notificationService`
3. Update NoteNotificationService to use SoundManager

---

## ⚠️ Risk & Validation Notes

### High Risk Areas
1. **Missing feedback** - Ensure all operations still notify
2. **Translation key mismatches** - Keys must exist in language files
3. **Sound on main thread** - Audio API must not block

### Validation Checklist
- [ ] Delete note → shows success toast
- [ ] Delete note fails → shows error toast
- [ ] Export notes → shows success toast
- [ ] Import notes → shows success toast
- [ ] Batch delete 5 videos → shows "Deleted 5 items"
- [ ] Sound enabled → plays on notification
- [ ] Sound disabled → silent operation

### Migration Safety
Old code continues to work during transition:
```typescript
// Old way still works
showToast(languageService.translate("noteDeleted"), 'success');

// New way
notificationService.success('noteDeleted');
```

---

## 📈 Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `showToast` call sites | 25+ | 1 | -96% |
| `languageService.translate` imports | 8+ files | 1 file | -87% |
| Batch feedback | None | Full | New capability |
| Sound management locations | 1 | 1 (unified) | Centralized |
| UI coupling in storage | High | None | Eliminated |

### Developer Experience
```typescript
// Before: Manual construction
showToast(languageService.translate("operationFailed", [error.message]), 'error');

// After: Simple API
notificationService.error('operationFailed', { message: error.message });
```

---

*Last updated: 2026-01-08*

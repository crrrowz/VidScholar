# 10 - Note Lifecycle Unification

## 🎯 Zone Definition

### What This Zone Represents
The **Note Lifecycle Zone** encompasses all operations related to a note's journey:
- **Creation** (from floating button, sidebar, import)
- **Modification** (editing text, updating metadata)
- **Deletion** (single note, video deletion, bulk clear)
- **Notification** (playback-triggered display)

These operations are scattered across **5+ files** with duplicated validation logic, timestamp handling, and conflict detection.

### How It Emerged
The code reveals three historical additions that created fragmentation:
1. **Original sidebar** created notes directly via `actions.addNote()`
2. **Floating button** added its own note creation with duplicate conflict logic
3. **NoteActionsService** was introduced to centralize - but only partially adopted

---

## 📊 Evidence From Code

### 1. Duplicate Conflict Detection Threshold

```typescript
// NoteActionsService.ts - Line 18
const DUPLICATE_THRESHOLD = 10; // seconds

// FloatingNoteButton (in content/) - similar constant
const DUPLICATE_THRESHOLD = 10;

// MainToolbar/AddNoteButton - similar pattern
```

The same "10 seconds" threshold is defined in multiple places.

### 2. Multiple Note Creation Paths

**Path 1: NoteActionsService (intended centralized)**
```typescript
// NoteActionsService.ts - Lines 46-107
async createNote(options: CreateNoteOptions): Promise<CreateNoteResult> {
  const newNote: Note = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: formatTimestamp(timestamp),
    ...
  };
  actions.addNote(newNote);
  await actions.saveNotes();
}
```

**Path 2: Direct actions.addNote usage**
```typescript
// ShareService.ts - Line 236
actions.setNotes(data.notes);  // Bypasses NoteActionsService entirely

// ImportDecisionManager.ts
// Also manipulates notes directly
```

**Path 3: Import with manual ID assignment**
```typescript
// NotesRepository.ts - Lines 613-621
private ensureNoteId(note: Note): Note {
  if (!note.id) {
    return { ...note, id: generateNoteId() };  // Different ID generation!
  }
}
```

Three different ID generation strategies:
1. `note-${Date.now()}-${random}` (NoteActionsService)
2. UUID v4 via `generateNoteId()` (NotesRepository)
3. No ID at all (some old imports)

### 3. Notification Service Coupling

```typescript
// NoteActionsService.ts - Line 77
noteNotificationService.suppressNotifications();  // Tightly coupled

// InlineNoteForm (video component)
// Has its own note manipulation without suppression
```

The notification suppression is in `NoteActionsService` but not in other paths.

### 4. Save Coordination Split

```typescript
// NoteActionsService.ts
await actions.saveNotes();  // Uses actions layer

// VideoManager.ts (in line editing)
await noteStorage.saveNotes(...);  // Uses storage layer directly

// ShareService.ts (after import)
await noteStorage.saveNotes(mergedNotes, ...);  // Also direct
```

Three different "save" approaches after modifying notes.

---

## ⚠️ Current Problems

### Problem 1: Inconsistent Note IDs
Notes created via `NoteActionsService` use one format:
```
note-1704729600000-a1b2c3d4e
```

Notes from `NotesRepository.ensureNoteId()` use UUID:
```
550e8400-e29b-41d4-a716-446655440000
```

**Impact**: ID-based lookups may fail when mixing sources.

### Problem 2: Bypassed Conflict Detection
When notes are imported via `ShareService`, the conflict detection in `NoteActionsService` is bypassed entirely.

```typescript
// ShareService.ts - Line 236
await noteStorage.saveNotes(data.notes, ...);  // No conflict check!
```

**Impact**: Import can create duplicate notes at same timestamp.

### Problem 3: Suppression Only Works for One Path
```typescript
// NoteActionsService.ts
noteNotificationService.suppressNotifications();  // Only here

// But if note is added via VideoManager inline edit:
// NO suppression - notification might fire immediately
```

### Problem 4: Scroll/Focus Logic Duplication
```typescript
// NoteActionsService.ts - Lines 93-95
if (scrollToNote) {
  setTimeout(() => scrollToNewNote(newNote.timestamp), 100);
}

// InlineNoteForm - similar setTimeout pattern
// VideoManager - similar pattern when editing
```

---

## 🔧 Unification & Merge Opportunities

### Opportunity 1: Unified Note Factory
Create a single `NoteFactory.create()` method:
```typescript
const note = NoteFactory.create({
  timestamp: 125,
  text: 'My note'
});
// Always uses UUID, always has consistent format
```

### Opportunity 2: Lifecycle Hooks
```typescript
class NoteLifecycle {
  onCreate(note: Note) {
    noteNotificationService.suppressNotifications();
    scrollToNewNote(note.timestamp);
  }
  
  onDelete(note: Note) {
    // cleanup
  }
}
```

### Opportunity 3: Single Save Coordinator
All modifications go through one method:
```typescript
async saveNotes(notes: Note[], options?: { scroll?: boolean }) {
  // Unified save logic
  // Handles store update + persistence + UI effects
}
```

---

## 🏗️ Proposed Target Shape

### After Refactoring

```
src/
├── lifecycle/
│   ├── NoteFactory.ts           # Creates notes with consistent IDs
│   ├── NoteLifecycleManager.ts  # Orchestrates create/update/delete
│   └── NoteValidator.ts         # Conflict detection, validation
│
├── services/
│   └── NoteActionsService.ts    # Thin wrapper for UI convenience
│       ├── createNote() → uses NoteLifecycleManager
│       └── updateNote() → uses NoteLifecycleManager
```

### Key Interfaces

```typescript
// NoteFactory.ts
export function createNote(options: {
  timestamp: number;
  text?: string;
  id?: string;  // Optional override
}): Note {
  return {
    id: options.id || generateNoteId(),  // Always UUID
    timestamp: formatTimestamp(options.timestamp),
    timestampInSeconds: options.timestamp,
    text: options.text || ''
  };
}

// NoteLifecycleManager.ts
export class NoteLifecycleManager {
  async create(note: Note): Promise<CreateResult>;
  async update(noteId: string, updates: Partial<Note>): Promise<boolean>;
  async delete(noteId: string): Promise<boolean>;
  
  // Hooks
  onCreated: (note: Note) => void;
  onUpdated: (note: Note) => void;
  onDeleted: (noteId: string) => void;
}

// NoteValidator.ts
export function validateNoteCreation(
  newNote: Note,
  existingNotes: Note[],
  options?: { threshold?: number }
): { valid: boolean; conflict?: Note } {
  // Centralized conflict detection
}
```

---

## 📋 Refactoring Plan

### Phase 1: Extract NoteFactory (Low Risk)
1. Create `src/lifecycle/NoteFactory.ts`
2. Implement `createNote()` using UUID consistently
3. Update `NoteActionsService.createNote()` to use factory
4. **Test**: Verify note IDs are UUIDs

### Phase 2: Extract NoteValidator (Low Risk)
1. Create `src/lifecycle/NoteValidator.ts`
2. Move `DUPLICATE_THRESHOLD` constant
3. Implement `validateNoteCreation()`
4. Update `NoteActionsService` to use validator
5. **Test**: Conflict detection still works

### Phase 3: Create NoteLifecycleManager (Medium Risk)
1. Create `src/lifecycle/NoteLifecycleManager.ts`
2. Implement hooks: `onCreated`, `onUpdated`, `onDeleted`
3. Move notification suppression to `onCreated` hook
4. **Test**: Notifications don't fire immediately after adding note

### Phase 4: Migrate Callers (Medium Risk)
1. Update `ShareService.importNotesFromJson()` to use lifecycle
2. Update `VideoManager` note editing to use lifecycle
3. Update `InlineNoteForm` to use lifecycle
4. **Test**: Full regression on all note operations

### Phase 5: Cleanup
1. Remove duplicate threshold constants
2. Remove duplicate ID generation
3. Simplify `NoteActionsService` to pure delegation

---

## ⚠️ Risk & Validation Notes

### High Risk Areas
1. **Import flow changes** - Most complex path with many edge cases
2. **Notification timing** - User-visible behavior change if hooks fire late
3. **ID migration** - Existing notes with old format IDs

### Validation Checklist
- [ ] Create note via floating button → UUID ID
- [ ] Create note via sidebar → same UUID format
- [ ] Create note at same timestamp → conflict dialog shown
- [ ] Import notes → conflict detection applied
- [ ] Delete note → notification system updated
- [ ] Edit note → save persists correctly
- [ ] Playback notification → doesn't fire after adding note

### Backward Compatibility
Old note IDs (`note-timestamp-random`) will still work:
```typescript
// NoteFactory.ts
export function isValidNoteId(id: string): boolean {
  return id.startsWith('note-') || isUUID(id);
}
```

---

## 📈 Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Note creation paths | 4 | 1 | -75% |
| ID generation methods | 3 | 1 | -67% |
| Threshold definitions | 3 | 1 | -67% |
| Conflict detection locations | 2 | 1 | -50% |
| Lines of code | ~350 | ~200 | -43% |

---

*Last updated: 2026-01-08*

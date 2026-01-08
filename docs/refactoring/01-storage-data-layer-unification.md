# Zone: Storage & Data Persistence Layer Unification

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Storage & Data Persistence Layer encompasses all logic responsible for reading, writing, transforming, and persisting note and video data. This includes local Chrome storage operations, cloud Supabase synchronization, caching, locking, schema migration, and backup/restore functionality.

**How it emerges from the current codebase:**
Analysis of imports, call graphs, and data flow reveals that persistence concerns are distributed across multiple files with overlapping responsibilities:
- `src/classes/NoteStorage.ts` (589 lines) - Legacy facade with direct storage access
- `src/storage/NotesRepository.ts` (703 lines) - "Centralized" repository with duplicate logic
- `src/storage/StorageAdapter.ts` (554 lines) - Hybrid local/cloud adapter
- `src/services/SupabaseService.ts` (441 lines) - Cloud-specific persistence
- `src/services/BackupService.ts` (318 lines) - Backup with its own persistence logic

---

## 2️⃣ Evidence From Code

### Files & Functions Indicating This Zone

| File | Concern | Evidence |
|------|---------|----------|
| `NoteStorage.ts` | Notes CRUD, Templates, Presets | `saveNotes()`, `loadNotes()`, `deleteNote()`, `loadSavedVideos()` |
| `NotesRepository.ts` | Notes CRUD, Caching, Backup | `saveNotes()`, `loadNotes()`, `deleteNote()`, `loadAllVideos()`, `createAutoBackup()` |
| `StorageAdapter.ts` | Local/Cloud Switching | `saveVideoNotes()`, `loadVideoNotes()`, `loadAllVideos()`, `deleteVideo()` |
| `SupabaseService.ts` | Cloud Persistence | `saveVideoNotes()`, `loadVideoNotes()`, `loadAllVideos()`, `deleteVideo()` |
| `BackupService.ts` | Backup/Restore | `createBackup()`, `restoreBackup()`, `exportBackup()` |

### Concrete Duplication Examples

**1. SaveNotes appears in 4 places with slight variations:**

```typescript
// NoteStorage.ts:280-320
async saveNotes(notes: Note[], group?: string | null, targetVideoId?: string, ...): Promise<boolean>

// NotesRepository.ts:77-124
async saveNotes(notes: Note[], options?: { videoId?: string; videoTitle?: string; ... }): Promise<boolean>

// StorageAdapter.ts:183-224
async saveVideoNotes(data: { videoId: string; videoTitle: string; notes: Note[]; ... }): Promise<boolean>

// SupabaseService.ts:156-198
async saveVideoNotes(data: { videoId: string; videoTitle: string; notes: Note[]; ... }): Promise<boolean>
```

**2. LoadAllVideos has 3 implementations:**

```typescript
// NotesRepository.ts:200-267
async loadAllVideos(options?: { retentionDays?: number; ... }): Promise<Video[]>

// StorageAdapter.ts:252-270
async loadAllVideos(): Promise<StoredVideoData[]>

// SupabaseService.ts:227-259
async loadAllVideos(): Promise<StoredVideoData[] | null>
```

**3. Two separate caching mechanisms:**

```typescript
// classes/NoteCache.ts (in NoteStorage)
private cache: NoteCache;

// storage/NotesRepository.ts
class NotesCache { private cache: Map<string, { notes: Note[]; timestamp: number }> }
```

---

## 3️⃣ Current Problems

### Redundancy
- **5 files** totaling **~2,600 lines** handle overlapping persistence concerns
- `saveNotes` logic is duplicated 4 times with minor parameter differences
- Two separate caching classes (`NoteCache` and `NotesCache`) with identical TTL-based invalidation

### Fragmentation
- Backup creation logic exists in both `NotesRepository.createAutoBackup()` and `BackupService.createBackup()`
- Merge algorithm for notes exists in both `NotesRepository.mergeNotes()` and `ShareService.mergeNotes()` (which delegates)
- Schema migration in `SchemaVersion.ts` is only applied in some paths, not all

### Coupling Issues
- `NoteStorage` directly calls `storageAdapter.saveVideoNotes()` AND `notesRepository.saveNotes()` - unclear ownership
- `NotesRepository` has backup logic embedded inside `overwriteAllNotes()` instead of delegating to `BackupService`
- Components import from multiple storage layers directly instead of through a single interface

### Cognitive Load
- Developers must understand 5 files to trace a single save operation
- No clear "source of truth" - is it `NoteStorage` or `NotesRepository`?
- Both classes use singleton pattern but with different initialization flows

---

## 4️⃣ Unification & Merge Opportunities

### Algorithm Unification

| Current State | Unified Approach |
|---------------|------------------|
| 4 `saveNotes` implementations | Single `DataLayer.save(videoId, notes, options)` |
| 3 `loadAllVideos` implementations | Single `DataLayer.getAllVideos(filters?)` |
| 2 cache classes | Single `DataCache<T>` generic utility |
| 2 merge algorithms | Single `NoteMerger.merge(existing, incoming)` utility |

### Shared Behaviors to Extract

```typescript
// Proposed: src/data/DataLayer.ts
interface DataLayer {
  // Single entry points
  save(videoId: string, notes: Note[], options?: SaveOptions): Promise<void>;
  load(videoId: string): Promise<Note[]>;
  loadAll(filters?: VideoFilters): Promise<Video[]>;
  delete(videoId: string): Promise<void>;
  
  // Lifecycle
  initialize(): Promise<void>;
  sync(): Promise<SyncResult>;
}
```

### What Can Become Shared

1. **Cache Layer**: Generic `TTLCache<K, V>` class usable by any service
2. **Lock Manager**: `StorageLock` is already singleton, formalize as infrastructure
3. **Schema Migration**: Apply consistently on all read/write paths
4. **Retry Logic**: Centralized retry utility for failed cloud operations

---

## 5️⃣ Proposed Target Shape

```
src/
├── data/                          # NEW: Unified data layer
│   ├── DataLayer.ts               # Public interface/facade
│   ├── adapters/
│   │   ├── LocalStorage.ts        # Chrome extension storage
│   │   └── CloudStorage.ts        # Supabase operations
│   ├── cache/
│   │   └── TTLCache.ts            # Generic caching
│   ├── sync/
│   │   ├── SyncEngine.ts          # Local↔Cloud synchronization
│   │   └── ConflictResolver.ts    # Merge strategies
│   ├── backup/
│   │   └── BackupManager.ts       # Consolidated backup logic
│   └── schema/
│       └── SchemaMigrator.ts      # (moved from storage/)
├── classes/                       
│   └── NoteStorage.ts             # DEPRECATED: Thin wrapper for backwards compat
├── storage/                       # DEPRECATED: Move to data/
│   └── index.ts                   # Re-exports from data/
└── services/
    └── SupabaseService.ts         # DEPRECATED: Absorbed into CloudStorage
```

### Interaction Pattern After Refactoring

```
Components → DataLayer.save() → SyncEngine → LocalStorage + CloudStorage
                                           ↓
                                     ConflictResolver (if needed)
                                           ↓
                                     BackupManager (auto-backup)
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Infrastructure (Low Risk)
1. Create `src/data/cache/TTLCache.ts` - extract from existing cache classes
2. Create `src/data/DataLayerTypes.ts` - unified type definitions
3. Add deprecation comments to current files

### Phase 2: Adapter Extraction (Medium Risk)
4. Create `src/data/adapters/LocalStorage.ts` - extract from `StorageAdapter`
5. Create `src/data/adapters/CloudStorage.ts` - extract from `SupabaseService`
6. Both adapters implement same interface, tested in isolation

### Phase 3: Sync Engine (Medium Risk)
7. Create `src/data/sync/SyncEngine.ts` - consolidate sync logic
8. Create `src/data/sync/ConflictResolver.ts` - extract merge algorithms
9. Unit test sync scenarios

### Phase 4: Facade Creation (Low Risk)
10. Create `src/data/DataLayer.ts` - thin facade over adapters
11. Update components to import from `DataLayer`
12. Keep old imports working via re-exports

### Phase 5: Deprecation (Low Risk)
13. Mark `NoteStorage`, `NotesRepository`, `StorageAdapter` as deprecated
14. Add console warnings in development mode
15. Update documentation

### Dependency Order
```
TTLCache (no deps)
   ↓
LocalStorage, CloudStorage (depend on TTLCache)
   ↓
SyncEngine (depends on adapters)
   ↓
DataLayer (depends on SyncEngine)
   ↓
Components (depend on DataLayer)
```

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Import paths**: Components importing `noteStorage` or `notesRepository` directly
- **Cloud sync timing**: Changing sync order could cause race conditions
- **Backup format**: If backup metadata structure changes, old backups may not restore

### Validation Strategy

1. **Unit Tests** (create before refactoring):
   - `TTLCache.test.ts` - cache eviction, TTL behavior
   - `SyncEngine.test.ts` - conflict resolution scenarios
   - `DataLayer.test.ts` - full save/load cycles

2. **Integration Tests**:
   - Save locally → verify cloud sync
   - Load from cloud → verify local cache
   - Offline operation → queue and sync when online

3. **Manual Regression Testing**:
   - [ ] Add note → page reload → note persists
   - [ ] Add note on device A → appears on device B
   - [ ] Import JSON → merge behavior correct
   - [ ] Export backup → restore backup → data intact

### Rollback Plan
- Keep all deprecated files functional during transition
- Feature flag: `USE_NEW_DATA_LAYER=true/false`
- Maintain re-export shims for 2 release cycles

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Files for persistence | 5 | 3 core + 1 facade |
| Total Lines | ~2,600 | ~1,400 |
| Duplicate `saveNotes` | 4 | 1 |
| Cache implementations | 2 | 1 |
| Entry points for save | 3 | 1 |

# 📋 Development Roadmap - Progress Tracker

**Last Updated:** January 8, 2026  
**Status:** Phase 1 Complete, Phase 2-4 In Progress

---

## ✅ Phase 1: Critical Bug Fixes (COMPLETED)

### Issue #1: Video Merge Behavior
- **Status:** ✅ FIXED (via data integrity hardening)
- **Files Modified:** `src/storage/NotesRepository.ts`
- **Fix:** Implemented proper `mergeNotes()` using note IDs as unique keys

### Issue #2: Empty Video Groups Display
- **Status:** ✅ FIXED
- **Files Modified:** `src/components/modals/VideoManager.ts`
- **Fix:** Added `.filter(groupName => groupedVideos[groupName].length > 0)` to skip empty groups in UI
- **Note:** Group data remains intact in settings storage

### Issue #3: Retention Setting Not Synced to Cloud
- **Status:** ✅ FIXED
- **Files Modified:** `src/classes/NoteStorage.ts`
- **Fix:** `setRetentionDays()` now syncs to cloud via `settingsService.update()`

---

## 🟡 Phase 2: Search & Sync Improvements (PARTIAL)

### Issue #4: Video Library Search Accuracy
- **Status:** ⏳ TODO
- **Objective:** Search returns only matching notes within videos

### Issue #5: Cloud Sync Conflict Resolution
- **Status:** ✅ PARTIALLY FIXED (via concurrency lock)
- **Files Created:** 
  - `src/storage/StorageLock.ts` - Mutex for concurrent operations
  - `src/storage/SchemaVersion.ts` - Schema versioning
- **Remaining:** Conflict notification UI

---

## 🟢 Phase 3: Note Playback Notifications (COMPLETED)

### Issue #6: Video Playback Note Notifications
- **Status:** ✅ COMPLETED
- **Implementation Strategy:**
  - **Service:** `src/services/NoteNotificationService.ts` monitors video time.
  - **UI Reuse:** Reuses `InlineNoteForm` to display notifications (avoids code duplication).
  - **Sound:** Uses `AudioContext` for reliable "Ping" sound without external assets.
- **Features Implemented:**
  - Trigger `InlineNoteForm` populated with note text at timestamp.
  - **Auto-Close:** Form auto-closes after 5 seconds with a visual progress bar.
  - **Interaction Guard:** Auto-close cancels if user hovers or interacts (for reading/editing).
  - **Sound:** Plays subtle notification sound.
- **Integration:** Fully integrated into `content.ts`.

---

## 🟡 Phase 2: Search & Sync Improvements (NEXT UP)

### Issue #4: Video Library Search Accuracy
- **Status:** ⏳ TODO
- **Objective:** Search currently returns the whole video if a note matches. We want to show **only the matching notes** within the search results.
- **Plan:**
  1. Modify `VideoManager.ts` search logic.
  2. Instead of filtering videos, filter notes *inside* each video.
  3. Display a "Matching Notes" section in the video card.

### Issue #5: Cloud Sync Conflict Resolution
- **Status:** ✅ PARTIALLY FIXED (via concurrency lock)
- **Remaining:** Conflict notification UI

---

### Issue #7: SubToolbar UI Consistency
- **Status:** ⏳ TODO
- **Objective:** Consistent button alignment, spacing, and sizing

---

## 📊 Overall Progress

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Critical Bugs | ✅ Complete | 100% |
| Phase 2: Search & Sync | 🟡 Partial | 50% |
| Phase 3: Notifications | ✅ Implemented | 90% |
| Phase 4: UI Polish | ⏳ TODO | 0% |

---

## 🛡️ Data Integrity Hardening (BONUS)

In addition to the roadmap items, comprehensive data integrity hardening was implemented:

### New Files Created:
1. `src/storage/StorageLock.ts` - Mutex for concurrent operations
2. `src/storage/SchemaVersion.ts` - Schema versioning with migrations
3. `src/utils/uuid.ts` - UUID v4 generator for global uniqueness
4. `src/services/NoteActionsService.ts` - Centralized note creation
5. `tests/data-integrity.test.ts` - 9 data integrity tests
6. `tests/hardened-integrity.test.ts` - 19 hardened tests
7. `docs/REMEDIATION_FINAL_REPORT.md` - Full remediation documentation

### Key Improvements:
- ✅ Concurrency lock prevents race conditions
- ✅ Mandatory backup before destructive operations
- ✅ Backup validation with checksum
- ✅ Automatic rollback on failure
- ✅ UUID v4 for globally unique note IDs
- ✅ Schema versioning for future migrations

---

## 🔜 Next Steps

1. **Integrate Note Notifications**
   - Add `createFloatingNoteNotification()` to content script initialization
   - Add toggle in settings for enabling/disabling notifications

2. **Implement Precise Note Search**
   - Modify `VideoManager.ts` search to filter notes within videos
   - Show only matching notes, not entire videos

3. **SubToolbar UI Polish**
   - Group buttons by function
   - Apply consistent sizing
   - Add visual separators

---

*Progress updated: January 8, 2026*

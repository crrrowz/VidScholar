# VidScholar - Code Analysis Report (ts-prune)

## 📊 Project Statistics

- **Total TypeScript Files**: 64 files in `src/`
- **Analysis Tool**: ts-prune v0.10.3
- **Last Analysis Date**: 2026-01-05

---

## 🔴 Unused Exports Analysis

### Entry Points (Expected - OK)
These are entry points and are expected to show as "unused":
```
✓ entrypoints\background.ts:2 - default
✓ entrypoints\content.ts:19 - default
```

---

## ⚠️ Classes (src/classes/index.ts)

| Export | Line | Status | Recommendation |
|--------|------|--------|----------------|
| `NoteCache` | 4 | ⚠️ Unused | Internal use only - OK |
| `NoteError` | 5 | ⚠️ Unused | Internal use only - OK |
| `showUserFriendlyError` | 5 | ⚠️ Unused | Consider removing export |
| `noteStorage` | 6 | ⚠️ Unused | Used internally |
| `NoteStorage` | 6 | ⚠️ Unused | Class export - keep |

**Action**: These are internal classes, barrel exports are fine.

---

## ⚠️ Constants (src/constants/index.ts)

| Export | Line | Status | Recommendation |
|--------|------|--------|----------------|
| `STORAGE_KEYS` | 7 | 🔴 Unused | Review usage or remove |
| `CSS_CLASSES` | 26 | 🔴 Unused | Review usage or remove |
| `EVENTS` | 63 | 🔴 Unused | Review usage or remove |
| `DEFAULTS` | 83 | 🔴 Unused | Review usage or remove |
| `ERROR_MESSAGES` | 99 | 🔴 Unused | Review usage or remove |
| `SUCCESS_MESSAGES` | 122 | 🔴 Unused | Review usage or remove |
| `YOUTUBE_SELECTORS` | 134 | 🔴 Unused | Review usage or remove |
| `ANIMATION_DURATIONS` | 145 | 🔴 Unused | Review usage or remove |
| `Z_INDEX` | 154 | 🔴 Unused | Review usage or remove |
| `KEYBOARD_SHORTCUTS` | 165 | 🔴 Unused | Review usage or remove |

**⚠️ High Priority**: Many constants defined but never used. Consider:
1. Using these constants instead of hardcoded values
2. Removing unused constants to reduce bundle size

---

## ⚠️ IO Services (src/io/)

### ExportService.ts
| Export | Line | Status |
|--------|------|--------|
| `default` | 429 | ⚠️ Unused |

### ImportService.ts
| Export | Line | Status |
|--------|------|--------|
| `default` | 557 | ⚠️ Unused |

### index.ts Exports
| Export | Line | Status | Recommendation |
|--------|------|--------|----------------|
| `exportService` | 24 | ⚠️ Unused | Keep for API |
| `ExportFormat` | 25 | 🔴 Unused | Remove if not needed |
| `ExportOptions` | 26 | 🔴 Unused | Remove if not needed |
| `FullBackup` | 27 | 🔴 Unused | Remove if not needed |
| `importService` | 32 | ⚠️ Unused | Keep for API |
| `ImportResult` | 33 | 🔴 Unused | Remove if not needed |
| `ImportOptions` | 34 | 🔴 Unused | Remove if not needed |

**Action**: Type exports may be used for type checking - verify before removing.

---

## ⚠️ Services (src/services/index.ts)

| Export | Line | Status | Used By |
|--------|------|--------|---------|
| `backupService` | 4 | 🔴 Unused | Not used anywhere |
| `encryptionService` | 5 | ⚠️ Unused | Used by Import/Export |
| `languageService` | 6 | ⚠️ Re-exported | Used via direct import |
| `screenshotService` | 7 | ⚠️ Re-exported | Used via direct import |
| `settingsService` | 8 | ⚠️ Re-exported | Used via direct import |
| `shareService` | 9 | ⚠️ Re-exported | Used via direct import |
| `themeService` | 10 | ⚠️ Re-exported | Used via direct import |

### SupabaseService.ts
| Export | Line | Status |
|--------|------|--------|
| `default` | 430 | ⚠️ Unused |

**Note**: Services are used via direct imports, not through barrel exports.

---

## ⚠️ State (src/state/index.ts)

| Export | Line | Status | Recommendation |
|--------|------|--------|----------------|
| `createStore` | 4 | ⚠️ Unused | Keep - initialization |
| `getStore` | 4 | ⚠️ Unused | Used via direct import |
| `actions` | 5 | ⚠️ Unused | Used via direct import |
| `enableAutoSave` | 5 | 🔴 Unused | Review if needed |

---

## ⚠️ Storage (src/storage/index.ts)

| Export | Line | Status | Recommendation |
|--------|------|--------|----------------|
| `storageAdapter` | 20 | ⚠️ Unused | Used via direct import |
| `StorageArea` | 20 | 🔴 Unused | Type - review |
| `StorageOptions` | 20 | 🔴 Unused | Type - review |
| `StorageQuota` | 20 | 🔴 Unused | Type - review |
| `StorageKeys` | 24 | 🔴 Unused | Type - review |
| `NOTES_PREFIX` | 25 | 🔴 Unused | Review usage |
| `isNotesKey` | 26 | 🔴 Unused | Review usage |
| `extractVideoId` | 27 | 🔴 Unused | Review usage |
| `isPresetKey` | 28 | 🔴 Unused | Review usage |
| `isBackupKey` | 29 | 🔴 Unused | Review usage |

---

## 📋 Summary

### By Priority

#### 🔴 High Priority (Definitely Unused)
1. **Constants** - 10 constant objects never used
2. **BackupService** - Entire service unused
3. **Storage Helpers** - `isNotesKey`, `extractVideoId`, `isPresetKey`, `isBackupKey` never used

#### 🟡 Medium Priority (Barrel Export Issues)
1. **Type Exports** - Many types exported but used via direct imports
2. **Service Re-exports** - Services used via direct imports, not barrel

#### 🟢 Low Priority (OK to Keep)
1. **Entry Points** - Expected to be "unused"
2. **Internal Classes** - Used internally, barrel export is fine

---

## 🧹 Recommended Actions

### Immediate Cleanup
```bash
# Files/Exports to consider removing:
- src/constants/index.ts: Remove or use the constants
- src/services/BackupService.ts: Remove if not used
- src/storage/index.ts: Remove unused helper functions
```

### Code Quality Improvements
1. **Use Constants**: Replace hardcoded values with defined constants
2. **Consistent Imports**: Use barrel exports or direct imports, not both
3. **Remove Dead Code**: Remove `enableAutoSave` if not used

### Barrel Export Strategy
Consider either:
1. **Keep barrel exports** and import from them consistently
2. **Remove barrel exports** and use direct imports everywhere

---

## 📈 Bundle Impact Estimate

| Category | Unused Exports | Est. Size Impact |
|----------|----------------|------------------|
| Constants | 10 objects | ~5-10 KB |
| BackupService | 1 service | ~2-5 KB |
| Storage Helpers | 5 functions | ~1-2 KB |
| Type Exports | 8 types | 0 KB (types) |
| **Total Potential Savings** | | **~8-17 KB** |

---

*Generated: 2026-01-05 using ts-prune v0.10.3*

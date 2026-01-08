# Zone: Service Singleton & Dependency Injection Cleanup

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Service Layer encompasses all singleton services that provide cross-cutting functionality: theme management, language/localization, settings persistence, sharing, screenshots, encryption, backup, and more. This zone also includes the partially-implemented Dependency Injection (DI) container.

**How it emerges from the current codebase:**
Analysis reveals two competing patterns for service management:
1. **Manual Singletons**: Each service implements its own `getInstance()` pattern
2. **DI Container**: A container exists in `src/services/di/` but is underutilized

Currently, **10 services** use manual singletons while the DI container only registers 6 of them, and components directly import singletons instead of resolving through DI.

---

## 2️⃣ Evidence From Code

### Services Using Manual Singleton Pattern

| Service | Singleton Pattern | DI Registered? |
|---------|-------------------|----------------|
| `ThemeService.ts` | `static instance` + `getInstance()` | ✅ Yes |
| `LanguageService.ts` | `static instance` + `getInstance()` | ✅ Yes |
| `SettingsService.ts` | `new SettingsService()` export | ❌ No |
| `ShareService.ts` | `static instance` + `getInstance()` | ✅ Yes |
| `ScreenshotService.ts` | `static instance` + `getInstance()` | ✅ Yes |
| `SupabaseService.ts` | `static instance` + `getInstance()` | ❌ No |
| `BackupService.ts` | `new BackupService()` export | ❌ No |
| `EncryptionService.ts` | `new EncryptionService()` export | ❌ No |
| `NoteActionsService.ts` | `static instance` + `getInstance()` | ❌ No |
| `NoteNotificationService.ts` | `static instance` + `getInstance()` | ❌ No |

### DI Container Usage

```typescript
// src/services/di/services.ts:14-41
export function registerServices(): void {
  const container = getContainer();
  container.singleton('Store', () => createStore(initialState));
  container.singleton('NoteStorage', () => new NoteStorage());
  container.singleton('ThemeService', () => ThemeService);  // Returns class, not instance!
  container.singleton('LanguageService', () => LanguageService);
  container.singleton('ShareService', () => ShareService);
  container.singleton('ScreenshotService', () => ScreenshotService);
}
```

**Problems with current DI registration:**
```typescript
// Returns the class itself, not an instance - inconsistent
container.singleton('ThemeService', () => ThemeService);

// But consumers expect instance methods:
getThemeService().getCurrentTheme();  // Works only because ThemeService has static methods
```

### Direct Imports vs DI Resolution

**Current pattern (everywhere):**
```typescript
// components/toolbar/MainToolbar.ts
import { themeService } from '../../services/ThemeService';
import { languageService } from '../../services/LanguageService';
import { shareService } from '../../services/ShareService';

// Direct usage - DI container completely bypassed
themeService.getCurrentTheme();
```

**DI getters exist but are unused:**
```typescript
// services/di/services.ts - exported but never imported elsewhere
export function getThemeService(): typeof ThemeService { ... }
export function getLanguageService(): typeof LanguageService { ... }
```

---

## 3️⃣ Current Problems

### Inconsistent Initialization
- Some services use `getInstance()` (lazy initialization)
- Some export `new ServiceClass()` (eager initialization)
- `registerServices()` exists but is never called in the codebase

```typescript
// Eager - created immediately on import
export const settingsService = new SettingsService();

// Lazy - created on first getInstance() call  
export const themeService = ThemeService.getInstance();
```

### Mixed Class/Instance Exports

```typescript
// LanguageService.ts - exports class AND instance
export class LanguageService { ... }
export const languageService = LanguageService.getInstance();

// ThemeService.ts - same pattern
export class ThemeService { ... }
export const themeService = ThemeService.getInstance();
```

### Circular Dependency Potential
Services import each other directly:
```
SettingsService → SupabaseService → (none)
NoteStorage → SettingsService, SupabaseService, StorageAdapter
BackupService → NoteStorage, SettingsService, EncryptionService
```

No centralized initialization order means potential race conditions.

### Dead Code
- `src/services/di/Container.ts` (145 lines) - fully implemented but unused
- `src/services/di/services.ts` (68 lines) - registration exists but never called
- DI getter functions never imported

### Testing Difficulty
- Manual singletons cannot be mocked easily
- No seams for dependency injection in tests
- Services coupled to `chrome.storage` directly

---

## 4️⃣ Unification & Merge Opportunities

### Option A: Remove DI, Standardize Manual Singletons
If DI complexity isn't needed:
1. Delete `src/services/di/` entirely
2. Standardize all services to consistent `getInstance()` pattern
3. Create `ServiceRegistry` for initialization order

### Option B: Commit to DI Container
If testability and flexibility are priorities:
1. Update DI registration to use proper factory functions
2. Replace all direct imports with DI resolution
3. Add initialization lifecycle hooks

### Recommended: Option A (Delete DI, Simplify)

**Rationale:**
- DI container is unused - no investment to protect
- Chrome extension context makes DI less valuable (no server-side injection)
- 145 lines of dead code can be removed immediately
- Simpler mental model for contributors

---

## 5️⃣ Proposed Target Shape

### Target: Clean Singleton Registry

```
src/services/
├── registry.ts              # NEW: Initialization orchestrator
├── core/                    # Core services (no deps on other services)
│   ├── ThemeService.ts
│   ├── LanguageService.ts
│   └── EncryptionService.ts
├── storage/                 # Storage-related services
│   ├── SettingsService.ts
│   ├── BackupService.ts
│   └── SupabaseService.ts
├── domain/                  # Domain-specific services
│   ├── NoteActionsService.ts
│   ├── NoteNotificationService.ts
│   ├── ShareService.ts
│   └── ScreenshotService.ts
└── index.ts                 # Barrel exports
```

### Service Registry Pattern

```typescript
// src/services/registry.ts
type ServiceName = 'theme' | 'language' | 'settings' | 'supabase' | ...;

interface ServiceRegistry {
  initialized: boolean;
  services: Map<ServiceName, unknown>;
}

let registry: ServiceRegistry | null = null;

export async function initializeServices(): Promise<void> {
  if (registry?.initialized) return;
  
  registry = {
    initialized: false,
    services: new Map()
  };
  
  // Phase 1: Core services (no dependencies)
  registry.services.set('theme', ThemeService.getInstance());
  registry.services.set('language', LanguageService.getInstance());
  registry.services.set('encryption', EncryptionService.getInstance());
  
  // Phase 2: Storage services (depend on core)
  await settingsService.initialize();
  registry.services.set('settings', settingsService);
  
  await supabaseService.initialize();
  registry.services.set('supabase', supabaseService);
  
  // Phase 3: Domain services (depend on storage)
  registry.services.set('noteActions', noteActionsService);
  registry.services.set('share', shareService);
  // ...
  
  registry.initialized = true;
}

export function getService<T>(name: ServiceName): T {
  if (!registry?.initialized) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return registry.services.get(name) as T;
}
```

### Standardized Singleton Template

```typescript
// Template for all services
class ExampleService {
  private static instance: ExampleService | null = null;
  
  private constructor() {
    // Private constructor
  }
  
  static getInstance(): ExampleService {
    if (!ExampleService.instance) {
      ExampleService.instance = new ExampleService();
    }
    return ExampleService.instance;
  }
  
  // Allow reset for testing
  static resetInstance(): void {
    ExampleService.instance = null;
  }
  
  // Optional async initialization
  async initialize(): Promise<void> { }
}

export const exampleService = ExampleService.getInstance();
export { ExampleService }; // For type imports only
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Cleanup Dead Code
1. Delete `src/services/di/Container.ts`
2. Delete `src/services/di/services.ts`
3. Delete `src/services/di/index.ts`
4. Remove `di/` directory entirely

### Phase 2: Standardize Singleton Pattern
5. Update `SettingsService.ts` to use `getInstance()` pattern
6. Update `BackupService.ts` to use `getInstance()` pattern
7. Update `EncryptionService.ts` to use `getInstance()` pattern
8. Add `resetInstance()` to all services (test support)

### Phase 3: Create Service Registry
9. Create `src/services/registry.ts`
10. Define initialization order based on dependencies
11. Update `entrypoints/content.ts` to call `initializeServices()`
12. Update `entrypoints/background.ts` similarly

### Phase 4: Organize by Responsibility
13. Create `core/`, `storage/`, `domain/` subdirectories
14. Move services to appropriate directories
15. Update all import paths
16. Create `src/services/index.ts` barrel export

### Phase 5: Add Testing Seams
17. Add `resetInstance()` to all singleton services
18. Export classes for type definitions
19. Document testing patterns

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Initialization order**: Services may access each other before ready
- **Circular imports**: Moving files may surface hidden cycles
- **Background script**: Different initialization context than content script

### Validation Strategy

1. **Static Analysis**:
   - Run `madge --circular src/` to detect circular dependencies
   - Verify no runtime errors on extension load

2. **Runtime Verification**:
   - [ ] Extension loads without errors in console
   - [ ] All services respond to API calls
   - [ ] Settings persist across reloads
   - [ ] Theme changes apply immediately
   - [ ] Language changes apply immediately

3. **Test Hook Verification**:
   - [ ] `resetInstance()` allows mocking in tests
   - [ ] Services can be initialized in isolation

### Backward Compatibility
- Keep `export const serviceName = getInstance()` pattern
- Components can continue importing directly
- Registry is optional orchestration layer

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Dead DI code | 213 lines | 0 lines |
| Singleton patterns | 3 different | 1 standardized |
| Initialization order | Implicit | Explicit in registry |
| Services with `resetInstance()` | 0 | 10 (all) |
| Circular dependency risk | High | Low (phased init) |

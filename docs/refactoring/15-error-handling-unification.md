# 15 - Error Handling Strategy Unification

## 🎯 Zone Definition

### What This Zone Represents
The **Error Handling Zone** encompasses all error management patterns:
- **Custom error classes** (rarely used)
- **Try-catch patterns** (inconsistent)
- **Error logging** (scattered console calls)
- **Error recovery** (mostly absent)
- **User-facing error messages** (inconsistent)

Currently, error handling varies wildly between files, with no unified strategy.

### How It Emerged
Each developer/feature added its own error handling:
- `NoteError` class exists but is rarely used
- Some functions throw, some return false, some log silently
- No centralized error tracking or telemetry

---

## 📊 Evidence From Code

### 1. Custom Error Class Exists But Unused

```typescript
// NoteError.ts - Lines 1-36
export class NoteError extends Error {
  category: 'loading' | 'saving' | 'network' | 'storage';
  timestamp: number;
  
  constructor(message: string, category: ...) {
    super(message);
    this.name = 'NoteError';
    // ...
  }
}

// Usage in NoteStorage.ts - Only 2 places:
throw new NoteError('Video ID not found', 'loading');  // Line 290
throw new NoteError('Failed to save notes', 'storage'); // Line 318
```

But most errors DON'T use `NoteError`:
```typescript
// Same file, different pattern:
throw new Error('Failed to load saved videos');  // Line 489
```

### 2. Inconsistent Error Return Patterns

**Pattern A: Return boolean**
```typescript
// NoteStorage.ts
async deleteNote(): Promise<boolean> {
  try { ... } 
  catch (error) { return false; }  // Swallows error
}
```

**Pattern B: Throw error**
```typescript
// NoteStorage.ts
async loadNotes(): Promise<Note[]> {
  catch (error) {
    throw new NoteError('Failed to load notes', 'storage');  // Throws
  }
}
```

**Pattern C: Return null**
```typescript
// StorageAdapter.ts
async get<T>(key: string): Promise<T | null> {
  catch (error) { return null; }  // Null on error
}
```

**Pattern D: Log and continue**
```typescript
// NotesRepository.ts
async saveNotes(): Promise<boolean> {
  catch (error) {
    console.error('Failed to save notes:', error);
    return false;  // Logs but continues
  }
}
```

### 3. Scattered Console Logging

```typescript
// Counting console calls in the codebase:
// console.error: 45+ occurrences
// console.warn: 25+ occurrences  
// console.log: 60+ occurrences (debug statements still present)

// Examples:
console.error('Failed to save notes:', error);  // NoteStorage.ts
console.error('[NotesRepository] Failed to save video:', error);  // NotesRepository.ts
console.warn('[NoteStorage] Failed to sync retention:', error);  // NoteStorage.ts
console.log(`Background: Synced ${cloudVideos.length} videos`);  // background.ts
```

No consistent format or log level strategy.

### 4. Extension Context Invalidation Handling

```typescript
// StorageAdapter.ts - Lines 51-61
private isContextValid(): boolean {
  try {
    return typeof chrome.runtime.id !== 'undefined';
  } catch {
    return false;
  }
}

// StorageAdapter.ts - Lines 63-77
private handleInvalidation(action?: string) {
  if (this.invalidated) return;  // Only handle once
  this.invalidated = true;
  showToast(...);  // UI in low-level class
  console.error('[StorageAdapter] Extension context invalidated');
}
```

Special case handling for extension-specific errors, but not generalized.

### 5. Telemetry Placeholder

```typescript
// NotesRepository.ts - Lines 561-572
private emitTelemetry(event: string, data: Record<string, any>): void {
  try {
    console.log(`[Telemetry] ${event}:`, JSON.stringify(data));
    // Future: Send to analytics service
    // analyticsService.track(event, data);
  } catch (error) {
    console.warn('[Telemetry] Failed to emit:', error);
  }
}
```

Telemetry infrastructure exists as placeholder but not used consistently.

---

## ⚠️ Current Problems

### Problem 1: Error Information Loss
```typescript
// Call chain:
await noteStorage.deleteNote(id);
// Returns: false
// Caller has NO idea why it failed:
// - Network error? 
// - Permission error?
// - Video not found?
// - Storage quota?
```

### Problem 2: Inconsistent User Feedback
```typescript
// Operation A: Shows toast on failure
await noteStorage.deleteVideo(id);  // Shows "Failed to delete"

// Operation B: Silent failure
await noteStorage.setRetentionDays(30);  // No feedback on failure
```

### Problem 3: Debug Logs in Production
```typescript
// background.ts
console.log(`Background: Synced ${cloudVideos.length} videos from cloud.`);
console.log("Background: Cloud data cached locally.");
```

These logs clutter user's console in production.

### Problem 4: No Error Aggregation
```typescript
// If 10 operations fail:
// - 10 separate console.error calls
// - Maybe 10 toasts
// - No aggregated report
```

### Problem 5: Retry Logic Scattered
```typescript
// NoteStorage.ts - Lines 347-374
let attempts = 0;
const tryDetectGroup = () => {
  if (!currentChannelId && !currentChannelName && attempts < 5) {
    attempts++;
    setTimeout(tryDetectGroup, 500);
    return;
  }
};

// content.ts - Similar pattern for cloud updates
```

Retry is implemented ad-hoc in each location.

---

## 🔧 Unification & Merge Opportunities

### Opportunity 1: Error Type Registry
```typescript
enum ErrorCode {
  STORAGE_QUOTA_EXCEEDED,
  NETWORK_UNAVAILABLE,
  VIDEO_NOT_FOUND,
  EXTENSION_INVALID,
  CLOUD_SYNC_FAILED
}
```

### Opportunity 2: Result Type Pattern
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

### Opportunity 3: Centralized Logger
```typescript
Logger.error('storage', 'Failed to save', { videoId });
Logger.warn('network', 'Retry in progress', { attempt: 3 });
```

### Opportunity 4: Retry Utility
```typescript
await retry(() => operation(), { maxAttempts: 5, delay: 500 });
```

---

## 🏗️ Proposed Target Shape

### After Refactoring

```
src/
├── core/
│   ├── errors/
│   │   ├── ErrorTypes.ts       # Error codes and types
│   │   ├── AppError.ts         # Unified error class
│   │   └── ErrorBoundary.ts    # Error handling utilities
│   │
│   ├── logging/
│   │   ├── Logger.ts           # Centralized logger
│   │   └── LogLevels.ts        # Log level configuration
│   │
│   └── utils/
│       └── retry.ts            # Retry utilities
```

### Key Interfaces

```typescript
// ErrorTypes.ts
export enum ErrorCode {
  // Storage errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
  
  // Network errors
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  CLOUD_SYNC_FAILED = 'CLOUD_SYNC_FAILED',
  
  // Extension errors
  EXTENSION_CONTEXT_INVALID = 'EXTENSION_CONTEXT_INVALID',
  
  // Domain errors
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  NOTE_CONFLICT = 'NOTE_CONFLICT',
  IMPORT_VALIDATION_FAILED = 'IMPORT_VALIDATION_FAILED',
  
  // Unknown
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorContext {
  code: ErrorCode;
  operation?: string;
  videoId?: string;
  noteId?: string;
  originalError?: Error;
  [key: string]: any;
}

// AppError.ts
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context: ErrorContext;
  readonly timestamp: number;
  readonly isRecoverable: boolean;
  
  constructor(code: ErrorCode, message: string, context?: Partial<ErrorContext>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = { code, ...context };
    this.timestamp = Date.now();
    this.isRecoverable = this.determineRecoverable(code);
  }
  
  private determineRecoverable(code: ErrorCode): boolean {
    const recoverable = [
      ErrorCode.NETWORK_UNAVAILABLE,
      ErrorCode.CLOUD_SYNC_FAILED
    ];
    return recoverable.includes(code);
  }
  
  toUserMessage(): string {
    // Map error codes to user-friendly messages
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage is full. Please delete some notes.',
      [ErrorCode.NETWORK_UNAVAILABLE]: 'No internet connection. Changes saved locally.',
      [ErrorCode.EXTENSION_CONTEXT_INVALID]: 'Extension needs to be reloaded.',
      // ...
    };
    return messages[this.code] || 'An unexpected error occurred.';
  }
}

// Logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class Logger {
  private static level: LogLevel = LogLevel.WARN;  // Production default
  private static prefix = '[VidScholar]';
  
  static setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  static debug(category: string, message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`${this.prefix}[${category}] ${message}`, data || '');
    }
  }
  
  static info(category: string, message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`${this.prefix}[${category}] ${message}`, data || '');
    }
  }
  
  static warn(category: string, message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`${this.prefix}[${category}] ${message}`, data || '');
    }
  }
  
  static error(category: string, message: string, error?: Error | AppError): void {
    if (this.level <= LogLevel.ERROR) {
      const context = error instanceof AppError ? error.context : {};
      console.error(`${this.prefix}[${category}] ${message}`, { error, ...context });
      
      // Future: Send to telemetry
      // telemetryService.trackError(category, message, error);
    }
  }
}

// retry.ts
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoff?: 'linear' | 'exponential';
  shouldRetry?: (error: Error) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 500,
    maxDelay = 5000,
    backoff = 'exponential',
    shouldRetry = () => true
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      const delay = backoff === 'exponential'
        ? Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
        : Math.min(initialDelay * attempt, maxDelay);
      
      Logger.debug('retry', `Attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError!;
}

// ErrorBoundary.ts
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  options: {
    operation: string;
    context?: Record<string, any>;
    fallback?: T;
    showToast?: boolean;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const appError = error instanceof AppError 
      ? error 
      : new AppError(ErrorCode.UNKNOWN, (error as Error).message, {
          operation: options.operation,
          originalError: error as Error,
          ...options.context
        });
    
    Logger.error(options.operation, appError.message, appError);
    
    if (options.showToast) {
      notificationService.error(appError.toUserMessage());
    }
    
    return options.fallback;
  }
}
```

### Usage After Refactoring

```typescript
// Before: Inconsistent patterns
try {
  await storageAdapter.saveVideoNotes(data);
} catch (error) {
  console.error('Failed to save:', error);
  showToast(languageService.translate('saveFailed'), 'error');
  return false;
}

// After: Unified pattern
const result = await withErrorBoundary(
  () => storageAdapter.saveVideoNotes(data),
  {
    operation: 'saveNotes',
    context: { videoId: data.videoId },
    showToast: true,
    fallback: false
  }
);

// Or throwing pattern:
throw new AppError(
  ErrorCode.STORAGE_WRITE_FAILED,
  'Failed to save notes',
  { videoId, operation: 'saveNotes' }
);

// Retry pattern (before was inline setTimeout)
const channelId = await retry(
  () => {
    const id = getChannelId();
    if (!id) throw new Error('Channel not ready');
    return id;
  },
  { maxAttempts: 5, initialDelay: 500 }
);
```

---

## 📋 Refactoring Plan

### Phase 1: Create Error Infrastructure (Low Risk)
1. Create `src/core/errors/ErrorTypes.ts`
2. Create `src/core/errors/AppError.ts`
3. Create `src/core/logging/Logger.ts`
4. **Test**: Unit tests for error classes and logger

### Phase 2: Create Utilities (Low Risk)
1. Create `src/core/utils/retry.ts`
2. Create `src/core/errors/ErrorBoundary.ts`
3. **Test**: Retry and boundary tests

### Phase 3: Migrate Console Logs (Low Risk)
1. Replace `console.log` → `Logger.debug` or `Logger.info`
2. Replace `console.warn` → `Logger.warn`
3. Replace `console.error` → `Logger.error`
4. **Test**: Logs still appear in development

### Phase 4: Migrate Storage Errors (Medium Risk)
1. Update `StorageAdapter` to throw `AppError`
2. Update `NotesRepository` to use `withErrorBoundary`
3. Update `NoteStorage` to use `AppError`
4. **Test**: Error handling works correctly

### Phase 5: Migrate Retry Logic (Medium Risk)
1. Replace inline retry in `NoteStorage.loadNotes()` with `retry()`
2. Replace inline retry in `content.ts` with `retry()`
3. **Test**: Retry behavior unchanged

### Phase 6: Remove Old NoteError
1. Delete `NoteError.ts` after full migration
2. Update imports to use `AppError`
3. **Test**: No type errors

---

## ⚠️ Risk & Validation Notes

### High Risk Areas
1. **Error swallowing changes** - Callers may rely on current behavior
2. **Log level changes** - Debug logs hidden in production
3. **Backward compatibility** - Old return patterns vs. throwing

### Validation Checklist
- [ ] Save note fails → user sees error message
- [ ] Load notes fails → appropriate fallback
- [ ] Network error during sync → recoverable handling
- [ ] Extension context invalid → special handling
- [ ] Import fails → clear error message
- [ ] Dev mode → debug logs visible
- [ ] Prod mode → only warnings/errors visible

### Migration Strategy
Parallel patterns during transition:
```typescript
// Both work during migration:
try { ... } catch (e) { return false; }  // Old way
await withErrorBoundary(...);            // New way
```

---

## 📈 Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Error class types | 2+ inconsistent | 1 unified | Standardized |
| Console call patterns | 5+ styles | 1 style | Consistent |
| Retry implementations | 3+ inline | 1 utility | -67% |
| Error context captured | Partial | Full | Complete |
| Debug logs in prod | Many | Configurable | Controllable |
| Error recovery | Ad-hoc | Systematic | Reliable |

---

*Last updated: 2026-01-08*

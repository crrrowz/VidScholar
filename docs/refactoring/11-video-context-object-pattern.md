# 11 - Video Context Object Pattern

## 🎯 Zone Definition

### What This Zone Represents
The **Video Context** is an implicit datastructure that exists conceptually but is never formalized:
- Current video ID
- Current video title
- Channel name and ID
- Video group assignment
- Current notes array

This context is **reconstructed repeatedly** from various sources (DOM, URL, storage, state) instead of being maintained as a single coherent object.

### How It Emerged
The codebase grew feature-by-feature:
1. Video ID extracted from URL
2. Title extracted from DOM
3. Channel info extracted from different DOM selectors
4. Group assignment stored separately in state

Each piece was added when needed, without a unifying context object.

---

## 📊 Evidence From Code

### 1. Repeated Context Reconstruction

```typescript
// NotesRepository.ts - Lines 90, 114, 117-118
const videoId = options?.videoId || getCurrentVideoId();
const videoTitle = options?.videoTitle || getVideoTitle() || videoId;
const channelName = options?.channelName || getChannelName();
const channelId = options?.channelId || getChannelId();

// NoteStorage.ts - Lines 304-311
const title = videoTitle || getVideoTitle();
channelName: channelName || getChannelName(),
channelId: channelId || getChannelId()

// ShareService.ts - Lines 102-107
if (videoId === getCurrentVideoId()) {
  channelName = getChannelName() || '';
  channelId = getChannelId() || '';
}
```

The same pattern of "get video ID, get title, get channel info" appears **8+ times** across the codebase.

### 2. State Store Has Partial Context

```typescript
// Store.ts - AppState
export interface AppState {
  notes: Note[];
  videoTitle: string;           // ← Partial context
  currentVideoGroup: string | null;  // ← Partial context
  // But no videoId, channelName, channelId!
}
```

The store holds **some** video context but not all.

### 3. DOM Queries Per-Operation

```typescript
// utils/video.ts
export function getCurrentVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');  // ← Called 20+ times!
}

export function getVideoTitle(): string {
  const el = document.querySelector('...');  // ← DOM query each time
  return el?.textContent || '';
}

export function getChannelName(): string {
  // Complex DOM query with 4 fallback selectors
  // Lines 20-32
}
```

Every operation **re-queries the DOM** instead of caching.

### 4. Scattered Group Detection Logic

```typescript
// NoteStorage.ts - Lines 348-372
const tryDetectGroup = () => {
  const currentChannelId = getChannelId();
  const currentChannelName = getChannelName();
  
  // Retry logic with attempts
  if (!currentChannelId && !currentChannelName && attempts < 5) {
    attempts++;
    setTimeout(tryDetectGroup, 500);
    return;
  }
  
  // Complex channel-based group detection
  const lastChannelVideo = allVideos.filter(...).sort(...)[0];
  if (lastChannelVideo?.group) {
    actions.setVideoGroup(lastChannelVideo.group);
  }
};
```

This is **embedded in loadNotes** instead of being a reusable context initialization.

---

## ⚠️ Current Problems

### Problem 1: Inconsistent Context Snapshots
```typescript
// At time T1:
const videoId = getCurrentVideoId();  // "abc123"

// User navigates at T2, before operation completes:
await someAsyncOperation();

// At time T3:
const title = getVideoTitle();  // Now returns DIFFERENT video's title!
```

**Impact**: Race conditions where notes are saved with mismatched metadata.

### Problem 2: DOM Query Performance
```typescript
// A single note save touches DOM 4 times:
getCurrentVideoId();   // URL parse
getVideoTitle();       // DOM query
getChannelName();      // DOM query (4 selectors)
getChannelId();        // DOM query (3 selectors)
```

**Impact**: Unnecessary DOM reads on hot paths.

### Problem 3: Retry Logic Duplication
```typescript
// NoteStorage.ts - Group detection retry
if (!currentChannelId && !currentChannelName && attempts < 5) {
  setTimeout(tryDetectGroup, 500);
}

// content.ts - Cloud update polling
const checkCloudUpdates = (attempt: number) => {
  if (attempt < 5) {
    setTimeout(() => checkCloudUpdates(attempt + 1), ...);
  }
};
```

Similar retry patterns for awaiting YouTube DOM readiness.

### Problem 4: No Context Invalidation
```typescript
// When YouTube SPA navigates:
// 1. Video ID changes in URL
// 2. But cached channel info is stale
// 3. No central "context changed" event
```

---

## 🔧 Unification & Merge Opportunities

### Opportunity 1: VideoContext Class
```typescript
export class VideoContext {
  readonly videoId: string;
  readonly videoTitle: string;
  readonly channelName: string;
  readonly channelId: string;
  readonly group: string | null;
  readonly timestamp: number;  // When context was captured
  
  static capture(): VideoContext | null;
  isStale(): boolean;
}
```

### Opportunity 2: Context Provider Pattern
```typescript
// React-style context but vanilla
const videoContext = VideoContextProvider.current();
```

### Opportunity 3: Unified Retry Helper
```typescript
function waitForYouTubeContext(
  timeout: number = 5000
): Promise<VideoContext> {
  // Unified polling for all video-related DOM
}
```

---

## 🏗️ Proposed Target Shape

### After Refactoring

```
src/
├── context/
│   ├── VideoContext.ts         # Immutable context snapshot
│   ├── VideoContextProvider.ts # Singleton provider with caching
│   └── YouTubeDOM.ts           # All DOM queries centralized
│
├── utils/
│   └── video.ts                # Thin wrappers for backward compat
```

### Key Interfaces

```typescript
// VideoContext.ts
export interface VideoContext {
  readonly videoId: string;
  readonly videoTitle: string;
  readonly channelName: string;
  readonly channelId: string;
  readonly group: string | null;
  readonly capturedAt: number;
}

export function captureVideoContext(): VideoContext | null {
  const videoId = YouTubeDOM.getVideoId();
  if (!videoId) return null;
  
  return Object.freeze({
    videoId,
    videoTitle: YouTubeDOM.getVideoTitle() || videoId,
    channelName: YouTubeDOM.getChannelName() || '',
    channelId: YouTubeDOM.getChannelId() || '',
    group: null,  // Assigned later from storage
    capturedAt: Date.now()
  });
}

// VideoContextProvider.ts
export class VideoContextProvider {
  private static current: VideoContext | null = null;
  private static listeners: Set<(ctx: VideoContext) => void> = new Set();
  
  static get(): VideoContext | null {
    return this.current;
  }
  
  static async waitFor(timeoutMs: number = 5000): Promise<VideoContext> {
    // Unified waiting logic
  }
  
  static refresh(): VideoContext | null {
    this.current = captureVideoContext();
    if (this.current) {
      this.listeners.forEach(l => l(this.current!));
    }
    return this.current;
  }
  
  static onChange(listener: (ctx: VideoContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// YouTubeDOM.ts - Centralized DOM queries
export const YouTubeDOM = {
  getVideoId(): string | null {
    return new URLSearchParams(window.location.search).get('v');
  },
  
  getVideoTitle(): string {
    return document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || '';
  },
  
  getChannelName(): string {
    // Centralized with all fallback selectors
  },
  
  getChannelId(): string {
    // Centralized with all fallback selectors
  },
  
  waitForElements(): Promise<void> {
    // Unified waiting for YouTube SPA
  }
};
```

### Usage Pattern After Refactoring

```typescript
// Before (scattered calls everywhere)
const videoId = getCurrentVideoId();
const title = getVideoTitle();
const channel = getChannelName();
const channelId = getChannelId();

// After (single context capture)
const ctx = VideoContextProvider.get();
if (!ctx) {
  ctx = await VideoContextProvider.waitFor();
}
// Use ctx.videoId, ctx.videoTitle, ctx.channelName, ctx.channelId
```

---

## 📋 Refactoring Plan

### Phase 1: Create YouTubeDOM Module (Low Risk)
1. Create `src/context/YouTubeDOM.ts`
2. Move DOM query functions from `utils/video.ts`
3. Keep old functions as re-exports for compatibility
4. **Test**: All DOM queries still work

### Phase 2: Create VideoContext Type (Low Risk)
1. Create `src/context/VideoContext.ts`
2. Define `VideoContext` interface
3. Implement `captureVideoContext()` function
4. **Test**: Context captures correctly

### Phase 3: Create VideoContextProvider (Medium Risk)
1. Create `src/context/VideoContextProvider.ts`
2. Implement singleton provider with caching
3. Add `waitFor()` with unified retry logic
4. Setup refresh on URL change
5. **Test**: Context updates on navigation

### Phase 4: Integrate with Storage (Medium Risk)
1. Update `NotesRepository.saveNotes()` to accept `VideoContext`
2. Update `NoteStorage.saveNotes()` to use context
3. Update `NoteStorage.loadNotes()` to use context
4. **Test**: Notes save with correct metadata

### Phase 5: Integrate with State Store
1. Add `currentVideoContext` to `AppState` (or as separate provider)
2. Update `content.ts` to manage context lifecycle
3. **Test**: Context synchronizes with state

### Phase 6: Cleanup
1. Remove duplicate context-building code
2. Remove retry logic from individual components
3. Simplify `utils/video.ts` to thin wrappers

---

## ⚠️ Risk & Validation Notes

### High Risk Areas
1. **YouTube SPA navigation** - Must detect URL changes correctly
2. **Race conditions** - Context must be atomic snapshot
3. **Channel info timing** - YouTube loads channel info asynchronously

### Validation Checklist
- [ ] Open video → context captured correctly
- [ ] Navigate to new video (SPA) → context refreshed
- [ ] Save note → uses context metadata correctly
- [ ] Channel info loads late → context still works
- [ ] Rapid navigation → no stale context used
- [ ] Browser refresh → context re-initialized

### Edge Cases to Test
1. **Private video** - No channel info exposed
2. **Deleted video** - Page shows error, no title
3. **Embedded player** - Different DOM structure
4. **YouTube Shorts** - Different URL structure (`/shorts/xxx`)

---

## 📈 Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| DOM queries per note save | 4 | 0 | -100% (cached) |
| Context reconstruction calls | 20+ | 1 | -95% |
| Retry logic implementations | 3 | 1 | -67% |
| Lines for video utilities | ~250 | ~150 | -40% |
| Race condition surface | High | Low | Significantly reduced |

---

*Last updated: 2026-01-08*

# Zone: Video Context & YouTube DOM Utilities

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Video Context zone handles all interactions with the YouTube page DOM - extracting video metadata (ID, title, channel), manipulating the video player (seeking, getting current time), waiting for YouTube UI elements, and detecting transcript availability.

**How it emerges from the current codebase:**
Currently, video-related utilities are split between:
- `src/utils/video.ts` (247 lines) - Main video utilities
- Inline DOM queries scattered across components
- `entrypoints/content.ts` - Additional YouTube-specific logic

---

## 2️⃣ Evidence From Code

### Centralized Video Utilities

```typescript
// src/utils/video.ts - Good functions to keep
export function getCurrentVideoId(): string | null { ... }
export function getVideoPlayer(): HTMLVideoElement | null { ... }
export function getVideoTitle(): string { ... }
export function getChannelName(): string { ... }
export function getChannelId(): string { ... }
export function generateVideoUrl(timestamp: string): Promise<string> { ... }
export function jumpToTimestamp(timestamp: string): void { ... }
export function isTranscriptAvailable(): boolean { ... }
export function openTranscript(): Promise<boolean> { ... }
```

### Scattered DOM Queries

**content.ts:**
```typescript
// Lines 59-162 - Video feature initialization
const videoId = url.searchParams.get("v");
const videoPlayer = document.querySelector('video');
// Multiple querySelector calls for YouTube elements
```

**FloatingButton.ts:**
```typescript
// Line ~192-213
const video = document.querySelector('video');
const videoRect = video.getBoundingClientRect();
// Direct DOM access without going through video.ts
```

**InlineNoteForm.ts:**
```typescript
// Direct video player access
const video = document.querySelector('video') as HTMLVideoElement;
video.currentTime;  // Reading directly
```

### Magic Selectors Repeated

```typescript
// YouTube title selector appears in:
// video.ts:16
document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent

// Different selector in TemplateEditor for video display
document.querySelector('ytd-video-primary-info-renderer #title')?.textContent
```

### Channel Extraction Complexity

```typescript
// video.ts:20-32 - Multiple fallback selectors
export function getChannelName(): string {
  const selectors = [
    '#owner #channel-name a',
    'ytd-video-owner-renderer #channel-name a',
    '#upload-info #channel-name a',
    'span.ytd-channel-name a'
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) return el.textContent.trim();
  }
  return '';
}
```

This complex selector logic should be encapsulated better.

---

## 3️⃣ Current Problems

### Selector Fragility
YouTube changes their DOM structure regularly. Selectors are:
- Hardcoded strings scattered across files
- No central place to update when YouTube changes
- Some files use different selectors for same element

### Missing Abstraction Layer
Components directly access `video.currentTime` instead of going through an abstraction:
```typescript
// Should be:
videoContext.getCurrentTime();

// Instead of:
document.querySelector('video')?.currentTime;
```

### No Caching/Memoization
Every call to `getVideoTitle()` queries the DOM:
```typescript
export function getVideoTitle(): string {
  return document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 'Untitled';
}
```

If called frequently, this is wasteful.

### Inconsistent Error Handling
```typescript
// video.ts - Silently returns empty/null
export function getCurrentVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");  // No validation
}

// No indication if video page is not yet loaded
```

---

## 4️⃣ Unification & Merge Opportunities

### Centralized Selector Registry

```typescript
// Proposed: src/utils/youtube/selectors.ts
export const YOUTUBE_SELECTORS = {
  videoPlayer: 'video',
  videoTitle: [
    'h1.ytd-video-primary-info-renderer',
    'ytd-video-primary-info-renderer #title'
  ],
  channelName: [
    '#owner #channel-name a',
    'ytd-video-owner-renderer #channel-name a',
    '#upload-info #channel-name a',
    'span.ytd-channel-name a'
  ],
  transcriptButton: 'button[aria-label="Show transcript"]',
  transcriptPanel: 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]'
} as const;
```

### Video Context Object

```typescript
// Proposed: src/utils/youtube/VideoContext.ts
class VideoContext {
  private static instance: VideoContext;
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000; // 1 second
  
  // Singleton
  static getInstance(): VideoContext { ... }
  
  // Cached getters
  getVideoId(): string | null {
    return this.getCached('videoId', () => {
      return new URLSearchParams(window.location.search).get('v');
    });
  }
  
  getVideoTitle(): string {
    return this.getCached('title', () => {
      return this.queryWithFallback(YOUTUBE_SELECTORS.videoTitle)?.textContent?.trim() || 'Untitled';
    });
  }
  
  getPlayer(): HTMLVideoElement | null {
    return document.querySelector(YOUTUBE_SELECTORS.videoPlayer);
  }
  
  getCurrentTime(): number {
    return this.getPlayer()?.currentTime ?? 0;
  }
  
  seekTo(seconds: number): void {
    const player = this.getPlayer();
    if (player) player.currentTime = seconds;
  }
  
  // Helper: Try multiple selectors
  private queryWithFallback(selectors: string | string[]): Element | null { ... }
  
  // Caching helper
  private getCached<T>(key: string, getter: () => T): T { ... }
  
  // Clear cache on navigation
  invalidateCache(): void { ... }
}

export const videoContext = VideoContext.getInstance();
```

### Event-Based Invalidation

```typescript
// Proposed: Listen for YouTube navigation
class VideoContext {
  constructor() {
    // YouTube uses history API for navigation
    window.addEventListener('yt-navigate-finish', () => {
      this.invalidateCache();
    });
    
    // Also handle popstate
    window.addEventListener('popstate', () => {
      this.invalidateCache();
    });
  }
}
```

---

## 5️⃣ Proposed Target Shape

```
src/utils/youtube/                # NEW: YouTube-specific utilities
├── selectors.ts                  # Central selector definitions
├── VideoContext.ts               # Video metadata access
├── TranscriptHelper.ts           # Transcript detection/opening
├── YouTubeEvents.ts              # YouTube event wrappers
└── index.ts                      # Barrel exports

src/utils/
├── video.ts                      # DEPRECATED: Re-exports from youtube/
├── time.ts                       # Keep: Timestamp formatting
├── config.ts                     # Keep: Config loader
└── ...
```

### Migration Path for video.ts

```typescript
// src/utils/video.ts - TRANSITIONAL
import { videoContext } from './youtube/VideoContext';
import { transcriptHelper } from './youtube/TranscriptHelper';

// Re-export for backward compatibility
export const getCurrentVideoId = () => videoContext.getVideoId();
export const getVideoPlayer = () => videoContext.getPlayer();
export const getVideoTitle = () => videoContext.getVideoTitle();
export const getChannelName = () => videoContext.getChannelName();
export const getChannelId = () => videoContext.getChannelId();
export const jumpToTimestamp = (ts: string) => videoContext.seekToTimestamp(ts);
export const isTranscriptAvailable = () => transcriptHelper.isAvailable();
export const openTranscript = () => transcriptHelper.open();

// Add deprecation warning
console.warn('[VidScholar] Direct import from utils/video.ts is deprecated. Use youtube/VideoContext instead.');
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Create Selector Registry
1. Create `src/utils/youtube/selectors.ts`
2. Document each selector's purpose
3. Add version comments for YouTube DOM changes

### Phase 2: Create VideoContext
4. Create `src/utils/youtube/VideoContext.ts`
5. Implement caching with TTL
6. Add YouTube navigation event handling
7. Implement `queryWithFallback` helper

### Phase 3: Create TranscriptHelper
8. Extract transcript logic to `src/utils/youtube/TranscriptHelper.ts`
9. Clean up complex selector logic
10. Add retry mechanism for slow YouTube loads

### Phase 4: Migrate Existing Code
11. Update `src/utils/video.ts` to delegate to new modules
12. Update `FloatingButton.ts` to use `videoContext`
13. Update `InlineNoteForm.ts` to use `videoContext`
14. Update `content.ts` to use `videoContext`

### Phase 5: Add Robustness
15. Add `waitForVideoPlayer()` promise helper
16. Add `waitForElement(selector)` generic helper
17. Add error telemetry for selector failures

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Selector changes**: YouTube may change DOM at any time
- **Caching bugs**: Stale data if cache not invalidated
- **Navigation events**: YouTube SPA navigation is complex

### Validation Strategy

1. **Video Metadata Tests**:
   - [ ] `getVideoId()` returns correct ID from URL
   - [ ] `getVideoTitle()` returns title (non-empty)
   - [ ] `getChannelName()` returns channel name
   - [ ] `getChannelId()` returns channel ID

2. **Player Interaction Tests**:
   - [ ] `getCurrentTime()` matches video player
   - [ ] `seekTo()` moves playhead
   - [ ] `jumpToTimestamp()` parses and seeks correctly

3. **Transcript Tests**:
   - [ ] `isTranscriptAvailable()` accurate detection
   - [ ] `openTranscript()` opens panel (when available)

4. **Navigation Tests**:
   - [ ] Navigate to new video → cache invalidated
   - [ ] Title shows new video's title
   - [ ] Video ID updated

### YouTube-Specific Risks
- YouTube A/B tests different UI versions
- Some users have YouTube Premium with different UI
- Embedded videos have different DOM structure

### Fallback Strategy
- Log selector failures to console
- Always return sensible defaults (empty string, 0, null)
- Don't crash extension if YouTube DOM changes

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Selector definitions | Scattered | 1 central file |
| DOM queries per call | Always query | Cached (1s TTL) |
| Places accessing player directly | 5+ | 1 (VideoContext) |
| YouTube navigation handling | Inconsistent | Event-based |
| Selector fallback support | Some | All major elements |

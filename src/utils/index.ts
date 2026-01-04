// src/utils/index.ts
// Barrel export for all utilities

export { errorBoundary, initializeErrorBoundary } from './ErrorBoundary';
export { setActiveInput, getActiveInput, getLastActiveInput } from './activeInputTracker';
export { default as config } from './config';
export { addMaterialIconsSupport } from './icons';
export { formatTimestamp, formatTime, parseTimestamp, formatDate, truncateText } from './time';
export { showToast } from './toast';
export { normalizeStringForSearch } from './ui';
export {
    waitForYouTubeUI,
    getVideoTitle,
    getCurrentVideoId,
    generateVideoUrl,
    getVideoPlayer,
    jumpToTimestamp,
    isElementInView,
    isTranscriptAvailable,
    openTranscript
} from './video';

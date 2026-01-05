// utils/video.ts
import config from './config';
import { languageService } from '../services/LanguageService';

export function getCurrentVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  if (window.location.pathname !== '/watch') return null;
  return urlParams.get('v');
}

export function getVideoPlayer(): HTMLVideoElement | null {
  return document.querySelector("video") as HTMLVideoElement;
}

export function getVideoTitle(): string {
  return document.querySelector("h1.style-scope.ytd-watch-metadata")
    ?.textContent?.trim() || '';
}

export function getChannelName(): string {
  // Selectors based on provided HTML structure (2025) and various YouTube layouts
  const channelName =
    document.querySelector('ytd-watch-metadata #channel-name #text a') ||
    document.querySelector('ytd-video-owner-renderer ytd-channel-name#channel-name #text a') ||
    document.querySelector('#channel-name #text-container #text a') ||
    document.querySelector('ytd-video-owner-renderer #channel-name #text a') ||
    document.querySelector('#meta-contents ytd-channel-name #text a') ||
    document.querySelector('#owner-name a') ||
    document.querySelector('.ytd-channel-name a');

  return channelName?.textContent?.trim() || '';
}

export function getChannelId(): string {
  // 1. Try meta tag (most reliable)
  const metaTag = document.querySelector('meta[itemprop="channelId"]');
  if (metaTag) {
    return metaTag.getAttribute('content') || '';
  }

  // 2. Try channel link
  // 2. Try channel link
  const channelLink =
    document.querySelector('ytd-watch-metadata #channel-name #text a') as HTMLAnchorElement ||
    document.querySelector('ytd-video-owner-renderer ytd-channel-name#channel-name #text a') as HTMLAnchorElement ||
    document.querySelector('#channel-name #text-container #text a') as HTMLAnchorElement ||
    document.querySelector('ytd-video-owner-renderer #channel-name #text a') as HTMLAnchorElement ||
    document.querySelector('#meta-contents ytd-channel-name #text a') as HTMLAnchorElement ||
    document.querySelector('#owner-name a') as HTMLAnchorElement ||
    document.querySelector('.ytd-channel-name a') as HTMLAnchorElement ||
    // Fallback: Avatar link
    document.querySelector('ytd-video-owner-renderer > a.ytd-video-owner-renderer') as HTMLAnchorElement ||
    document.querySelector('#owner #avatar') as HTMLAnchorElement;

  if (channelLink && (channelLink.href || channelLink.getAttribute('href'))) {
    const href = channelLink.href || channelLink.getAttribute('href') || '';

    // Extract ID from /channel/UC...
    const match = href.match(/\/channel\/([^/?]+)/);
    if (match) return match[1];

    // Extract handle /@handle
    const handleMatch = href.match(/\/@([^/?]+)/);
    if (handleMatch) return '@' + handleMatch[1];

    // Fallback known pattern /c/ChannelName
    const cMatch = href.match(/\/c\/([^/?]+)/);
    if (cMatch) return cMatch[1];

    // Fallback known pattern /user/UserName
    const userMatch = href.match(/\/user\/([^/?]+)/);
    if (userMatch) return userMatch[1];
  }

  return '';
}

export async function generateVideoUrl(timestamp: string): Promise<string> {
  const currentUrl = window.location.href;
  const videoId = new URL(currentUrl).searchParams.get('v');
  if (!videoId) return currentUrl;

  const timeComponents = timestamp.split(':').map(Number);
  const seconds = timeComponents.length === 3
    ? timeComponents[0] * 3600 + timeComponents[1] * 60 + timeComponents[2]
    : timeComponents[0] * 60 + timeComponents[1];

  return `https://youtu.be/${videoId}?t=${seconds}`;
}

export async function waitForYouTubeUI(): Promise<HTMLElement> {
  return new Promise<HTMLElement>((resolve, reject) => {
    const uiConfig = config.getUIConfig();
    let attempts = 0;
    const maxAttempts = uiConfig.maxAttempts;

    const checkForUI = () => {
      const container = document.querySelector("#secondary") as HTMLElement;
      if (container) {
        resolve(container);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error('YouTube UI not found after ' + maxAttempts + ' attempts'));
        return;
      }

      setTimeout(checkForUI, uiConfig.checkInterval);
    };

    checkForUI();
  });
}

export function jumpToTimestamp(timestamp: string): void {
  const video = getVideoPlayer();
  if (video) {
    const parts = timestamp.split(':').map(Number);
    const seconds = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];

    video.currentTime = seconds;
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function isElementInView(element: HTMLElement, container: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return (
    elementRect.bottom <= containerRect.bottom &&
    elementRect.top >= containerRect.top
  );
}

// Helper to verify if an engagement panel is actually a Transcript panel
function isTranscriptPanelHeader(header: Element | null): boolean {
  if (!header) return false;

  // Method 1: Check title text content directly
  const titleText = header.querySelector('#title-text')?.textContent?.trim().toLowerCase();

  // Method 2: Check aria-label on the title element
  const titleElement = header.querySelector('#title');
  const ariaLabel = titleElement?.getAttribute('aria-label')?.toLowerCase();

  // Method 3: Check title attribute on formatted string
  const formattedString = header.querySelector('yt-formatted-string#title-text');
  const titleAttribute = formattedString?.getAttribute('title')?.toLowerCase();

  // "transcript" is the key word, check against known translations if possible
  // For now, we check for 'transcript' and Arabic 'نص' as a basic heuristic
  // YouTube uses "Transcript" in English. 
  const keywords = ['transcript', 'النص', 'نص الفيديو'];

  const matches = (text: string | null | undefined) => {
    if (!text) return false;
    return keywords.some(k => text.includes(k));
  };

  return matches(titleText) || matches(ariaLabel) || matches(titleAttribute);
}

export function isTranscriptAvailable(): boolean {
  // Check if any visible engagement panel is a Transcript panel
  const panels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
  for (const panel of Array.from(panels)) {
    if (getComputedStyle(panel).display !== 'none') {
      const header = panel.querySelector('#header');
      if (isTranscriptPanelHeader(header)) {
        return true;
      }
    }
  }

  // Fallback checks (buttons existence)
  const showTranscriptButton = document.querySelector('ytd-video-description-transcript-section-renderer button.yt-spec-button-shape-next');
  if (showTranscriptButton) return true;

  return !!document.querySelector('ytd-menu-renderer.ytd-watch-metadata #button');
}

export async function openTranscript(): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      // 1. Check if ANY transcript panel is already visible and verified
      const panels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      for (const panel of Array.from(panels)) {
        if (getComputedStyle(panel).display !== 'none') {
          const header = panel.querySelector('#header');
          // Verify it's actually the transcript panel by looking at the header
          if (isTranscriptPanelHeader(header)) {
            // Wait briefly for content
            await new Promise(r => setTimeout(r, 500));
            const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
            if (segments.length > 0) return resolve(true);
          }
        }
      }

      // 2. Try to open via Description "Show Transcript" button
      const showTranscriptButton = document.querySelector(
        'ytd-video-description-transcript-section-renderer button.yt-spec-button-shape-next'
      ) as HTMLElement;

      if (showTranscriptButton) {
        showTranscriptButton.click();

        // Wait and verify
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          const panels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
          for (const panel of Array.from(panels)) {
            if (getComputedStyle(panel).display !== 'none') {
              const header = panel.querySelector('#header');
              if (isTranscriptPanelHeader(header)) {
                const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
                if (segments.length > 0) {
                  clearInterval(checkInterval);
                  resolve(true);
                  return;
                }
              }
            }
          }
          if (attempts > 20) { // 2 seconds timeout
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
        return;
      }

      resolve(false);
    } catch (e) {
      console.error('Error opening transcript:', e);
      resolve(false);
    }
  });
}


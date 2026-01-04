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
  // Selectors based on provided HTML structure (2025)
  const channelName =
    document.querySelector('#channel-name #text-container #text a') ||
    document.querySelector('ytd-video-owner-renderer #channel-name #text a') ||
    document.querySelector('#owner-name a');

  return channelName?.textContent?.trim() || '';
}

export function getChannelId(): string {
  // 1. Try meta tag (most reliable)
  const metaTag = document.querySelector('meta[itemprop="channelId"]');
  if (metaTag) {
    return metaTag.getAttribute('content') || '';
  }

  // 2. Try channel link
  const channelLink =
    document.querySelector('#channel-name #text-container #text a') as HTMLAnchorElement ||
    document.querySelector('ytd-video-owner-renderer #channel-name #text a') as HTMLAnchorElement ||
    document.querySelector('#owner-name a') as HTMLAnchorElement;

  if (channelLink && channelLink.href) {
    // Extract ID from /channel/UC... or /@handle
    const match = channelLink.href.match(/\/channel\/([^/?]+)/);
    if (match) return match[1];

    // If it's a handle (/@handle), we might just return the handle or empty if strict ID is needed.
    // Ideally we want the UC ID, but the handle is better than nothing.
    const handleMatch = channelLink.href.match(/\/@([^/?]+)/);
    if (handleMatch) return '@' + handleMatch[1];
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

export function isTranscriptAvailable(): boolean {
  const showTranscriptButton = document.querySelector('ytd-video-description-transcript-section-renderer button.yt-spec-button-shape-next');
  if (showTranscriptButton) {
    return true;
  }

  const moreButton = document.querySelector('ytd-menu-renderer.ytd-watch-metadata #button');
  if (moreButton) {
    return true;
  }

  return false;
}

export async function openTranscript(): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      // تحقق إذا كان النص مفتوح بالفعل
      const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
      if (transcriptRenderer && getComputedStyle(transcriptRenderer).display !== 'none') {
        const segments = transcriptRenderer.querySelectorAll('ytd-transcript-segment-renderer');
        if (segments.length > 0) return resolve(true);
      }

      // البحث عن زر النص
      const showTranscriptButton = document.querySelector(
        'ytd-video-description-transcript-section-renderer button.yt-spec-button-shape-next'
      );

      if (!showTranscriptButton) {
        return resolve(false);
      }

      // إذا موجود → اضغطه وتحقق من ظهور النص
      (showTranscriptButton as HTMLElement).click();

      const uiConfig = config.getUIConfig();
      const checkForTranscript = (attempts: number) => {
        const el = document.querySelector('ytd-transcript-renderer');
        if (el && getComputedStyle(el).display !== 'none') {
          const segments = el.querySelectorAll('ytd-transcript-segment-renderer');
          if (segments.length > 0) return resolve(true);
        }

        if (attempts >= uiConfig.maxAttempts) return resolve(true);
        setTimeout(() => checkForTranscript(attempts + 1), uiConfig.checkInterval);
      };

      checkForTranscript(0);

    } catch (error) {
      resolve(false); // أي خطأ → اعتبر الزر غير موجود لتعطيله
    }
  });
}

// services/ScreenshotService.ts
import { formatTime, formatDate } from '../utils/time';
import { getVideoPlayer } from '../utils/video';
import { showToast } from '../utils/toast';
import { themeService } from './ThemeService';

declare var JSZip: any;

export class ScreenshotService {
  private static instance: ScreenshotService;

  private constructor() {}

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  async captureScreenshotAtTime(time: number, video: HTMLVideoElement): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const originalTime = video.currentTime;
      const wasPlaying = !video.paused;
      if (wasPlaying) {
        video.pause();
      }

      const timeoutDuration = 3000;
      let timeoutId: any;

      const handleSeeked = async () => {
        try {
          clearTimeout(timeoutId);
          video.removeEventListener('seeked', handleSeeked);

          await new Promise(resolve => setTimeout(resolve, 200));

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const screenshot = canvas.toDataURL('image/png');

          video.currentTime = originalTime;
          if (wasPlaying) {
            await video.play();
          }

          resolve(screenshot);
        } catch (error) {
          reject(error);
        }
      };

      timeoutId = setTimeout(() => {
        video.removeEventListener('seeked', handleSeeked);
        reject(new Error(`Screenshot capture timed out at ${time}s`));
      }, timeoutDuration);

      video.addEventListener('seeked', handleSeeked, { once: true });
      video.currentTime = time;
    });
  }

  async downloadScreenshotsAsZip(timecodes: number[]): Promise<void> {
    try {
      const video = getVideoPlayer();
      if (!video) {
        throw new Error('Video element not found');
      }

      if (typeof JSZip === 'undefined') {
        await this.loadJSZip();
      }

      const wasPlaying = !video.paused;
      const originalTime = video.currentTime;
      video.pause();

      const zip = new JSZip();
      let processedCount = 0;
      const totalCount = timecodes.length;

      const progressOverlay = this.createProgressOverlay(totalCount);
      document.body.appendChild(progressOverlay);

      for (let i = 0; i < timecodes.length; i++) {
        const time = timecodes[i];
        try {
          const screenshot = await Promise.race([
            this.captureScreenshotAtTime(time, video),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Screenshot timeout')), 5000)
            )
          ]);

          const imgData = screenshot.split(',')[1];
          const filename = `screenshot_${String(i + 1).padStart(3, '0')}_${formatTime(time)}.png`;
          zip.file(filename, imgData, { base64: true });
          
          processedCount++;
          this.updateProgressBar(progressOverlay, processedCount, totalCount);

        } catch (error) {
          console.error(`Failed to capture screenshot at ${formatTime(time)}:`, error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtube_screenshots_${formatDate()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      progressOverlay.remove();
      video.currentTime = originalTime;
      if (wasPlaying) {
        await video.play();
      }

      showToast(languageService.translate("screenshotDownloadComplete"), 'success');
      
    } catch (error) {
      console.error('Screenshot download failed:', error);
      showToast(languageService.translate("screenshotDownloadFailed"), 'error');
    }
  }

  private async loadJSZip(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('jszip.min.js');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  private createProgressOverlay(totalCount: number): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'screenshot-progress-overlay';
    const colors = themeService.getThemeColors();
    
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: themeService.getCurrentTheme() === 'light' 
        ? 'rgba(255, 255, 255, 0.95)' 
        : 'rgba(30, 30, 30, 0.95)',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      zIndex: '10000',
      minWidth: '320px',
      textAlign: 'center'
    });

    overlay.innerHTML = `
      <div style="color: ${colors.text}; margin-bottom: 16px; font-weight: 500; font-size: 16px;">
        Capturing screenshots: <span class="progress-count">0</span>/${totalCount}
      </div>
      <div style="
        width: 100%;
        height: 6px;
        background: ${colors.border};
        border-radius: 3px;
        overflow: hidden;
      ">
        <div class="progress-bar" style="
          width: 0%;
          height: 100%;
          background: ${colors.primary};
          transition: width 0.3s ease;
        "></div>
      </div>
    `;

    return overlay;
  }

  private updateProgressBar(overlay: HTMLElement, current: number, total: number): void {
    const progressBar = overlay.querySelector('.progress-bar') as HTMLElement;
    const progressCount = overlay.querySelector('.progress-count');
    const percentage = (current / total) * 100;
    
    progressBar.style.width = `${percentage}%`;
    if (progressCount) progressCount.textContent = String(current);
  }
}

export const screenshotService = ScreenshotService.getInstance();
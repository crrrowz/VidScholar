// components/ui/ProgressOverlay.ts
import { themeService } from '../../services/ThemeService';

export function createProgressOverlay(totalCount: number): HTMLElement {
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

export function updateProgressBar(overlay: HTMLElement, current: number, total: number): void {
  const progressBar = overlay.querySelector('.progress-bar') as HTMLElement;
  const progressCount = overlay.querySelector('.progress-count');
  const percentage = (current / total) * 100;
  
  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (progressCount) progressCount.textContent = String(current);
}
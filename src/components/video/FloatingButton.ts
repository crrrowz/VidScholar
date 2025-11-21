// src/components/video/FloatingButton.ts
import { getVideoPlayer } from '../../utils/video';
import config from '../../utils/config';
import { themeService } from '../../services/ThemeService';

export function createFloatingButton(): HTMLElement {
  const icons = config.getIcons();

  const button = document.createElement('div');
  button.id = 'floating-add-note-button';
  
  // Manual styling to avoid class conflicts
  button.style.position = 'absolute';
  button.style.zIndex = '10000';
  button.style.top = '20px';
  button.style.left = '20px';
  button.style.cursor = 'grab';
  button.style.borderRadius = '50%';
  button.style.width = '48px';
  button.style.height = '48px';
  button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  button.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
  button.style.opacity = '0.5';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.border = 'none'; // Explicitly remove border

  const iconSpan = document.createElement("span");
  iconSpan.className = "material-icons";
  iconSpan.textContent = icons.ADD_NOTE;
  button.appendChild(iconSpan);

  const updateTheme = () => {
    const theme = themeService.getCurrentTheme();
    const themeColors = config.getTheme(theme);
    button.style.backgroundColor = themeColors.primary;
    button.style.color = themeColors.primaryText;
  };

  updateTheme();
  themeService.addListener(updateTheme);

  button.addEventListener('mouseenter', () => {
    if (!isDragging) {
      button.style.opacity = '1';
      button.style.transform = 'scale(1.1)';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (!isDragging) {
      button.style.opacity = '0.5';
      button.style.transform = 'scale(1)';
    }
  });

  let isDragging = false;
  let wasDragged = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  const dragThreshold = 5;

  button.addEventListener('mousedown', (e) => {
    isDragging = true;
    wasDragged = false;
    button.style.transform = 'scale(1.2)';
    button.style.cursor = 'grabbing';
    
    startX = e.clientX;
    startY = e.clientY;

    offsetX = e.clientX - button.getBoundingClientRect().left;
    offsetY = e.clientY - button.getBoundingClientRect().top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
  
    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;
  
    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (!playerContainer) return;
    const playerRect = playerContainer.getBoundingClientRect();
  
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
  
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      wasDragged = true;
    }
  
    let x = e.clientX - offsetX - playerRect.left;
    let y = e.clientY - offsetY - playerRect.top;
  
    // قيود داخل الفيديو
    x = Math.max(0, Math.min(x, playerRect.width - button.offsetWidth));
    y = Math.max(0, Math.min(y, playerRect.height - button.offsetHeight));
  
    // حول إلى نسبة
    button.dataset.leftPercent = (x / playerRect.width).toString();
    button.dataset.topPercent = (y / playerRect.height).toString();
  
    // استخدم البيكسل للرسم
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  });

  function updateButtonPosition() {
    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;
  
    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (!playerContainer) return;
    const playerRect = playerContainer.getBoundingClientRect();
  
    const leftPercent = parseFloat(button.dataset.leftPercent || '0');
    const topPercent = parseFloat(button.dataset.topPercent || '0');
  
    const x = leftPercent * playerRect.width;
    const y = topPercent * playerRect.height;
  
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }
  
  // استمع لتغيير حجم النافذة
  window.addEventListener('resize', updateButtonPosition);


  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = 'grab';
      button.style.transform = 'scale(1)';
    }
  });

  // Single, consolidated click handler
  button.addEventListener('click', (e) => {
    if (wasDragged) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    
    const mainAddNoteButton = document.getElementById('addNoteButton');
    if (mainAddNoteButton) {
      mainAddNoteButton.click();
    }
  });

  return button;
}


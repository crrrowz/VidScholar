// src/components/video/FloatingButton.ts
import { getVideoPlayer } from '../../utils/video';
import config from '../../utils/config';
import { themeService } from '../../services/ThemeService';
import { showInlineNoteForm } from './InlineNoteForm';

const DUPLICATE_THRESHOLD = 10; // seconds

// Inject shake animation CSS once
function injectShakeAnimationCSS() {
  if (!document.getElementById('shake-animation-style')) {
    const style = document.createElement('style');
    style.id = 'shake-animation-style';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  }
}

export function createFloatingButton(): HTMLElement {
  // Inject animation CSS immediately
  injectShakeAnimationCSS();
  // Prevent duplicate buttons
  const existingButton = document.getElementById('floating-add-note-button');
  if (existingButton) {
    return existingButton;
  }

  const icons = config.getIcons();

  const button = document.createElement('div');
  button.id = 'floating-add-note-button';

  // Manual styling to avoid class conflicts
  // Start hidden to prevent laggy dragging on page load
  Object.assign(button.style, {
    position: 'absolute',
    zIndex: '10000',
    top: '20px',
    left: '20px',
    cursor: 'grab',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s ease-in-out, transform 0.2s ease-in-out',
    opacity: '0', // Start hidden
    visibility: 'hidden', // Completely hidden initially
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none'
  });

  // Delayed appearance for smooth experience
  setTimeout(() => {
    button.style.visibility = 'visible';
    button.style.opacity = '0.5';
  }, 1500); // Wait 1.5 seconds for page to fully load

  const iconSpan = document.createElement("span");
  iconSpan.className = "material-icons";
  iconSpan.textContent = (icons as any)['ADD_NOTE'] || 'add';
  iconSpan.id = 'floating-button-icon';
  button.appendChild(iconSpan);

  const updateTheme = () => {
    const theme = themeService.getCurrentTheme();
    // Use dark theme colors as fallback for non-light/dark themes
    const themeKey = (theme === 'light' || theme === 'dark') ? theme : 'dark';
    const themeColors = config.getTheme(themeKey);
    button.style.backgroundColor = themeColors.primary;
    // Use primaryText for icon color (contrast color for primary background)
    const iconColor = themeColors.primaryText || '#ffffff';
    button.style.color = iconColor;
    iconSpan.style.color = iconColor;
  };

  updateTheme();
  themeService.addListener(updateTheme);

  // Hover effects
  button.addEventListener('mouseenter', () => {
    if (!isDragging && !isFormOpen) {
      button.style.opacity = '1';
      button.style.transform = 'scale(1.1)';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (!isDragging && !isFormOpen) {
      button.style.opacity = '0.5';
      button.style.transform = 'scale(1)';
    }
  });

  let isDragging = false;
  let wasDragged = false;
  let isFormOpen = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  const dragThreshold = 5;

  // Optimized Dragging Variables
  let rafId: number | null = null;
  let cachedPlayerRect: DOMRect | null = null;
  let currentMouseX = 0;
  let currentMouseY = 0;

  const updatePositionOnFrame = () => {
    if (!isDragging || !cachedPlayerRect) return;

    let x = currentMouseX - offsetX - cachedPlayerRect.left;
    let y = currentMouseY - offsetY - cachedPlayerRect.top;

    // Constrain within video player
    x = Math.max(0, Math.min(x, cachedPlayerRect.width - button.offsetWidth));
    y = Math.max(0, Math.min(y, cachedPlayerRect.height - button.offsetHeight));

    // Store as percentage
    button.dataset['leftPercent'] = (x / cachedPlayerRect.width).toString();
    button.dataset['topPercent'] = (y / cachedPlayerRect.height).toString();

    // Use transform for smoother movement (hardware accelerated) instead of top/left
    // But since we use top/left for positioning, we stick to that for consistency with resize logic,
    // just optimized via RAF.
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;

    rafId = requestAnimationFrame(updatePositionOnFrame);
  };

  button.addEventListener('mousedown', (e) => {
    if (isFormOpen) return;

    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;
    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (!playerContainer) return;

    isDragging = true;
    wasDragged = false;

    // Performance: Disable transition during drag to prevent 'floaty' lag
    button.style.transition = 'none'; // CRITICAL FIX

    button.style.transform = 'scale(1.2)';
    button.style.cursor = 'grabbing';

    // Cache expensive layout reads
    cachedPlayerRect = playerContainer.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    startX = e.clientX;
    startY = e.clientY;

    // Calculate offset relative to the button's top-left
    offsetX = e.clientX - buttonRect.left;
    offsetY = e.clientY - buttonRect.top;

    // Initialize current mouse position
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;

    // Start Animation Loop
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePositionOnFrame);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Minimal work in event listener
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      wasDragged = true;
    }
  });

  function updateButtonPosition() {
    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;

    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (!playerContainer) return;
    const playerRect = playerContainer.getBoundingClientRect();

    const leftPercent = parseFloat(button.dataset['leftPercent'] || '0');
    const topPercent = parseFloat(button.dataset['topPercent'] || '0');

    // If no percent set yet (initial load), default to top-left with padding
    if (!button.dataset['leftPercent']) {
      return;
    }

    const x = leftPercent * playerRect.width;
    const y = topPercent * playerRect.height;

    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }

  // Handle window resize
  window.addEventListener('resize', updateButtonPosition);

  // Handle Fullscreen changes
  document.addEventListener('fullscreenchange', updateButtonPosition);
  document.addEventListener('webkitfullscreenchange', updateButtonPosition);

  // Initialize ResizeObserver on the player container for robust resizing
  const videoPlayer = getVideoPlayer();
  if (videoPlayer) {
    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (playerContainer) {
      const resizeObserver = new ResizeObserver(() => {
        updateButtonPosition();
      });
      resizeObserver.observe(playerContainer);
    }
  }

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = 'grab';

      // Restore transition
      button.style.transition = 'all 0.2s ease-in-out';
      button.style.transform = 'scale(1)';

      // Stop Animation Loop
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      cachedPlayerRect = null;
    }
  });

  // Click handler - show inline note form
  button.addEventListener('click', (e) => {
    if (wasDragged) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (isFormOpen) return;

    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;

    const currentTime = videoPlayer.currentTime;

    // Import state to check for existing notes
    import('../../state/Store').then(({ getStore }) => {
      const notes = getStore().getState().notes;
      const existingNote = notes.find(note =>
        Math.abs(note.timestampInSeconds - currentTime) <= DUPLICATE_THRESHOLD
      );

      if (existingNote) {
        // Flash red and shake to indicate existing note
        const originalBg = button.style.backgroundColor;
        button.style.backgroundColor = '#f44336';
        button.style.animation = 'shake 0.5s';

        setTimeout(() => {
          button.style.backgroundColor = originalBg;
          button.style.animation = '';

          // Now open form with existing note for editing
          isFormOpen = true;
          showInlineNoteForm(button, existingNote.timestampInSeconds, () => {
            isFormOpen = false;
          }, existingNote.text, existingNote.timestamp);
        }, 500);
      } else {
        // No existing note, open empty form
        isFormOpen = true;
        showInlineNoteForm(button, currentTime, () => {
          isFormOpen = false;
        });
      }
    });
  });

  return button;
}

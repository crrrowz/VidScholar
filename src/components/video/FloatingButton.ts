// src/components/video/FloatingButton.ts
import { getVideoPlayer } from '../../utils/video';
import config from '../../utils/config';
import { themeService } from '../../services/ThemeService';
import { actions } from '../../state/actions';
import { formatTimestamp } from '../../utils/time';
import { languageService } from '../../services/LanguageService';

// Track last note timestamp to prevent duplicates within 10 seconds
let lastNoteTimestamp: number | null = null;
const DUPLICATE_THRESHOLD = 10; // seconds

export function createFloatingButton(): HTMLElement {
  // Prevent duplicate buttons
  const existingButton = document.getElementById('floating-add-note-button');
  if (existingButton) {
    return existingButton;
  }

  const icons = config.getIcons();

  const button = document.createElement('div');
  button.id = 'floating-add-note-button';

  // Manual styling to avoid class conflicts
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
    transition: 'all 0.2s ease-in-out',
    opacity: '0.5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none'
  });

  const iconSpan = document.createElement("span");
  iconSpan.className = "material-icons";
  iconSpan.textContent = icons.ADD_NOTE;
  iconSpan.id = 'floating-button-icon';
  button.appendChild(iconSpan);

  const updateTheme = () => {
    const theme = themeService.getCurrentTheme();
    // Use dark theme colors as fallback for non-light/dark themes
    const themeKey = (theme === 'light' || theme === 'dark') ? theme : 'dark';
    const themeColors = config.getTheme(themeKey);
    button.style.backgroundColor = themeColors.primary;
    button.style.color = themeColors.primaryText;
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

  button.addEventListener('mousedown', (e) => {
    if (isFormOpen) return;

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

    // Constrain within video player
    x = Math.max(0, Math.min(x, playerRect.width - button.offsetWidth));
    y = Math.max(0, Math.min(y, playerRect.height - button.offsetHeight));

    // Store as percentage using bracket notation
    button.dataset['leftPercent'] = (x / playerRect.width).toString();
    button.dataset['topPercent'] = (y / playerRect.height).toString();

    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  });

  function updateButtonPosition() {
    const videoPlayer = getVideoPlayer();
    if (!videoPlayer) return;

    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (!playerContainer) return;
    const playerRect = playerContainer.getBoundingClientRect();

    const leftPercent = parseFloat(button.dataset['leftPercent'] || '0');
    const topPercent = parseFloat(button.dataset['topPercent'] || '0');

    const x = leftPercent * playerRect.width;
    const y = topPercent * playerRect.height;

    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }

  window.addEventListener('resize', updateButtonPosition);

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = 'grab';
      button.style.transform = 'scale(1)';
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

    // Check if note already exists within 10 seconds
    if (lastNoteTimestamp !== null && Math.abs(currentTime - lastNoteTimestamp) <= DUPLICATE_THRESHOLD) {
      // Flash the button to indicate duplicate
      flashButtonColor(button, '#4caf50'); // green flash
      return;
    }

    isFormOpen = true;
    showInlineNoteForm(button, currentTime, () => {
      isFormOpen = false;
    });
  });

  return button;
}

// Flash button color temporarily
function flashButtonColor(button: HTMLElement, color: string) {
  const originalBg = button.style.backgroundColor;
  button.style.backgroundColor = color;
  button.style.transform = 'scale(1.2)';

  setTimeout(() => {
    button.style.backgroundColor = originalBg;
    button.style.transform = 'scale(1)';
  }, 500);
}

// Inline note form variables
let currentForm: HTMLElement | null = null;
let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

function showInlineNoteForm(button: HTMLElement, timestamp: number, onClose: () => void) {
  // Clean up existing form if any
  if (currentForm) {
    currentForm.remove();
    currentForm = null;
  }

  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
    autoCloseTimeout = null;
  }

  const theme = themeService.getCurrentTheme();
  const themeKey = (theme === 'light' || theme === 'dark') ? theme : 'dark';
  const themeColors = config.getTheme(themeKey);
  const formattedTime = formatTimestamp(timestamp);

  // Create form container
  const form = document.createElement('div');
  form.id = 'floating-note-form';
  Object.assign(form.style, {
    position: 'absolute',
    zIndex: '10001',
    top: `${parseInt(button.style.top) + 60}px`,
    left: button.style.left,
    backgroundColor: themeColors.cardBg || themeColors.bg,
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    border: `1px solid ${themeColors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '250px',
    maxWidth: '300px',
    opacity: '0',
    transform: 'translateY(-10px)',
    transition: 'all 0.2s ease-out'
  });

  // Timestamp label
  const timestampLabel = document.createElement('div');
  timestampLabel.textContent = formattedTime;
  Object.assign(timestampLabel.style, {
    fontSize: '12px',
    fontWeight: 'bold',
    color: themeColors.primary,
    fontFamily: 'monospace'
  });
  form.appendChild(timestampLabel);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.placeholder = languageService.translate('addNote') || 'Add a note...';
  Object.assign(textarea.style, {
    width: '100%',
    minHeight: '60px',
    maxHeight: '120px',
    resize: 'vertical',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: themeColors.bg,
    color: themeColors.text,
    outline: 'none',
    boxSizing: 'border-box'
  });
  form.appendChild(textarea);

  // Buttons container
  const buttonsContainer = document.createElement('div');
  Object.assign(buttonsContainer.style, {
    display: 'none', // Hidden initially
    justifyContent: 'flex-end',
    gap: '8px'
  });

  // Cancel button (✗)
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = '<span class="material-icons" style="font-size: 18px;">close</span>';
  Object.assign(cancelBtn.style, {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#f44336',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s'
  });
  cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.transform = 'scale(1.1)');
  cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.transform = 'scale(1)');
  cancelBtn.addEventListener('click', () => closeForm(form, button, onClose));

  // Save button (✓)
  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = '<span class="material-icons" style="font-size: 18px;">check</span>';
  Object.assign(saveBtn.style, {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#4caf50',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s'
  });
  saveBtn.addEventListener('mouseenter', () => saveBtn.style.transform = 'scale(1.1)');
  saveBtn.addEventListener('mouseleave', () => saveBtn.style.transform = 'scale(1)');
  saveBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (text) {
      saveNote(timestamp, text, button);
    }
    closeForm(form, button, onClose);
  });

  buttonsContainer.appendChild(cancelBtn);
  buttonsContainer.appendChild(saveBtn);
  form.appendChild(buttonsContainer);

  // Add form to video player container
  const videoPlayer = getVideoPlayer();
  if (videoPlayer) {
    const playerContainer = videoPlayer.closest('.html5-video-player');
    if (playerContainer) {
      playerContainer.appendChild(form);
    }
  }

  currentForm = form;

  // Update button state
  button.style.opacity = '1';
  button.style.transform = 'scale(1)';

  const iconSpan = button.querySelector('#floating-button-icon') as HTMLElement;
  if (iconSpan) {
    iconSpan.style.display = 'none';
  }

  // Animate form in
  requestAnimationFrame(() => {
    form.style.opacity = '1';
    form.style.transform = 'translateY(0)';
    textarea.focus();
  });

  // Show buttons when user starts typing
  textarea.addEventListener('input', () => {
    if (textarea.value.trim().length > 0) {
      buttonsContainer.style.display = 'flex';
      // Clear auto-close when typing
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
      }
    } else {
      buttonsContainer.style.display = 'none';
      // Restart auto-close timer
      startAutoCloseTimer(form, button, onClose);
    }
  });

  // Handle Enter (with Shift for new line)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = textarea.value.trim();
      if (text) {
        saveNote(timestamp, text, button);
      }
      closeForm(form, button, onClose);
    } else if (e.key === 'Escape') {
      closeForm(form, button, onClose);
    }
  });

  // Start 5-second auto-close timer
  startAutoCloseTimer(form, button, onClose);

  // Prevent clicks on form from closing
  form.addEventListener('click', (e) => e.stopPropagation());
  form.addEventListener('mousedown', (e) => e.stopPropagation());
}

function startAutoCloseTimer(form: HTMLElement, button: HTMLElement, onClose: () => void) {
  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
  }

  autoCloseTimeout = setTimeout(() => {
    const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea || textarea.value.trim().length === 0) {
      closeForm(form, button, onClose);
    }
  }, 5000); // 5 seconds
}

function closeForm(form: HTMLElement, button: HTMLElement, onClose: () => void) {
  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
    autoCloseTimeout = null;
  }

  // Animate out
  form.style.opacity = '0';
  form.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    form.remove();
    currentForm = null;
  }, 200);

  // Reset button
  button.style.borderRadius = '50%';
  button.style.width = '48px';
  button.style.padding = '0';
  button.style.opacity = '0.5';

  const iconSpan = button.querySelector('#floating-button-icon') as HTMLElement;
  if (iconSpan) {
    iconSpan.style.display = 'flex';
  }

  onClose();
}

function saveNote(timestamp: number, text: string, button: HTMLElement) {
  const formattedTime = formatTimestamp(timestamp);

  // Create and add note
  const newNote = {
    timestamp: formattedTime,
    timestampInSeconds: timestamp,
    text: text,
    id: `note-${Date.now()}`
  };

  // Use actions to add note (this sets selectedNote and newlyAddedNote)
  actions.addNote(newNote);
  actions.saveNotes();

  // Track this note to prevent duplicates
  lastNoteTimestamp = timestamp;

  // Flash button green to confirm save
  flashButtonColor(button, '#4caf50');

  // Scroll to note in sidebar if visible
  setTimeout(() => {
    const noteElement = document.querySelector(`[data-note-id="${newNote.id}"]`);
    if (noteElement) {
      noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

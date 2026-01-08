import { getVideoPlayer } from '../../utils/video';
import config from '../../utils/config';
import { themeService } from '../../services/ThemeService';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { formatTimestamp } from '../../utils/time';
import { languageService } from '../../services/LanguageService';
import { updateTemplateSelect } from '../toolbar/MainToolbar';
import { createButton } from '../ui/Button';
import { noteActionsService } from '../../services/NoteActionsService';


// Inline note form variables
let currentForm: HTMLElement | null = null;
let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

export async function showInlineNoteForm(
    button: HTMLElement,
    timestamp: number,
    onClose: () => void,
    existingText?: string,
    existingTimestamp?: string,
    autoCloseDuration?: number // Optional auto-close duration in ms
) {
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

    // New: Hide the button while form is open
    button.style.display = 'none';

    // Global click listener for outside clicks
    function handleOutsideClick(e: MouseEvent) {
        if (currentForm && !currentForm.contains(e.target as Node)) {
            closeForm(currentForm, button, onClose);
        }
    }

    // Add with a slight delay to avoid immediate trigger from the opening click
    setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
    }, 100);

    // Store listener reference on the form element for cleanup
    (form as any)._outsideClickListener = handleOutsideClick;

    // Calculate position relative to container
    const BUTTON_SIZE = 48; // px
    const FORM_OFFSET = 12; // px

    // Get numeric Top/Left position from style
    const buttonTop = parseInt(button.style.top || '0');
    const buttonLeft = parseInt(button.style.left || '0');

    // Determine positioning based on available space
    const videoPlayer = getVideoPlayer();
    let showAbove = false;
    let showToLeft = false;
    let playerWidth = 0;

    if (videoPlayer) {
        const playerContainer = videoPlayer.closest('.html5-video-player');
        if (playerContainer) {
            const rect = playerContainer.getBoundingClientRect();
            const playerHeight = rect.height;
            playerWidth = rect.width; // Store for right-align calculation

            // Vertical check (Bottom half -> Show Above)
            if (buttonTop > playerHeight / 2) {
                showAbove = true;
            }
            // Horizontal check (Right half -> Align Right/Show to Left)
            if (buttonLeft > playerWidth / 2) {
                showToLeft = true;
            }
        }
    }

    // Dynamic Top Position
    let formTop;
    if (showAbove) {
        const ESTIMATED_FORM_HEIGHT = 280;
        formTop = Math.max(0, buttonTop - ESTIMATED_FORM_HEIGHT - FORM_OFFSET);
    } else {
        formTop = buttonTop + BUTTON_SIZE + FORM_OFFSET;
    }

    // Dynamic Horizontal Origin
    const transformOriginX = showToLeft ? 'right' : 'left';
    const transformOriginY = showAbove ? 'bottom' : 'top';

    Object.assign(form.style, {
        position: 'absolute',
        zIndex: '10001',
        top: `${formTop}px`,
        // If showing to left (align right), use 'right' property relative to container width
        left: showToLeft ? 'auto' : button.style.left,
        right: showToLeft ? `${playerWidth - (buttonLeft + BUTTON_SIZE)}px` : 'auto',

        backgroundColor: themeColors.cardBg || themeColors.bg,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        border: `1px solid ${themeColors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '280px',
        maxWidth: '320px',
        opacity: '0',
        transform: showAbove ? 'translateY(10px)' : 'translateY(-10px)',
        transformOrigin: `${transformOriginY} ${transformOriginX}`,
        transition: 'all 0.2s ease-out'
    });
    // Set form direction based on UI language
    form.setAttribute('dir', languageService.getCurrentDirection());

    // Auto-Close Logic
    if (autoCloseDuration && autoCloseDuration > 0) {
        console.log(`[InlineNoteForm] Auto-close set for ${autoCloseDuration}ms`);

        // Progress bar for auto-close
        const progressBar = document.createElement('div');
        Object.assign(progressBar.style, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            height: '2px',
            backgroundColor: themeColors.primary,
            width: '100%',
            transition: `width ${autoCloseDuration}ms linear`,
            zIndex: '10002',
            borderRadius: '0 0 12px 12px'
        });
        form.appendChild(progressBar);

        // Start animation immediately
        requestAnimationFrame(() => {
            progressBar.style.width = '0%';
        });

        // Set timeout
        autoCloseTimeout = setTimeout(() => {
            console.log('[InlineNoteForm] Auto-closing...');
            closeForm(form, button, onClose);
        }, autoCloseDuration);

        // Cancel on interaction
        const cancelAutoClose = () => {
            if (autoCloseTimeout) {
                console.log('[InlineNoteForm] Auto-close cancelled by user interaction');
                clearTimeout(autoCloseTimeout);
                autoCloseTimeout = null;
                progressBar.style.display = 'none'; // Hide progress bar
            }
        };

        form.addEventListener('mouseenter', cancelAutoClose);
        form.addEventListener('click', cancelAutoClose);
        form.addEventListener('input', cancelAutoClose);
    }

    // --- 1. Top Section: Template Toolbar ---
    const toolbarContainer = document.createElement('div');
    Object.assign(toolbarContainer.style, {
        display: 'flex',
        gap: '6px',
        marginBottom: '4px',
        alignItems: 'center'
    });

    const templateSelect = document.createElement("select");
    Object.assign(templateSelect.style, {
        flex: "1",
        width: "0",
        minWidth: "0",
        padding: "8px", // Match MainToolbar
        borderRadius: "8px", // Match MainToolbar
        textOverflow: "ellipsis",
        border: `1px solid var(--color-border)`,
        backgroundColor: `var(--color-surface)`,
        color: `var(--color-text-primary)`,
        fontSize: '13px',
    });

    const icons = config.getIcons();
    const insertTemplateButton = createButton(
        (icons as any)['INSERT_TEMPLATE'] || 'post_add',
        null,
        () => {
            if (templateSelect.value && templateSelect.value !== "0") {
                const textToInsert = templateSelect.value;
                const startPos = textarea.selectionStart;
                const endPos = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, startPos) + textToInsert + textarea.value.substring(endPos, textarea.value.length);
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = startPos + textToInsert.length;
                textarea.dispatchEvent(new Event('input'));
            }
        },
        'inlineInsertTemplateButton',
        'default'
    );
    // Apply default button inline styles
    Object.assign(insertTemplateButton.style, {
        background: themeColors.cardBg || '#2a2a2a',
        color: themeColors.text || '#ffffff',
        border: `1px solid ${themeColors.border}`,
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    });



    insertTemplateButton.disabled = true;

    toolbarContainer.appendChild(templateSelect);
    toolbarContainer.appendChild(insertTemplateButton);
    form.appendChild(toolbarContainer);

    // --- 2. Middle Section: Textarea ---
    const textarea = document.createElement('textarea');
    textarea.placeholder = languageService.translate('addNote') || 'Add a note...';
    Object.assign(textarea.style, {
        width: '100%',
        height: '130px', // Unified fixed height
        resize: 'none',
        border: `1px solid var(--color-border)`,
        borderRadius: '8px',
        padding: '8px 10px',
        lineHeight: '22px',
        fontSize: '14px',
        fontFamily: 'inherit',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        outline: 'none',
        boxSizing: 'border-box',
        overflowY: 'auto' // Added scrollbar
    });
    textarea.dir = 'auto'; // Auto-detect typing direction

    // If editing existing note, populate textarea
    const isEditMode = existingTimestamp !== undefined && existingTimestamp !== null;
    if (existingText) {
        textarea.value = existingText;
    }

    form.appendChild(textarea);

    // --- 3. Bottom Section: Footer (Timestamp + Buttons) ---
    const footerContainer = document.createElement('div');
    Object.assign(footerContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '4px',
        minHeight: '32px'
    });

    // Timestamp label (Left side mostly, or Start based on dir)
    const timestampLabel = document.createElement('div');
    timestampLabel.textContent = existingTimestamp || formattedTime;
    Object.assign(timestampLabel.style, {
        fontSize: '12px',
        fontWeight: 'bold',
        color: themeColors.primary,
        fontFamily: 'monospace',
        padding: '0 4px',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: '4px'
    });
    footerContainer.appendChild(timestampLabel);

    // Buttons container (Right side mostly, or End based on dir)
    const buttonsContainer = document.createElement('div');
    Object.assign(buttonsContainer.style, {
        display: 'flex', // Always show buttons
        gap: '8px',
        alignItems: 'center'
    });

    // Cancel button - Red (Danger)
    const cancelBtn = createButton(
        (icons as any)['CLOSE'] || 'close',
        null,
        () => closeForm(form, button, onClose),
        'inlineCancelBtn',
        'danger'
    );
    cancelBtn.title = languageService.translate("cancel");
    Object.assign(cancelBtn.style, {
        background: '#f44336',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        transition: 'all 0.2s'
    });


    // Save button - Blue (Primary)
    const saveBtn = createButton(
        'check',
        null,
        () => {
            const text = textarea.value.trim();
            // Allow saving empty notes as requested by user
            saveNote(timestamp, text, button, isEditMode, existingTimestamp);
            closeForm(form, button, onClose);
        },
        'inlineSaveBtn',
        'primary'
    );
    saveBtn.title = languageService.translate("save");
    Object.assign(saveBtn.style, {
        background: '#3ea6ff',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        transition: 'all 0.2s'
    });

    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(saveBtn);
    footerContainer.appendChild(buttonsContainer);

    form.appendChild(footerContainer);

    // Add form to video player container
    // Reuse videoPlayer variable declared earlier
    if (videoPlayer) {
        const playerContainer = videoPlayer.closest('.html5-video-player');
        if (playerContainer) {
            playerContainer.appendChild(form);
        }
    }

    currentForm = form;

    // Initialize Templates & Listeners
    const updateTemplates = async () => {
        const currentPreset = await noteStorage.getCurrentPreset();
        const templates = await noteStorage.loadPresetTemplates(currentPreset);
        updateTemplateSelect(templateSelect, templates, currentPreset);
    };

    // Initial load
    await updateTemplates();

    // Listeners
    const presetListener = async () => {
        await updateTemplates();
    };

    noteStorage.addPresetListener(presetListener);
    noteStorage.addTemplateListener(presetListener);

    // Store for cleanup
    (form as any)._presetListener = presetListener;

    templateSelect.onchange = () => {
        const hasSelection = templateSelect.value && templateSelect.value !== "0";
        insertTemplateButton.disabled = !hasSelection;
        // Toggle button style based on selection
        if (hasSelection) {
            Object.assign(insertTemplateButton.style, {
                background: '#3ea6ff',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
            });
        } else {
            Object.assign(insertTemplateButton.style, {
                background: themeColors.cardBg || '#2a2a2a',
                color: themeColors.text || '#ffffff',
                border: `1px solid ${themeColors.border}`,
                boxShadow: 'none'
            });
        }
    };

    // Update button state (hide original floating button icon if needed, but we hid the whole button above)
    // button.style.opacity = '1'; ... (redundant as display: none is set)

    // Animate form in
    requestAnimationFrame(() => {
        form.style.opacity = '1';
        form.style.transform = 'translateY(0)';
        textarea.focus();
    });

    // Reset auto-close on input
    textarea.addEventListener('input', () => {
        if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
            autoCloseTimeout = null;
        }
    });

    // Handle Enter
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

    // Event blocking
    const eventsToBlock = [
        'click', 'dblclick', 'mousedown', 'mouseup',
        'keydown', 'keypress', 'keyup',
        'touchstart', 'touchend',
        'pointerdown', 'pointerup', 'contextmenu'
    ];

    eventsToBlock.forEach(eventType => {
        form.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });
}



async function closeForm(form: HTMLElement, button: HTMLElement, onClose: () => void) {
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }

    // Clean up preset listener
    if ((form as any)._presetListener) {
        noteStorage.removePresetListener((form as any)._presetListener);
        noteStorage.removeTemplateListener((form as any)._presetListener);
    }

    // Animate out
    form.style.opacity = '0';
    form.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        form.remove();
        currentForm = null;
    }, 200);

    // Reset button
    if (button) {
        button.style.borderRadius = '50%';
        button.style.width = '48px';
        button.style.padding = '0';
        button.style.opacity = '0.5';

        const iconSpan = button.querySelector('#floating-button-icon') as HTMLElement;
        if (iconSpan) {
            iconSpan.style.display = 'flex';
        }
    }

    onClose();

    // Clean up outside click listener
    if ((form as any)._outsideClickListener) {
        document.removeEventListener('mousedown', (form as any)._outsideClickListener);
    }

    // Restore button visibility
    button.style.display = 'flex';
}

async function saveNote(timestamp: number, text: string, button: HTMLElement, isEditMode: boolean = false, existingTimestamp?: string) {
    if (isEditMode && existingTimestamp) {
        // Update existing note using centralized service
        const success = await noteActionsService.updateNoteText(existingTimestamp, text);
        if (success) {
            flashButtonColor(button, '#4caf50');
        }
    } else {
        // Create new note using centralized service
        const result = await noteActionsService.createNote({
            timestamp,
            text,
            scrollToNote: true,
            focusTextarea: false
        });

        if (result.success) {
            flashButtonColor(button, '#4caf50');
        }
    }
}

// Flash button color temporarily
export function flashButtonColor(button: HTMLElement, color: string) {
    const originalBg = button.style.backgroundColor;
    button.style.backgroundColor = color;
    button.style.transform = 'scale(1.2)';

    setTimeout(() => {
        button.style.backgroundColor = originalBg;
        button.style.transform = 'scale(1)';
    }, 500);
}

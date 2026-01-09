/**
 * KeyboardManager - Handles keyboard events for the extension
 * 
 * This manager ensures that keyboard shortcuts work properly with YouTube:
 * - When the user is focused on an input inside the extension, keyboard events are captured
 * - When the user is not focused on extension inputs, keyboard events pass through to YouTube
 */

/**
 * Check if an element is inside the VidScholar extension
 */
function isInsideExtension(element: Element | null): boolean {
    if (!element) return false;

    const extensionContainers = [
        'vidscholar-root',
        'memoSidebar',
        'floating-note-form',
        'videoManager',
        'templateEditor',
        'confirmDialog',
        'promptDialog',
        'importDecisionManager'
    ];

    for (const id of extensionContainers) {
        if (element.closest(`#${id}`) || element.closest('.vidscholar-app')) {
            return true;
        }
    }

    return false;
}

/**
 * Check if the currently focused element is an input inside the extension
 */
export function isExtensionInputFocused(): boolean {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    // Check if it's an input or textarea
    const isInputElement =
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true';

    if (!isInputElement) return false;

    // Check if it's inside the extension
    return isInsideExtension(activeElement);
}

// Global flag to track if a select dropdown is currently open
let selectDropdownOpen = false;

/**
 * Check if any select dropdown is currently active
 */
function isSelectDropdownActive(): boolean {
    return selectDropdownOpen;
}

/**
 * Setup keyboard event handling
 * This ensures YouTube shortcuts work when not focused on extension inputs
 */
export function setupKeyboardManager(): void {
    // Handle keydown events on the extension containers
    document.addEventListener('keydown', (e) => {
        const target = e.target as Element;

        // If the event target is inside our extension
        if (isInsideExtension(target)) {
            // Only stop propagation if it's an input element
            // This allows YouTube to receive the event if we're just clicking on the sidebar
            const isInputElement =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.getAttribute('contenteditable') === 'true';

            if (isInputElement) {
                // Stop propagation for input elements to prevent YouTube from capturing the keys
                e.stopPropagation();
            }
        }
    }, true); // Use capture phase to handle before YouTube's listeners

    // Track select dropdown state with focus/blur events
    document.addEventListener('focus', (e) => {
        const target = e.target as Element;
        if (target?.tagName === 'SELECT' && isInsideExtension(target)) {
            selectDropdownOpen = true;
        }
    }, true);

    document.addEventListener('blur', (e) => {
        const target = e.target as Element;
        if (target?.tagName === 'SELECT' && isInsideExtension(target)) {
            // Small delay to allow dropdown to complete
            setTimeout(() => {
                selectDropdownOpen = false;
            }, 200);
        }
    }, true);

    // Track mouse position to detect when it leaves extension area
    let mouseInsideExtension = false;

    document.addEventListener('mouseover', (e) => {
        const target = e.target as Element;
        const nowInside = isInsideExtension(target);

        // If mouse just LEFT the extension area
        if (mouseInsideExtension && !nowInside) {
            // Don't restore focus if a select dropdown is open
            if (!isSelectDropdownActive()) {
                returnFocusToVideo();
            }
        }

        mouseInsideExtension = nowInside;
    }, true);

    // Also handle mouseleave from document (for edge cases)
    document.addEventListener('mouseleave', () => {
        if (mouseInsideExtension) {
            // Don't restore focus if a select dropdown is open
            if (!isSelectDropdownActive()) {
                returnFocusToVideo();
            }
            mouseInsideExtension = false;
        }
    });

    // Handle click events - restore focus to video after clicking non-input elements
    document.addEventListener('click', (e) => {
        const target = e.target as Element;

        // If clicking inside our extension
        if (isInsideExtension(target)) {
            const isInteractiveElement =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||  // ✅ Added SELECT
                target.tagName === 'OPTION' ||  // ✅ Added OPTION
                target.getAttribute('contenteditable') === 'true' ||
                target.closest('input, textarea, select, [contenteditable="true"]');

            // If it's NOT an interactive element, restore focus to video after a short delay
            if (!isInteractiveElement && !isSelectDropdownActive()) {
                setTimeout(() => {
                    returnFocusToVideo();
                }, 50);
            }
        }
    }, true);

    // Also handle on the container level
    const setupContainerHandler = () => {
        const containers = document.querySelectorAll('.vidscholar-app, #floating-note-form');
        containers.forEach(container => {
            if ((container as any).__keyboardHandlerSetup) return;
            (container as any).__keyboardHandlerSetup = true;

            container.addEventListener('keydown', (e) => {
                const target = e.target as Element;
                const isInputElement =
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.getAttribute('contenteditable') === 'true';

                if (isInputElement) {
                    // Stop propagation to prevent YouTube handlers
                    e.stopPropagation();
                }
            }, true);
        });
    };

    // Run initially and observe for new containers
    setupContainerHandler();

    // Use MutationObserver to handle dynamically added containers
    const observer = new MutationObserver(() => {
        setupContainerHandler();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Return focus to the video player so YouTube keyboard shortcuts work
 */
function returnFocusToVideo(): void {
    // Don't steal focus if user is in an input
    if (isExtensionInputFocused()) return;

    // Try to focus the video player
    const videoPlayer = document.querySelector('video');
    if (videoPlayer) {
        // Blur current active element first
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && isInsideExtension(activeElement)) {
            activeElement.blur();
        }

        // Focus the movie player container (YouTube's keyboard handler target)
        const moviePlayer = document.querySelector('#movie_player') as HTMLElement;
        if (moviePlayer) {
            moviePlayer.focus();
        }
    }
}

/**
 * Remove focus from extension inputs and return focus to video
 */
export function blurExtensionInputs(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && isInsideExtension(activeElement)) {
        activeElement.blur();
    }
}

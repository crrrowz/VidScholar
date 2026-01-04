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
 * Remove focus from extension inputs and return focus to video
 */
export function blurExtensionInputs(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && isInsideExtension(activeElement)) {
        activeElement.blur();
    }
}

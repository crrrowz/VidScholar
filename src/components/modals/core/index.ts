/**
 * Modal Core - Barrel Export
 * 
 * تصدير جميع مكونات Modal Core
 */

// Types
export type {
    ModalSize,
    ModalAnimation,
    ModalConfig,
    ModalElements,
    ModalResult,
    ConfirmModalOptions,
    PromptModalOptions,
    CleanupFn
} from './types';

// Factory
export {
    createModal,
    addModalHeader,
    addModalFooter,
    isModalOpen
} from './ModalFactory';

// Overlay
export {
    createOverlay,
    createContainer,
    showOverlay,
    hideOverlay,
    destroyOverlay
} from './ModalOverlay';

// Keyboard
export {
    attachEscapeHandler,
    attachFocusTrap,
    saveFocus,
    attachKeyboardShortcuts
} from './ModalKeyboard';

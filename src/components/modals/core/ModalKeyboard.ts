/**
 * Modal Keyboard - إدارة التفاعلات من لوحة المفاتيح
 */

import { rlog } from '../../../utils/refactorLogger';
import type { CleanupFn } from './types';

/**
 * إرفاق مستمع Escape للإغلاق
 */
export function attachEscapeHandler(onEscape: () => void): CleanupFn {
    rlog.modal.info('إرفاق Escape Handler');

    const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            rlog.modal.info('تم الضغط على Escape');
            e.preventDefault();
            onEscape();
        }
    };

    document.addEventListener('keydown', handler);

    return () => {
        rlog.modal.info('إزالة Escape Handler');
        document.removeEventListener('keydown', handler);
    };
}

/**
 * إرفاق focus trap داخل الـ modal
 */
export function attachFocusTrap(container: HTMLElement): CleanupFn {
    rlog.modal.info('إرفاق Focus Trap');

    const focusableSelector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    const getFocusableElements = (): HTMLElement[] => {
        return Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
    };

    const handler = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            // Tab
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    container.addEventListener('keydown', handler);

    // تركيز أول عنصر قابل للتركيز
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
        setTimeout(() => focusable[0]!.focus(), 100);
    }

    return () => {
        rlog.modal.info('إزالة Focus Trap');
        container.removeEventListener('keydown', handler);
    };
}

/**
 * حفظ واستعادة التركيز السابق
 */
export function saveFocus(): CleanupFn {
    const previousElement = document.activeElement as HTMLElement | null;
    rlog.modal.info('حفظ التركيز السابق', {
        element: previousElement?.tagName || 'none'
    });

    return () => {
        if (previousElement && typeof previousElement.focus === 'function') {
            rlog.modal.info('استعادة التركيز السابق');
            previousElement.focus();
        }
    };
}

/**
 * إرفاق اختصارات لوحة المفاتيح مخصصة
 */
export function attachKeyboardShortcuts(
    shortcuts: Array<{
        key: string;
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        handler: () => void;
    }>
): CleanupFn {
    rlog.modal.info('إرفاق اختصارات لوحة المفاتيح', {
        count: shortcuts.length
    });

    const handler = (e: KeyboardEvent) => {
        for (const shortcut of shortcuts) {
            const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey : !e.ctrlKey;
            const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
            const altMatch = shortcut.altKey ? e.altKey : !e.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                e.preventDefault();
                shortcut.handler();
                break;
            }
        }
    };

    document.addEventListener('keydown', handler);

    return () => {
        rlog.modal.info('إزالة اختصارات لوحة المفاتيح');
        document.removeEventListener('keydown', handler);
    };
}

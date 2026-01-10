/**
 * Modal Overlay - إنشاء وإدارة خلفية الـ modal
 */

import { rlog } from '../../../utils/refactorLogger';
import type { ModalConfig, ModalSize } from './types';

const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: 'modal-size-sm',
    md: 'modal-size-md',
    lg: 'modal-size-lg',
    xl: 'modal-size-xl',
    fullscreen: 'modal-size-fullscreen'
};

/**
 * إنشاء overlay للـ modal
 */
export function createOverlay(config: ModalConfig): HTMLElement {
    rlog.modal.info('إنشاء Modal Overlay', { id: config.id });

    const overlay = document.createElement('div');
    overlay.id = config.id;
    overlay.className = `modal-overlay ${config.className || ''}`.trim();
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // تطبيق z-index إذا تم تحديده
    if (config.zIndex) {
        overlay.style.zIndex = String(config.zIndex);
    }

    // تطبيق الاتجاه
    const direction = config.direction === 'auto' ? 'inherit' : config.direction;
    if (direction && direction !== 'inherit') {
        overlay.setAttribute('dir', direction);
    }

    return overlay;
}

/**
 * إنشاء حاوية المحتوى
 */
export function createContainer(config: ModalConfig): HTMLElement {
    rlog.modal.info('إنشاء Modal Container', { id: config.id, size: config.size });

    const container = document.createElement('div');
    container.className = `modal-container ${SIZE_CLASSES[config.size || 'md']}`.trim();
    container.setAttribute('role', 'document');

    // منع انتشار النقر للإغلاق
    container.addEventListener('click', (e) => e.stopPropagation());

    return container;
}

/**
 * إظهار الـ modal مع أنيميشن
 */
export function showOverlay(overlay: HTMLElement): void {
    rlog.modal.info('إظهار Modal', { id: overlay.id });

    // منع التمرير في body
    document.body.style.overflow = 'hidden';

    // إضافة للـ DOM
    const root = document.querySelector('#vidscholar-root') || document.body;
    root.appendChild(overlay);

    // تفعيل الأنيميشن
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });
}

/**
 * إخفاء الـ modal مع أنيميشن
 */
export function hideOverlay(overlay: HTMLElement): Promise<void> {
    rlog.modal.info('إخفاء Modal', { id: overlay.id });

    return new Promise((resolve) => {
        overlay.classList.remove('visible');

        const handleTransitionEnd = () => {
            overlay.removeEventListener('transitionend', handleTransitionEnd);
            resolve();
        };

        overlay.addEventListener('transitionend', handleTransitionEnd);

        // Fallback في حالة عدم حدوث transition
        setTimeout(() => {
            resolve();
        }, 300);
    });
}

/**
 * إزالة الـ modal من DOM
 */
export function destroyOverlay(overlay: HTMLElement): void {
    rlog.modal.info('تدمير Modal', { id: overlay.id });

    // إعادة التمرير
    document.body.style.overflow = '';

    // إزالة من DOM
    if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

/**
 * التحقق من وجود modal مفتوح بنفس الـ id
 */
export function isModalOpen(id: string): boolean {
    return document.querySelector(`#${id}`) !== null;
}

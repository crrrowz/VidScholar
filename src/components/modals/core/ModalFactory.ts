/**
 * Modal Factory - مصنع إنشاء الـ modals
 * 
 * نقطة الدخول الرئيسية لإنشاء modals موحدة
 */

import { rlog } from '../../../utils/refactorLogger';
import { languageService } from '../../../services/LanguageService';
import type { ModalConfig, ModalResult, CleanupFn } from './types';
import {
    createOverlay,
    createContainer,
    showOverlay,
    hideOverlay,
    destroyOverlay,
    isModalOpen
} from './ModalOverlay';
import {
    attachEscapeHandler,
    attachFocusTrap,
    saveFocus
} from './ModalKeyboard';

// Default configuration
const DEFAULT_CONFIG: Partial<ModalConfig> = {
    size: 'md',
    closeOnEscape: true,
    closeOnClickOutside: true,
    showCloseButton: false,
    direction: 'auto',
    animation: 'fade'
};

/**
 * إنشاء modal جديد
 */
export function createModal<T = boolean>(
    config: ModalConfig
): ModalResult<T> {
    const startTime = performance.now();
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    rlog.startTimer(`modal_${config.id}`);
    rlog.modal.info('🏗️ بدء إنشاء Modal', {
        id: config.id,
        config: mergedConfig
    });

    // التحقق من عدم وجود modal مفتوح بنفس الـ id
    if (isModalOpen(config.id)) {
        rlog.modal.warn('Modal موجود مسبقاً', { id: config.id });
        throw new Error(`Modal with id "${config.id}" is already open`);
    }

    // قائمة دوال التنظيف
    const cleanupFns: CleanupFn[] = [];

    // حفظ التركيز الحالي
    cleanupFns.push(saveFocus());

    // إنشاء العناصر
    const overlay = createOverlay(mergedConfig);
    const container = createContainer(mergedConfig);

    // إنشاء أقسام المحتوى
    const body = document.createElement('div');
    body.className = 'modal-body';

    container.appendChild(body);
    overlay.appendChild(container);

    // تطبيق الاتجاه بناءً على اللغة
    if (mergedConfig.direction === 'auto') {
        const updateDirection = () => {
            container.setAttribute('dir', languageService.getCurrentDirection());
        };
        updateDirection();
        languageService.addDirectionListener(updateDirection);
        cleanupFns.push(() => languageService.removeDirectionListener(updateDirection));
    }

    // متغيرات الحالة
    let isClosing = false;
    let resolvePromise: (value: T | undefined) => void;

    // Promise للإغلاق
    const onClose = new Promise<T | undefined>((resolve) => {
        resolvePromise = resolve;
    });

    // دالة الإغلاق
    const close = async (result?: T) => {
        if (isClosing) {
            rlog.modal.warn('محاولة إغلاق Modal مغلق', { id: config.id });
            return;
        }

        isClosing = true;
        rlog.modal.info('🚪 إغلاق Modal', { id: config.id, result });

        // تشغيل جميع دوال التنظيف
        cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (error) {
                rlog.modal.error('خطأ في التنظيف', error);
            }
        });

        // إخفاء وإزالة
        await hideOverlay(overlay);
        destroyOverlay(overlay);

        // حل Promise
        resolvePromise(result);

        const duration = Math.round(performance.now() - startTime);
        rlog.modal.success('✅ تم إغلاق Modal', {
            id: config.id,
            durationMs: duration
        });
    };

    // دالة التدمير (للحالات غير الطبيعية)
    const destroy = () => {
        rlog.modal.warn('تدمير Modal بالقوة', { id: config.id });
        cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (error) {
                rlog.modal.error('خطأ في التنظيف', error);
            }
        });
        destroyOverlay(overlay);
        resolvePromise(undefined);
    };

    // إرفاق Escape handler
    if (mergedConfig.closeOnEscape) {
        cleanupFns.push(attachEscapeHandler(() => close(undefined)));
    }

    // إرفاق Focus trap
    cleanupFns.push(attachFocusTrap(container));

    // إرفاق Click outside handler
    if (mergedConfig.closeOnClickOutside) {
        const clickHandler = (e: MouseEvent) => {
            if (e.target === overlay) {
                close(undefined);
            }
        };
        overlay.addEventListener('click', clickHandler);
        cleanupFns.push(() => overlay.removeEventListener('click', clickHandler));
    }

    // إظهار الـ modal
    showOverlay(overlay);

    rlog.endTimer(`modal_${config.id}`, 'MODAL_FRAMEWORK', 'اكتمل إنشاء Modal', {
        id: config.id
    });

    return {
        elements: {
            overlay,
            container,
            body
        },
        close,
        onClose,
        destroy
    };
}

/**
 * إضافة header للـ modal
 */
export function addModalHeader(
    container: HTMLElement,
    title: string,
    onClose?: () => void
): HTMLElement {
    const header = document.createElement('div');
    header.className = 'modal-header';

    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (onClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-btn';
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        closeBtn.addEventListener('click', onClose);
        header.appendChild(closeBtn);
    }

    // إدراج قبل body
    const body = container.querySelector('.modal-body');
    if (body) {
        container.insertBefore(header, body);
    } else {
        container.appendChild(header);
    }

    return header;
}

/**
 * إضافة footer للـ modal
 */
export function addModalFooter(container: HTMLElement): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    container.appendChild(footer);
    return footer;
}

export { isModalOpen };

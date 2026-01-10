/**
 * Confirm Modal - Modal تأكيد بسيط باستخدام Modal Core
 */

import { createModal, addModalHeader, addModalFooter } from '../core';
import type { ConfirmModalOptions } from '../core/types';
import { createButton } from '../../ui/Button';
import { languageService } from '../../../services/LanguageService';
import { rlog } from '../../../utils/refactorLogger';

/**
 * عرض modal تأكيد باستخدام Modal Core الجديد
 */
export async function showConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
    rlog.modal.info('🔔 فتح Confirm Modal', { title: options.title });

    const confirmText = options.confirmText || languageService.translate('confirm');
    const cancelText = options.cancelText || languageService.translate('cancelButton');

    // إنشاء الـ modal
    const { elements, close, onClose } = createModal<boolean>({
        id: 'confirmModal',
        size: 'sm',
        closeOnEscape: true,
        closeOnClickOutside: true,
        direction: 'auto'
    });

    const { container, body } = elements;

    // إضافة Header
    addModalHeader(container, options.title, () => close(false));

    // المحتوى
    body.className = 'modal-body confirm-modal-body';
    body.innerHTML = options.message;

    // إضافة Footer مع الأزرار
    const footer = addModalFooter(container);
    footer.className = 'modal-footer confirm-modal-footer';

    // زر الإلغاء
    if (!options.hideCancelButton) {
        const cancelButton = createButton(
            null,
            cancelText,
            () => close(false),
            'confirmModal-cancel',
            'default'
        );
        cancelButton.className = 'btn btn--default modal-btn';
        footer.appendChild(cancelButton);
    }

    // زر التأكيد
    const confirmVariant = options.confirmButtonType === 'danger' ? 'danger' :
        options.confirmButtonType === 'success' ? 'success' : 'primary';
    const confirmButton = createButton(
        null,
        confirmText,
        () => close(true),
        'confirmModal-confirm',
        confirmVariant
    );
    confirmButton.className = `btn btn--${confirmVariant} modal-btn`;
    footer.appendChild(confirmButton);

    // انتظار الإغلاق
    const result = await onClose;

    rlog.modal.success('✅ Confirm Modal مغلق', {
        title: options.title,
        result: result ?? false
    });

    return result ?? false;
}

/**
 * Shortcut للتأكيد السريع
 */
export async function confirm(message: string, title?: string): Promise<boolean> {
    return showConfirmModal({
        title: title || languageService.translate('confirm'),
        message
    });
}

/**
 * Shortcut لتأكيد الحذف
 */
export async function confirmDelete(itemName: string): Promise<boolean> {
    return showConfirmModal({
        title: languageService.translate('confirmDelete'),
        message: languageService.translate('confirmDeleteMessage', [itemName]),
        confirmText: languageService.translate('delete'),
        confirmButtonType: 'danger'
    });
}

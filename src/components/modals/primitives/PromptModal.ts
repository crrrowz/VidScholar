/**
 * Prompt Modal - Modal إدخال نص باستخدام Modal Core
 */

import { createModal, addModalHeader, addModalFooter } from '../core';
import type { PromptModalOptions } from '../core/types';
import { createButton } from '../../ui/Button';
import { languageService } from '../../../services/LanguageService';
import { rlog } from '../../../utils/refactorLogger';

/**
 * عرض modal لإدخال نص باستخدام Modal Core الجديد
 */
export async function showPromptModal(options: PromptModalOptions): Promise<string | null> {
    rlog.modal.info('📝 فتح Prompt Modal', { title: options.title });

    const confirmText = options.confirmText || languageService.translate('confirm');
    const cancelText = options.cancelText || languageService.translate('cancelButton');

    // إنشاء الـ modal
    const { elements, close, onClose } = createModal<string | null>({
        id: 'promptModal',
        size: 'sm',
        closeOnEscape: true,
        closeOnClickOutside: false, // منع الإغلاق بالنقر خارجاً للحفاظ على البيانات
        direction: 'auto'
    });

    const { container, body } = elements;

    // إضافة Header
    addModalHeader(container, options.title, () => close(null));

    // المحتوى
    body.className = 'modal-body prompt-modal-body';

    // التسمية
    if (options.message) {
        const label = document.createElement('label');
        label.className = 'prompt-modal-label';
        label.textContent = options.message;
        body.appendChild(label);
    }

    // إنشاء حقل الإدخال
    let inputElement: HTMLInputElement | HTMLTextAreaElement;

    if (options.inputType === 'textarea') {
        inputElement = document.createElement('textarea');
        inputElement.className = 'prompt-modal-textarea';
        inputElement.rows = 4;
    } else {
        inputElement = document.createElement('input');
        inputElement.className = 'prompt-modal-input';
        inputElement.type = options.inputType || 'text';
    }

    inputElement.value = options.defaultValue || '';
    inputElement.placeholder = options.placeholder || '';
    body.appendChild(inputElement);

    // رسالة الخطأ
    const errorMsg = document.createElement('div');
    errorMsg.className = 'prompt-modal-error';
    errorMsg.style.display = 'none';
    body.appendChild(errorMsg);

    // إضافة Footer مع الأزرار
    const footer = addModalFooter(container);
    footer.className = 'modal-footer prompt-modal-footer';

    // دالة التحقق والتأكيد
    const validateAndConfirm = () => {
        const value = inputElement.value.trim();

        // التحقق من صحة القيمة
        if (options.validator) {
            const validationResult = options.validator(value);

            if (validationResult !== true) {
                errorMsg.textContent = typeof validationResult === 'string'
                    ? validationResult
                    : languageService.translate('invalidInput');
                errorMsg.style.display = 'block';
                inputElement.classList.add('input-error');
                inputElement.focus();
                return;
            }
        }

        close(value);
    };

    // زر الإلغاء
    const cancelButton = createButton(
        null,
        cancelText,
        () => close(null),
        'promptModal-cancel',
        'default'
    );
    cancelButton.className = 'btn btn--default modal-btn';
    footer.appendChild(cancelButton);

    // زر التأكيد
    const confirmButton = createButton(
        null,
        confirmText,
        validateAndConfirm,
        'promptModal-confirm',
        'primary'
    );
    confirmButton.className = 'btn btn--primary modal-btn';
    footer.appendChild(confirmButton);

    // التركيز على حقل الإدخال
    setTimeout(() => {
        inputElement.focus();
        if (options.defaultValue) {
            inputElement.select();
        }
    }, 100);

    // Enter للتأكيد (فقط للـ input وليس textarea)
    if (options.inputType !== 'textarea') {
        inputElement.addEventListener('keydown', (e) => {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter') {
                e.preventDefault();
                validateAndConfirm();
            }
        });
    }

    // إزالة الخطأ عند الكتابة
    inputElement.addEventListener('input', () => {
        errorMsg.style.display = 'none';
        inputElement.classList.remove('input-error');
    });

    // انتظار الإغلاق
    const result = await onClose;

    rlog.modal.success('✅ Prompt Modal مغلق', {
        title: options.title,
        hasValue: result !== null
    });

    return result ?? null;
}

/**
 * Shortcut للإدخال السريع
 */
export async function prompt(
    message: string,
    defaultValue?: string,
    title?: string
): Promise<string | null> {
    return showPromptModal({
        title: title || languageService.translate('input'),
        message,
        defaultValue
    });
}

/**
 * Shortcut لإعادة التسمية
 */
export async function promptRename(
    currentName: string,
    itemType?: string
): Promise<string | null> {
    const title = itemType
        ? languageService.translate('rename') + ' ' + itemType
        : languageService.translate('rename');

    return showPromptModal({
        title,
        message: languageService.translate('enterNewName'),
        defaultValue: currentName,
        validator: (value) => value.length > 0 || languageService.translate('nameRequired')
    });
}

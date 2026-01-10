/**
 * Modal Core Types
 * 
 * تعريفات الأنواع الأساسية لإطار عمل Modal
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
export type ModalAnimation = 'fade' | 'slide-up' | 'scale';

export interface ModalConfig {
    /** معرف فريد للـ modal */
    id: string;
    /** حجم الـ modal */
    size?: ModalSize;
    /** CSS classes إضافية */
    className?: string;
    /** إغلاق عند الضغط على Escape */
    closeOnEscape?: boolean;
    /** إغلاق عند النقر خارج الـ modal */
    closeOnClickOutside?: boolean;
    /** إظهار زر الإغلاق */
    showCloseButton?: boolean;
    /** اتجاه النص */
    direction?: 'auto' | 'ltr' | 'rtl';
    /** نوع الأنيميشن */
    animation?: ModalAnimation;
    /** z-index مخصص */
    zIndex?: number;
}

export interface ModalElements {
    /** العنصر الخلفي (overlay) */
    overlay: HTMLElement;
    /** حاوية المحتوى */
    container: HTMLElement;
    /** رأس الـ modal (اختياري) */
    header?: HTMLElement;
    /** محتوى الـ modal */
    body: HTMLElement;
    /** ذيل الـ modal (اختياري) */
    footer?: HTMLElement;
}

export interface ModalResult<T = unknown> {
    /** الـ modal elements */
    elements: ModalElements;
    /** دالة الإغلاق مع نتيجة */
    close: (result?: T) => void;
    /** Promise ينتهي عند إغلاق الـ modal */
    onClose: Promise<T | undefined>;
    /** تنظيف الموارد */
    destroy: () => void;
}

export interface ConfirmModalOptions {
    /** عنوان الـ modal */
    title: string;
    /** الرسالة */
    message: string;
    /** نص زر التأكيد */
    confirmText?: string;
    /** نص زر الإلغاء */
    cancelText?: string;
    /** نوع زر التأكيد */
    confirmButtonType?: 'primary' | 'danger' | 'success';
    /** إخفاء زر الإلغاء */
    hideCancelButton?: boolean;
}

export interface PromptModalOptions {
    /** عنوان الـ modal */
    title: string;
    /** الرسالة/التسمية */
    message: string;
    /** القيمة الافتراضية */
    defaultValue?: string;
    /** placeholder للـ input */
    placeholder?: string;
    /** نص زر التأكيد */
    confirmText?: string;
    /** نص زر الإلغاء */
    cancelText?: string;
    /** نوع الـ input */
    inputType?: 'text' | 'textarea' | 'number' | 'email';
    /** التحقق من الإدخال */
    validator?: (value: string) => boolean | string;
}

export type CleanupFn = () => void;

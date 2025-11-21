// utils/toast.ts
import type { ToastType } from '../types';

export function showToast(message: string, type: ToastType = 'info'): void {
  const prefix = `[${type.toUpperCase()}]`;

  switch (type) {
    case 'error':
      console.error(prefix, message);
      break;
    case 'warning':
      console.warn(prefix, message);
      break;
    case 'success':
      // استخدام تنسيق CSS داخل الكونسول لتمييز رسائل النجاح باللون الأخضر
      console.log(`%c${prefix} ${message}`, 'color: #43a047; font-weight: bold;');
      break;
    case 'info':
    default:
      console.info(prefix, message);
      break;
  }
}
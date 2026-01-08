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
    case 'info':
    default:
      // Success and info are not logged in production
      break;

  }
}
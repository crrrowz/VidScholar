// src/components/modals/ConfirmDialog.ts
import { themeService } from '../../services/ThemeService';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import { styleToolbarButton } from '../../utils/ui';
import config from '../../utils/config';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonType?: 'default' | 'danger';
  hideCancelButton?: boolean;
}

export async function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector("#confirmDialog")) return;

    const overlay = document.createElement('div');
    overlay.id = "confirmDialog";
    overlay.className = "confirm-dialog-overlay";

    const closeDialog = (result: boolean) => {
      overlay.classList.remove('visible');
      setTimeout(() => {
          overlay.remove();
          document.body.style.overflow = '';
          resolve(result);
      }, 200);
    };

    document.querySelector("#vidscholar-root")?.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';
    
    const container = document.createElement('div');
    container.className = "confirm-dialog-container";
    container.setAttribute('dir', languageService.getCurrentDirection());

    const header = document.createElement('div');
    header.className = "confirm-dialog-header";

    const title = document.createElement('h3');
    title.textContent = options.title;
    header.appendChild(title);

    const content = document.createElement('div');
    content.className = "confirm-dialog-content";
    content.innerHTML = options.message;

    const footer = document.createElement('div');
    footer.className = "confirm-dialog-footer";

    if (!options.hideCancelButton) {
      const cancelButton = createButton(null, options.cancelText || languageService.translate("cancelButton"), () => closeDialog(false), undefined, 'default');
      footer.appendChild(cancelButton);
    }

    const confirmButtonVariant = options.confirmButtonType === 'danger' ? 'danger' : 'primary';
    const confirmButton = createButton(null, options.confirmText || languageService.translate("confirm"), () => closeDialog(true), undefined, confirmButtonVariant);

    footer.appendChild(confirmButton);

    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);
    overlay.appendChild(container);

    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeDialog(false);
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(false); });
  });
}
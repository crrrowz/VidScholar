// src/components/modals/PromptDialog.ts
import { themeService } from '../../services/ThemeService';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import { styleToolbarButton } from '../../utils/ui';

export interface PromptDialogOptions {
  title: string;
  message: string;
  defaultValue?: string;
  inputType?: 'text' | 'number';
  confirmText?: string;
  cancelText?: string;
}

export async function showPromptDialog(options: PromptDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (document.querySelector("#promptDialog")) return;

    const overlay = document.createElement('div');
    overlay.id = "promptDialog";
    overlay.className = "prompt-dialog-overlay";

    const closeDialog = (result: string | null) => {
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
    container.className = "prompt-dialog-container";
    container.setAttribute('dir', languageService.getCurrentDirection());

    const header = document.createElement('div');
    header.className = "prompt-dialog-header";

    const title = document.createElement('h3');
    title.textContent = options.title;
    header.appendChild(title);

    const content = document.createElement('div');
    content.className = "prompt-dialog-content";
    
    const message = document.createElement('p');
    message.textContent = options.message;

    const input = document.createElement('input');
    input.type = options.inputType || 'text';
    input.value = options.defaultValue || '';

    content.appendChild(message);
    content.appendChild(input);

    const footer = document.createElement('div');
    footer.className = "prompt-dialog-footer";

    const cancelButton = createButton(null, options.cancelText || languageService.translate("cancelButton"), () => closeDialog(null), undefined, 'default');
    const confirmButton = createButton(null, options.confirmText || languageService.translate("confirm"), () => closeDialog(input.value), undefined, 'primary');

    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);

    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);
    overlay.appendChild(container);

    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeDialog(null);
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(null); });
  });
}

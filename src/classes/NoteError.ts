// classes/NoteError.ts
import { languageService } from '../services/LanguageService';

export class NoteError extends Error {
  type: string;
  
  constructor(message: string, type = 'general') {
    super(message);
    this.name = 'NoteError';
    this.type = type;
  }
}

export function showUserFriendlyError(error: NoteError, initCallback?: () => void): void {
  console.error('Error details:', error);
  
  const messages: Record<string, string> = {
    'loading': languageService.translate("errorLoading"),
    'storage': languageService.translate("errorStorage"),
    'network': languageService.translate("errorNetwork"),
    'general': languageService.translate("errorGeneral")
  };

  const message = messages[error.type] || messages.general;
  
  // Import dynamically to avoid circular dependency
  import('../utils/toast').then(({ showToast }) => {
    showToast(message, 'warning');
  });

  if (error.type === 'loading' && initCallback) {
    setTimeout(() => initCallback(), 3000);
  }
}
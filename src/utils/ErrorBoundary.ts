// src/utils/ErrorBoundary.ts
import type { AppError, ErrorCategory, ErrorSeverity } from '../types';
import { showToast } from './toast';
import { languageService } from '../services/LanguageService';

interface ErrorHandler {
  (error: AppError): void;
}

class ErrorBoundary {
  private handlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private errorLog: AppError[] = [];
  private maxLogSize = 100;
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Register error handler for specific category
   */
  on(category: ErrorCategory, handler: ErrorHandler): () => void {
    if (!this.handlers.has(category)) {
      this.handlers.set(category, []);
    }
    this.handlers.get(category)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(category);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle error with automatic categorization
   */
  handle(error: Error | AppError | string, category?: ErrorCategory): void {
    const appError = this.normalizeError(error, category);
    
    // Log error
    this.logError(appError);

    // Execute handlers
    this.executeHandlers(appError);

    // Show user notification
    this.notifyUser(appError);

    // Report if critical
    if (appError.severity === 'critical') {
      this.reportCriticalError(appError);
    }
  }

  /**
   * Wrap async function with error handling
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    category: ErrorCategory = 'general'
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error as Error, category);
        throw error;
      }
    }) as T;
  }

  /**
   * Try-catch wrapper with recovery
   */
  async try<T>(
    fn: () => Promise<T>,
    fallback: T,
    category: ErrorCategory = 'general'
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error as Error, category);
      return fallback;
    }
  }

  /**
   * Get error log
   */
  getErrorLog(): readonly AppError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearLog(): void {
    this.errorLog = [];
  }

  /**
   * Export error log
   */
  exportLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  private normalizeError(
    error: Error | AppError | string,
    category?: ErrorCategory
  ): AppError {
    // Already normalized
    if (this.isAppError(error)) {
      return error;
    }

    // From Error object
    if (error instanceof Error) {
      return {
        message: error.message,
        category: category || this.categorizeError(error),
        severity: this.determineSeverity(error),
        timestamp: Date.now(),
        stack: error.stack
      };
    }

    // From string
    return {
      message: String(error),
      category: category || 'general',
      severity: 'medium',
      timestamp: Date.now()
    };
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('storage') || message.includes('quota')) {
      return 'storage';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'validation';
    }
    
    return 'general';
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return 'low';
    }
    if (message.includes('error')) {
      return 'high';
    }
    
    return 'medium';
  }

  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    // Limit log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Console log in development
    if (!this.isProduction) {
      console.error('[ErrorBoundary]', error);
    }
  }

  private executeHandlers(error: AppError): void {
    const handlers = this.handlers.get(error.category) || [];
    handlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  private notifyUser(error: AppError): void {
    // Don't show toast for low severity in production
    if (this.isProduction && error.severity === 'low') {
      return;
    }

    const message = this.getUserFriendlyMessage(error);
    const type = error.severity === 'critical' ? 'error' : 'warning';
    
    showToast(message, type);
  }

  private getUserFriendlyMessage(error: AppError): string {
    // Check for translated error messages
    const errorKey = `error.${error.category}.${error.message}`;
    const translated = languageService.translate(errorKey);
    
    if (translated !== errorKey) {
      return translated;
    }

    // Fallback to generic messages
    switch (error.category) {
      case 'network':
        return languageService.translate('error.network.generic');
      case 'storage':
        return languageService.translate('error.storage.generic');
      case 'validation':
        return languageService.translate('error.validation.generic');
      default:
        return error.message;
    }
  }

  private reportCriticalError(error: AppError): void {
    // In production, send to error reporting service
    if (this.isProduction) {
      // TODO: Implement error reporting (Sentry, etc.)
      console.error('Critical error:', error);
    }
  }

  private isAppError(obj: any): obj is AppError {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'message' in obj &&
      'category' in obj &&
      'severity' in obj
    );
  }
}

// Global error boundary
export const errorBoundary = new ErrorBoundary();

// Setup global error handlers
export function initializeErrorBoundary(): void {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorBoundary.handle(event.reason, 'general');
    event.preventDefault();
  });

  // Catch global errors
  window.addEventListener('error', (event) => {
    errorBoundary.handle(event.error, 'general');
  });
}
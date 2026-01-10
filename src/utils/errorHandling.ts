/**
 * Error Handling Utilities - أدوات معالجة الأخطاء الموحدة
 * 
 * توفر نمطاً موحداً لمعالجة الأخطاء في جميع أنحاء التطبيق
 */

import { rlog, type RefactorZone } from './refactorLogger';

// ============ Error Types ============

export class VidScholarError extends Error {
    public readonly code: string;
    public readonly zone: RefactorZone;
    public readonly context?: Record<string, unknown>;
    public readonly cause?: Error;
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: string,
        zone: RefactorZone,
        options?: {
            context?: Record<string, unknown>;
            cause?: Error;
        }
    ) {
        super(message);
        this.name = 'VidScholarError';
        this.code = code;
        this.zone = zone;
        this.context = options?.context;
        this.cause = options?.cause;
        this.timestamp = new Date();

        // للتوافق مع الـ stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, VidScholarError);
        }
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            zone: this.zone,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack
        };
    }
}

// أنواع أخطاء محددة
export class StorageError extends VidScholarError {
    constructor(message: string, code: string, context?: Record<string, unknown>, cause?: Error) {
        super(message, code, 'STORAGE_LAYER', { context, cause });
        this.name = 'StorageError';
    }
}

export class NetworkError extends VidScholarError {
    constructor(message: string, code: string, context?: Record<string, unknown>, cause?: Error) {
        super(message, code, 'IMPORT_EXPORT', { context, cause });
        this.name = 'NetworkError';
    }
}

export class ValidationError extends VidScholarError {
    constructor(message: string, field: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_FAILED', 'GENERAL', { context: { field, ...context } });
        this.name = 'ValidationError';
    }
}

export class InitializationError extends VidScholarError {
    constructor(message: string, component: string, cause?: Error) {
        super(message, 'INIT_FAILED', 'INITIALIZATION', { context: { component }, cause });
        this.name = 'InitializationError';
    }
}

// ============ Error Codes ============

export const ErrorCodes = {
    // Storage
    STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
    STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
    STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',

    // Network
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE: 'NETWORK_OFFLINE',
    NETWORK_AUTH_FAILED: 'NETWORK_AUTH_FAILED',

    // Sync
    SYNC_CONFLICT: 'SYNC_CONFLICT',
    SYNC_FAILED: 'SYNC_FAILED',

    // Validation
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INVALID_FORMAT: 'INVALID_FORMAT',

    // General
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    OPERATION_CANCELLED: 'OPERATION_CANCELLED',
    NOT_FOUND: 'NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============ Error Handling Functions ============

/**
 * معالج أخطاء موحد
 */
export function handleError(
    error: unknown,
    zone: RefactorZone,
    action: string,
    context?: Record<string, unknown>
): VidScholarError {
    // تسجيل الخطأ
    rlog.error(zone, action, error, context);

    // تحويل لـ VidScholarError
    if (error instanceof VidScholarError) {
        return error;
    }

    if (error instanceof Error) {
        return new VidScholarError(
            error.message,
            ErrorCodes.UNKNOWN_ERROR,
            zone,
            { context, cause: error }
        );
    }

    return new VidScholarError(
        String(error),
        ErrorCodes.UNKNOWN_ERROR,
        zone,
        { context }
    );
}

/**
 * غلاف للدوال غير المتزامنة مع معالجة أخطاء تلقائية
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    zone: RefactorZone,
    action: string,
    options?: {
        context?: Record<string, unknown>;
        fallback?: T;
        rethrow?: boolean;
    }
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        const handledError = handleError(error, zone, action, options?.context);

        if (options?.rethrow !== false) {
            throw handledError;
        }

        if (options?.fallback !== undefined) {
            return options.fallback;
        }

        throw handledError;
    }
}

/**
 * غلاف للدوال المتزامنة مع معالجة أخطاء تلقائية
 */
export function withErrorHandlingSync<T>(
    fn: () => T,
    zone: RefactorZone,
    action: string,
    options?: {
        context?: Record<string, unknown>;
        fallback?: T;
        rethrow?: boolean;
    }
): T {
    try {
        return fn();
    } catch (error) {
        const handledError = handleError(error, zone, action, options?.context);

        if (options?.rethrow !== false) {
            throw handledError;
        }

        if (options?.fallback !== undefined) {
            return options.fallback;
        }

        throw handledError;
    }
}

/**
 * إعادة المحاولة مع تراجع أسي
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        shouldRetry?: (error: unknown, attempt: number) => boolean;
        onRetry?: (error: unknown, attempt: number) => void;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 1000,
        maxDelayMs = 30000,
        shouldRetry = () => true,
        onRetry
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
                throw error;
            }

            const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

            rlog.warn('GENERAL', `إعادة المحاولة بعد ${delay}ms`, {
                attempt,
                maxAttempts,
                error: error instanceof Error ? error.message : String(error)
            });

            if (onRetry) {
                onRetry(error, attempt);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

// ============ Result Type (للتعامل مع الأخطاء بدون throw) ============

export type Result<T, E = VidScholarError> =
    | { success: true; data: T }
    | { success: false; error: E };

export function success<T>(data: T): Result<T, never> {
    return { success: true, data };
}

export function failure<E>(error: E): Result<never, E> {
    return { success: false, error };
}

/**
 * تحويل Promise لـ Result
 */
export async function toResult<T>(
    promise: Promise<T>,
    zone: RefactorZone,
    action: string
): Promise<Result<T>> {
    try {
        const data = await promise;
        return success(data);
    } catch (error) {
        return failure(handleError(error, zone, action));
    }
}

// ============ Utility Functions ============

/**
 * التحقق من نوع الخطأ
 */
export function isVidScholarError(error: unknown): error is VidScholarError {
    return error instanceof VidScholarError;
}

export function isStorageError(error: unknown): error is StorageError {
    return error instanceof StorageError;
}

export function isNetworkError(error: unknown): error is NetworkError {
    return error instanceof NetworkError;
}

/**
 * استخراج رسالة خطأ آمنة للعرض
 */
export function getSafeErrorMessage(error: unknown): string {
    if (error instanceof VidScholarError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'حدث خطأ غير متوقع';
}

/**
 * تنسيق الخطأ للتسجيل
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
    if (error instanceof VidScholarError) {
        return error.toJSON();
    }
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    return { error: String(error) };
}

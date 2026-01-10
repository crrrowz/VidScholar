/**
 * Refactoring Logger - نظام تتبع عمليات إعادة الهيكلة
 * 
 * يستخدم لتسجيل جميع العمليات أثناء إعادة الهيكلة لتسهيل تصحيح الأخطاء
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
type RefactorZone =
    | 'STORAGE_LAYER'
    | 'MODAL_FRAMEWORK'
    | 'SERVICE_SINGLETON'
    | 'IMPORT_EXPORT'
    | 'UI_COMPONENTS'
    | 'DRAG_DROP'
    | 'VIDEO_CONTEXT'
    | 'LOCALIZATION'
    | 'ERROR_HANDLING'
    | 'INITIALIZATION'
    | 'MESSAGE_PASSING'
    | 'GENERAL';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    zone: RefactorZone;
    action: string;
    details?: Record<string, unknown>;
    file?: string;
    function?: string;
    duration?: number;
}

type LogSession = {
    sessionId: string;
    startTime: string;
    entries: LogEntry[];
};

class RefactorLogger {
    private static instance: RefactorLogger | null = null;
    private currentSession: LogSession | null = null;
    private isEnabled: boolean = true;
    private logToConsole: boolean = true;
    private actionTimers: Map<string, number> = new Map();

    private constructor() {
        this.startSession();
    }

    static getInstance(): RefactorLogger {
        if (!RefactorLogger.instance) {
            RefactorLogger.instance = new RefactorLogger();
        }
        return RefactorLogger.instance;
    }

    /**
     * بدء جلسة تسجيل جديدة
     */
    startSession(): void {
        this.currentSession = {
            sessionId: this.generateSessionId(),
            startTime: new Date().toISOString(),
            entries: []
        };
        this.log('INFO', 'GENERAL', '🚀 بدء جلسة إعادة الهيكلة', {
            sessionId: this.currentSession.sessionId
        });
    }

    /**
     * تسجيل رسالة
     */
    log(
        level: LogLevel,
        zone: RefactorZone,
        action: string,
        details?: Record<string, unknown>,
        file?: string,
        functionName?: string
    ): void {
        if (!this.isEnabled || !this.currentSession) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            zone,
            action,
            details,
            file,
            function: functionName
        };

        this.currentSession.entries.push(entry);

        if (this.logToConsole) {
            this.printToConsole(entry);
        }
    }

    /**
     * بدء قياس وقت عملية
     */
    startTimer(actionId: string): void {
        this.actionTimers.set(actionId, performance.now());
    }

    /**
     * إنهاء قياس وقت عملية وتسجيلها
     */
    endTimer(
        actionId: string,
        zone: RefactorZone,
        action: string,
        details?: Record<string, unknown>
    ): void {
        const startTime = this.actionTimers.get(actionId);
        if (startTime) {
            const duration = Math.round(performance.now() - startTime);
            this.log('INFO', zone, action, { ...details, durationMs: duration });
            this.actionTimers.delete(actionId);
        }
    }

    // ============ Convenience Methods ============

    /**
     * تسجيل معلومات عادية
     */
    info(zone: RefactorZone, action: string, details?: Record<string, unknown>): void {
        this.log('INFO', zone, action, details);
    }

    /**
     * تسجيل تصحيح الأخطاء
     */
    debug(zone: RefactorZone, action: string, details?: Record<string, unknown>): void {
        this.log('DEBUG', zone, action, details);
    }

    /**
     * تسجيل تحذير
     */
    warn(zone: RefactorZone, action: string, details?: Record<string, unknown>): void {
        this.log('WARN', zone, action, details);
    }

    /**
     * تسجيل خطأ
     */
    error(zone: RefactorZone, action: string, error?: Error | unknown, details?: Record<string, unknown>): void {
        const errorDetails: Record<string, unknown> = { ...details };

        if (error instanceof Error) {
            errorDetails['errorMessage'] = error.message;
            errorDetails['errorStack'] = error.stack;
            errorDetails['errorName'] = error.name;
        } else if (error) {
            errorDetails['error'] = String(error);
        }

        this.log('ERROR', zone, action, errorDetails);
    }

    /**
     * تسجيل نجاح عملية
     */
    success(zone: RefactorZone, action: string, details?: Record<string, unknown>): void {
        this.log('SUCCESS', zone, action, details);
    }

    // ============ Zone-Specific Loggers ============

    /**
     * Logger خاص بطبقة التخزين
     */
    storage = {
        info: (action: string, details?: Record<string, unknown>) =>
            this.info('STORAGE_LAYER', action, details),
        error: (action: string, error?: Error | unknown, details?: Record<string, unknown>) =>
            this.error('STORAGE_LAYER', action, error, details),
        success: (action: string, details?: Record<string, unknown>) =>
            this.success('STORAGE_LAYER', action, details),
        warn: (action: string, details?: Record<string, unknown>) =>
            this.warn('STORAGE_LAYER', action, details),
    };

    /**
     * Logger خاص بإطار العمل Modal
     */
    modal = {
        info: (action: string, details?: Record<string, unknown>) =>
            this.info('MODAL_FRAMEWORK', action, details),
        error: (action: string, error?: Error | unknown, details?: Record<string, unknown>) =>
            this.error('MODAL_FRAMEWORK', action, error, details),
        success: (action: string, details?: Record<string, unknown>) =>
            this.success('MODAL_FRAMEWORK', action, details),
        warn: (action: string, details?: Record<string, unknown>) =>
            this.warn('MODAL_FRAMEWORK', action, details),
    };

    /**
     * Logger خاص بالخدمات
     */
    service = {
        info: (action: string, details?: Record<string, unknown>) =>
            this.info('SERVICE_SINGLETON', action, details),
        error: (action: string, error?: Error | unknown, details?: Record<string, unknown>) =>
            this.error('SERVICE_SINGLETON', action, error, details),
        success: (action: string, details?: Record<string, unknown>) =>
            this.success('SERVICE_SINGLETON', action, details),
        initialized: (serviceName: string) =>
            this.success('SERVICE_SINGLETON', `✅ تم تهيئة ${serviceName}`, { service: serviceName }),
    };

    /**
     * Logger خاص بالتهيئة
     */
    init = {
        starting: (component: string) =>
            this.info('INITIALIZATION', `🔄 بدء تهيئة ${component}`, { component }),
        completed: (component: string, durationMs?: number) =>
            this.success('INITIALIZATION', `✅ اكتملت تهيئة ${component}`, { component, durationMs }),
        failed: (component: string, error?: Error | unknown) =>
            this.error('INITIALIZATION', `❌ فشل تهيئة ${component}`, error, { component }),
    };

    // ============ Session Management ============

    /**
     * الحصول على سجل الجلسة الحالية
     */
    getSessionLog(): LogSession | null {
        return this.currentSession;
    }

    /**
     * الحصول على سجلات مفلترة
     */
    getFilteredLogs(filters: {
        level?: LogLevel;
        zone?: RefactorZone;
        fromTime?: string;
        toTime?: string;
    }): LogEntry[] {
        if (!this.currentSession) return [];

        return this.currentSession.entries.filter(entry => {
            if (filters.level && entry.level !== filters.level) return false;
            if (filters.zone && entry.zone !== filters.zone) return false;
            if (filters.fromTime && entry.timestamp < filters.fromTime) return false;
            if (filters.toTime && entry.timestamp > filters.toTime) return false;
            return true;
        });
    }

    /**
     * الحصول على جميع الأخطاء
     */
    getErrors(): LogEntry[] {
        return this.getFilteredLogs({ level: 'ERROR' });
    }

    /**
     * الحصول على إحصائيات الجلسة
     */
    getStats(): Record<string, unknown> {
        if (!this.currentSession) return {};

        const entries = this.currentSession.entries;
        const byLevel = entries.reduce((acc, e) => {
            acc[e.level] = (acc[e.level] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byZone = entries.reduce((acc, e) => {
            acc[e.zone] = (acc[e.zone] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            sessionId: this.currentSession.sessionId,
            startTime: this.currentSession.startTime,
            totalEntries: entries.length,
            byLevel,
            byZone,
            errorCount: byLevel['ERROR'] || 0,
            warningCount: byLevel['WARN'] || 0,
        };
    }

    /**
     * تصدير السجلات كـ JSON
     */
    exportAsJSON(): string {
        return JSON.stringify(this.currentSession, null, 2);
    }

    /**
     * مسح السجلات وبدء جلسة جديدة
     */
    clear(): void {
        this.startSession();
    }

    /**
     * تفعيل/تعطيل التسجيل
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * تفعيل/تعطيل طباعة Console
     */
    setConsoleLogging(enabled: boolean): void {
        this.logToConsole = enabled;
    }

    // ============ Private Methods ============

    private generateSessionId(): string {
        return `refactor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private printToConsole(entry: LogEntry): void {
        const colors: Record<LogLevel, string> = {
            DEBUG: 'color: #9E9E9E',
            INFO: 'color: #2196F3',
            WARN: 'color: #FF9800',
            ERROR: 'color: #F44336; font-weight: bold',
            SUCCESS: 'color: #4CAF50',
        };

        const icons: Record<LogLevel, string> = {
            DEBUG: '🔍',
            INFO: 'ℹ️',
            WARN: '⚠️',
            ERROR: '❌',
            SUCCESS: '✅',
        };

        const prefix = `[${icons[entry.level]} REFACTOR:${entry.zone}]`;
        const style = colors[entry.level];

        if (entry.details && Object.keys(entry.details).length > 0) {
            console.groupCollapsed(`%c${prefix} ${entry.action}`, style);
            console.log('Zone:', entry.zone);
            console.log('Time:', entry.timestamp);
            if (entry.file) console.log('File:', entry.file);
            if (entry.function) console.log('Function:', entry.function);
            console.log('Details:', entry.details);
            console.groupEnd();
        } else {
            console.log(`%c${prefix} ${entry.action}`, style);
        }
    }
}

// تصدير singleton
export const refactorLogger = RefactorLogger.getInstance();

// تصدير للاستخدام المباشر
export const rlog = {
    info: (zone: RefactorZone, action: string, details?: Record<string, unknown>) =>
        refactorLogger.info(zone, action, details),
    debug: (zone: RefactorZone, action: string, details?: Record<string, unknown>) =>
        refactorLogger.debug(zone, action, details),
    warn: (zone: RefactorZone, action: string, details?: Record<string, unknown>) =>
        refactorLogger.warn(zone, action, details),
    error: (zone: RefactorZone, action: string, error?: Error | unknown, details?: Record<string, unknown>) =>
        refactorLogger.error(zone, action, error, details),
    success: (zone: RefactorZone, action: string, details?: Record<string, unknown>) =>
        refactorLogger.success(zone, action, details),
    // Zone shortcuts
    storage: refactorLogger.storage,
    modal: refactorLogger.modal,
    service: refactorLogger.service,
    init: refactorLogger.init,
    // Timer
    startTimer: (id: string) => refactorLogger.startTimer(id),
    endTimer: (id: string, zone: RefactorZone, action: string, details?: Record<string, unknown>) =>
        refactorLogger.endTimer(id, zone, action, details),
    // Session
    getErrors: () => refactorLogger.getErrors(),
    getStats: () => refactorLogger.getStats(),
    exportAsJSON: () => refactorLogger.exportAsJSON(),
};

export type { LogLevel, RefactorZone, LogEntry, LogSession };

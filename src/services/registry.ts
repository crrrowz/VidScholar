/**
 * Service Registry - مسجل الخدمات
 * 
 * يدير تهيئة الخدمات بترتيب صحيح ويوفر نقطة دخول موحدة
 */

import { rlog } from '../utils/refactorLogger';

// Service Types
type ServiceName =
    | 'theme'
    | 'language'
    | 'encryption'
    | 'settings'
    | 'supabase'
    | 'backup'
    | 'noteActions'
    | 'noteNotification'
    | 'share'
    | 'screenshot';

type ServiceStatus = 'pending' | 'initializing' | 'ready' | 'failed';

interface ServiceState {
    status: ServiceStatus;
    instance: unknown;
    error?: Error;
    initTime?: number;
}

interface RegistryState {
    initialized: boolean;
    services: Map<ServiceName, ServiceState>;
    initOrder: ServiceName[];
    startTime: number;
}

class ServiceRegistry {
    private static instance: ServiceRegistry | null = null;
    private state: RegistryState;

    private constructor() {
        this.state = {
            initialized: false,
            services: new Map(),
            initOrder: [],
            startTime: 0
        };
        rlog.service.info('🏗️ Service Registry تم إنشاء');
    }

    static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    /**
     * تهيئة جميع الخدمات بالترتيب الصحيح
     */
    async initialize(): Promise<void> {
        if (this.state.initialized) {
            rlog.service.info('⚠️ الخدمات مُهيأة مسبقاً');
            return;
        }

        this.state.startTime = performance.now();
        rlog.init.starting('جميع الخدمات');

        try {
            // Phase 1: Core Services (لا تعتمد على خدمات أخرى)
            rlog.service.info('📦 Phase 1: تهيئة Core Services');
            await this.initPhase1();

            // Phase 2: Storage Services (تعتمد على Core)
            rlog.service.info('📦 Phase 2: تهيئة Storage Services');
            await this.initPhase2();

            // Phase 3: Domain Services (تعتمد على Storage)
            rlog.service.info('📦 Phase 3: تهيئة Domain Services');
            await this.initPhase3();

            this.state.initialized = true;
            const totalTime = Math.round(performance.now() - this.state.startTime);
            rlog.init.completed('جميع الخدمات', totalTime);

            // طباعة ملخص
            this.logSummary();
        } catch (error) {
            rlog.init.failed('Service Registry', error as Error);
            throw error;
        }
    }

    /**
     * Phase 1: Core Services - لا تعتمد على خدمات أخرى
     */
    private async initPhase1(): Promise<void> {
        // Theme Service
        await this.initService('theme', async () => {
            const { themeService } = await import('./ThemeService');
            return themeService;
        });

        // Language Service
        await this.initService('language', async () => {
            const { languageService } = await import('./LanguageService');
            return languageService;
        });

        // Encryption Service
        await this.initService('encryption', async () => {
            const { encryptionService } = await import('./EncryptionService');
            return encryptionService;
        });
    }

    /**
     * Phase 2: Storage Services - تعتمد على Core
     */
    private async initPhase2(): Promise<void> {
        // Settings Service (requires nothing, but loads from storage)
        await this.initService('settings', async () => {
            const { settingsService } = await import('./SettingsService');
            await settingsService.initialize();
            return settingsService;
        });

        // Supabase Service (requires settings for config)
        await this.initService('supabase', async () => {
            const { supabaseService } = await import('./SupabaseService');
            return supabaseService;
        });

        // Backup Service (requires settings, encryption)
        await this.initService('backup', async () => {
            const { backupService } = await import('./BackupService');
            return backupService;
        });
    }

    /**
     * Phase 3: Domain Services - تعتمد على Storage
     */
    private async initPhase3(): Promise<void> {
        // Screenshot Service
        await this.initService('screenshot', async () => {
            const { screenshotService } = await import('./ScreenshotService');
            return screenshotService;
        });

        // Share Service
        await this.initService('share', async () => {
            const { shareService } = await import('./ShareService');
            return shareService;
        });

        // Note Actions Service
        await this.initService('noteActions', async () => {
            const { noteActionsService } = await import('./NoteActionsService');
            return noteActionsService;
        });

        // Note Notification Service
        await this.initService('noteNotification', async () => {
            const { noteNotificationService } = await import('./NoteNotificationService');
            return noteNotificationService;
        });
    }

    /**
     * تهيئة خدمة واحدة مع logging
     */
    private async initService<T>(
        name: ServiceName,
        factory: () => Promise<T>
    ): Promise<T> {
        const startTime = performance.now();

        this.state.services.set(name, {
            status: 'initializing',
            instance: null
        });

        rlog.init.starting(name);

        try {
            const instance = await factory();
            const initTime = Math.round(performance.now() - startTime);

            this.state.services.set(name, {
                status: 'ready',
                instance,
                initTime
            });

            this.state.initOrder.push(name);
            rlog.service.initialized(name);

            return instance;
        } catch (error) {
            this.state.services.set(name, {
                status: 'failed',
                instance: null,
                error: error as Error
            });

            rlog.init.failed(name, error as Error);
            throw error;
        }
    }

    /**
     * الحصول على خدمة
     */
    get<T>(name: ServiceName): T {
        const service = this.state.services.get(name);

        if (!service) {
            throw new Error(`Service ${name} غير مسجلة`);
        }

        if (service.status !== 'ready') {
            throw new Error(`Service ${name} غير جاهزة (status: ${service.status})`);
        }

        return service.instance as T;
    }

    /**
     * التحقق من جاهزية خدمة
     */
    isReady(name: ServiceName): boolean {
        const service = this.state.services.get(name);
        return service?.status === 'ready';
    }

    /**
     * التحقق من تهيئة جميع الخدمات
     */
    isInitialized(): boolean {
        return this.state.initialized;
    }

    /**
     * الحصول على حالة الخدمات
     */
    getStatus(): Record<ServiceName, ServiceStatus> {
        const status: Partial<Record<ServiceName, ServiceStatus>> = {};

        this.state.services.forEach((state, name) => {
            status[name] = state.status;
        });

        return status as Record<ServiceName, ServiceStatus>;
    }

    /**
     * الحصول على الأخطاء
     */
    getErrors(): Array<{ service: ServiceName; error: Error }> {
        const errors: Array<{ service: ServiceName; error: Error }> = [];

        this.state.services.forEach((state, name) => {
            if (state.status === 'failed' && state.error) {
                errors.push({ service: name, error: state.error });
            }
        });

        return errors;
    }

    /**
     * طباعة ملخص التهيئة
     */
    private logSummary(): void {
        const totalTime = Math.round(performance.now() - this.state.startTime);
        const services = Array.from(this.state.services.entries());
        const ready = services.filter(([, s]) => s.status === 'ready').length;
        const failed = services.filter(([, s]) => s.status === 'failed').length;

        rlog.service.success('📊 ملخص تهيئة الخدمات', {
            totalServices: services.length,
            readyCount: ready,
            failedCount: failed,
            totalTimeMs: totalTime,
            initOrder: this.state.initOrder,
            serviceDetails: services.map(([name, state]) => ({
                name,
                status: state.status,
                initTime: state.initTime
            }))
        });
    }

    /**
     * إعادة تعيين (للاختبارات فقط)
     */
    static resetInstance(): void {
        rlog.service.info('🔄 إعادة تعيين Service Registry');
        ServiceRegistry.instance = null;
    }
}

// Singleton export
export const serviceRegistry = ServiceRegistry.getInstance();

// Convenience function
export async function initializeServices(): Promise<void> {
    return serviceRegistry.initialize();
}

export type { ServiceName, ServiceStatus };

// src/services/di/index.ts
// Barrel export for DI container

export { getContainer, ServiceLifetime } from './Container';
export {
    registerServices,
    getStoreService,
    getStorageService,
    getThemeService,
    getLanguageService,
    getShareService,
    getScreenshotService
} from './services';

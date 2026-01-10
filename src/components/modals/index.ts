// src/components/modals/index.ts
// Barrel export for all modal components

// Legacy Modals (will be migrated to use core)
export { showConfirmDialog } from './ConfirmDialog';
export { showPromptDialog } from './PromptDialog';
export { showImportDecisionManager } from './ImportDecisionManager';
export { showTemplateEditor } from './TemplateEditor';
export { showVideoManager } from './VideoManager';

// Modal Core Framework
export * from './core';

// New Primitive Modals (using Modal Core)
export * from './primitives';

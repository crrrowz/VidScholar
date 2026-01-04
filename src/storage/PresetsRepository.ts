/**
 * PresetsRepository - Centralized presets/templates management
 * 
 * This repository handles all preset and template-related storage operations.
 */

import { storageAdapter } from './StorageAdapter';
import { StorageKeys } from './StorageKeys';
import config from '../utils/config';

type PresetListener = (preset: number) => void;
type TemplateListener = () => void;

class PresetsRepository {
    private static instance: PresetsRepository;
    private initialized = false;
    private defaultPresets: Record<number, string[]> = {};
    private presetListeners = new Set<PresetListener>();
    private templateListeners = new Set<TemplateListener>();

    private constructor() {
        this.loadDefaultPresets();
    }

    static getInstance(): PresetsRepository {
        if (!PresetsRepository.instance) {
            PresetsRepository.instance = new PresetsRepository();
        }
        return PresetsRepository.instance;
    }

    /**
     * Load default presets from config
     */
    private loadDefaultPresets(): void {
        const presets = config.getPresets();
        Object.keys(presets).forEach(key => {
            const num = parseInt(key);
            this.defaultPresets[num] = presets[key].templates;
        });
    }

    /**
     * Initialize repository
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        const result = await storageAdapter.initialize();
        this.initialized = result;
        return result;
    }

    // ==========================================
    // CURRENT PRESET
    // ==========================================

    /**
     * Get current preset number
     */
    async getCurrentPreset(): Promise<number> {
        await this.ensureInitialized();

        const preset = await storageAdapter.get<number>(StorageKeys.currentPreset);
        return preset ?? 1;
    }

    /**
     * Save current preset number
     */
    async setCurrentPreset(presetNumber: number): Promise<boolean> {
        await this.ensureInitialized();

        const result = await storageAdapter.set(StorageKeys.currentPreset, presetNumber);
        if (result) {
            this.notifyPresetListeners(presetNumber);
        }
        return result;
    }

    // ==========================================
    // TEMPLATES
    // ==========================================

    /**
     * Get templates for a preset
     */
    async getPresetTemplates(presetNumber: number): Promise<string[]> {
        await this.ensureInitialized();

        const key = StorageKeys.presetTemplates(presetNumber);
        const templates = await storageAdapter.get<string[]>(key);
        return templates ?? this.getDefaultTemplates(presetNumber);
    }

    /**
     * Save templates for a preset
     */
    async setPresetTemplates(presetNumber: number, templates: string[]): Promise<boolean> {
        await this.ensureInitialized();

        const key = StorageKeys.presetTemplates(presetNumber);
        const result = await storageAdapter.set(key, templates);
        if (result) {
            this.notifyTemplateListeners();
        }
        return result;
    }

    /**
     * Get default templates for a preset
     */
    getDefaultTemplates(presetNumber: number): string[] {
        return this.defaultPresets[presetNumber] ?? this.defaultPresets[1] ?? [];
    }

    /**
     * Reset preset templates to defaults
     */
    async resetPresetToDefaults(presetNumber: number): Promise<boolean> {
        const defaults = this.getDefaultTemplates(presetNumber);
        return this.setPresetTemplates(presetNumber, defaults);
    }

    // ==========================================
    // PRESET NAMES
    // ==========================================

    /**
     * Get preset name
     */
    async getPresetName(presetNumber: number): Promise<string> {
        await this.ensureInitialized();

        const key = StorageKeys.presetName(presetNumber);
        const name = await storageAdapter.get<string>(key);
        return name ?? this.getDefaultPresetName(presetNumber);
    }

    /**
     * Save preset name
     */
    async setPresetName(presetNumber: number, name: string): Promise<boolean> {
        await this.ensureInitialized();

        const key = StorageKeys.presetName(presetNumber);
        return storageAdapter.set(key, name);
    }

    /**
     * Get default preset name
     */
    getDefaultPresetName(presetNumber: number): string {
        const presets = config.getPresets();
        return presets[presetNumber]?.name ?? `Preset ${presetNumber}`;
    }

    // ==========================================
    // BULK OPERATIONS
    // ==========================================

    /**
     * Get all presets data (for export)
     */
    async getAllPresetsData(): Promise<Record<number, { name: string; templates: string[] }>> {
        await this.ensureInitialized();

        const result: Record<number, { name: string; templates: string[] }> = {};

        // Assume 5 presets (configurable)
        for (let i = 1; i <= 5; i++) {
            const name = await this.getPresetName(i);
            const templates = await this.getPresetTemplates(i);
            result[i] = { name, templates };
        }

        return result;
    }

    /**
     * Restore all presets data (for import)
     */
    async restoreAllPresetsData(
        data: Record<number, { name?: string; templates: string[] }>
    ): Promise<boolean> {
        await this.ensureInitialized();

        for (const [key, value] of Object.entries(data)) {
            const presetNumber = parseInt(key);
            if (isNaN(presetNumber)) continue;

            await this.setPresetTemplates(presetNumber, value.templates);
            if (value.name) {
                await this.setPresetName(presetNumber, value.name);
            }
        }

        return true;
    }

    // ==========================================
    // LISTENERS
    // ==========================================

    /**
     * Add preset change listener
     */
    addPresetListener(listener: PresetListener): () => void {
        this.presetListeners.add(listener);
        return () => this.presetListeners.delete(listener);
    }

    /**
     * Add template change listener
     */
    addTemplateListener(listener: TemplateListener): () => void {
        this.templateListeners.add(listener);
        return () => this.templateListeners.delete(listener);
    }

    private notifyPresetListeners(preset: number): void {
        this.presetListeners.forEach(listener => listener(preset));
    }

    private notifyTemplateListeners(): void {
        this.templateListeners.forEach(listener => listener());
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

export const presetsRepository = PresetsRepository.getInstance();
export default presetsRepository;

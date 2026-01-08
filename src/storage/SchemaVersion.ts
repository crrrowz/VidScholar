// src/storage/SchemaVersion.ts
/**
 * Schema Version Management
 * 
 * Provides schema versioning and migration support for data integrity.
 * Prevents silent corruption across extension upgrades/downgrades.
 */

export const CURRENT_SCHEMA_VERSION = 2;

export interface SchemaInfo {
    version: number;
    migratedAt: number;
    migratedFrom?: number;
}

export interface MigrationResult {
    success: boolean;
    fromVersion: number;
    toVersion: number;
    error?: string;
}

/**
 * Schema Migrator - Handles data migration between versions
 */
class SchemaMigrator {
    private static instance: SchemaMigrator;

    private migrations: Map<number, (data: any) => any> = new Map();

    private constructor() {
        // Register migrations
        this.registerMigrations();
    }

    static getInstance(): SchemaMigrator {
        if (!SchemaMigrator.instance) {
            SchemaMigrator.instance = new SchemaMigrator();
        }
        return SchemaMigrator.instance;
    }

    /**
     * Register all migration handlers
     */
    private registerMigrations(): void {
        // Migration from v1 to v2: Add note IDs
        this.migrations.set(1, (data: any) => {
            console.log('[SchemaMigrator] Migrating from v1 to v2: Adding note IDs');

            if (data.notes && Array.isArray(data.notes)) {
                data.notes = data.notes.map((note: any, index: number) => {
                    if (!note.id) {
                        return {
                            ...note,
                            id: `migrated-note-${Date.now()}-${index}`
                        };
                    }
                    return note;
                });
            }

            return data;
        });

        // Future: Migration from v2 to v3
        // this.migrations.set(2, (data: any) => { ... });
    }

    /**
     * Detect schema version from data
     */
    detectVersion(data: any): number {
        // Check for explicit version field
        if (data.schemaVersion) {
            return data.schemaVersion;
        }

        // Heuristics for version detection
        if (data.notes && Array.isArray(data.notes)) {
            // v2: All notes have IDs
            const allHaveIds = data.notes.every((n: any) => n.id);
            if (allHaveIds && data.notes.length > 0) {
                return 2;
            }
            // v1: Notes without IDs
            return 1;
        }

        // Unknown/new data
        return CURRENT_SCHEMA_VERSION;
    }

    /**
     * Migrate data to current schema version
     */
    migrate(data: any, fromVersion?: number): MigrationResult {
        const detectedVersion = fromVersion ?? this.detectVersion(data);

        if (detectedVersion === CURRENT_SCHEMA_VERSION) {
            return {
                success: true,
                fromVersion: detectedVersion,
                toVersion: CURRENT_SCHEMA_VERSION
            };
        }

        // Downgrade detection
        if (detectedVersion > CURRENT_SCHEMA_VERSION) {
            console.warn(`[SchemaMigrator] Data schema (v${detectedVersion}) is newer than current (v${CURRENT_SCHEMA_VERSION})`);
            console.warn('[SchemaMigrator] Downgrade may cause data loss. Proceeding with caution.');
            return {
                success: true, // Allow but warn
                fromVersion: detectedVersion,
                toVersion: CURRENT_SCHEMA_VERSION
            };
        }

        // Apply migrations sequentially
        let currentData = data;
        let currentVersion = detectedVersion;

        try {
            while (currentVersion < CURRENT_SCHEMA_VERSION) {
                const migration = this.migrations.get(currentVersion);

                if (!migration) {
                    throw new Error(`No migration found for v${currentVersion}`);
                }

                currentData = migration(currentData);
                currentVersion++;

                console.log(`[SchemaMigrator] Migrated to v${currentVersion}`);
            }

            // Add schema version to data
            currentData.schemaVersion = CURRENT_SCHEMA_VERSION;

            return {
                success: true,
                fromVersion: detectedVersion,
                toVersion: CURRENT_SCHEMA_VERSION
            };
        } catch (error) {
            console.error('[SchemaMigrator] Migration failed:', error);
            return {
                success: false,
                fromVersion: detectedVersion,
                toVersion: currentVersion,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Validate data against current schema
     */
    validate(data: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check required fields
        if (!data) {
            errors.push('Data is null or undefined');
            return { valid: false, errors };
        }

        // Validate notes structure
        if (data.notes) {
            if (!Array.isArray(data.notes)) {
                errors.push('notes must be an array');
            } else {
                data.notes.forEach((note: any, index: number) => {
                    if (typeof note.timestampInSeconds !== 'number') {
                        errors.push(`notes[${index}].timestampInSeconds must be a number`);
                    }
                    if (typeof note.timestamp !== 'string') {
                        errors.push(`notes[${index}].timestamp must be a string`);
                    }
                    if (typeof note.text !== 'string') {
                        errors.push(`notes[${index}].text must be a string`);
                    }
                });
            }
        }

        return { valid: errors.length === 0, errors };
    }
}

export const schemaMigrator = SchemaMigrator.getInstance();
export default schemaMigrator;

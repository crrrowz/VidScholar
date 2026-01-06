# VidScholar Remote Configuration Roadmap
## Scalable Updates Without Chrome Web Store Reviews

**Document Version:** 1.0  
**Created:** 2026-01-06  
**Compliance:** Manifest V3 + Chrome Web Store Policy Compliant  
**Architecture Pattern:** Data-Driven Configuration (No Remote Code Execution)

---

## 📋 Executive Summary

This roadmap transforms VidScholar into a **remotely configurable extension** that can evolve its behavior, features, and UX decisions without requiring Chrome Web Store resubmissions. The approach is 100% compliant with Manifest V3 security requirements by using **data configuration** rather than executable code.

### Key Principles
- ✅ **No remote JavaScript execution**
- ✅ **No eval() or new Function()**
- ✅ **No dynamic code loading**
- ✅ **Configuration as data, not code**
- ✅ **Static logic interprets dynamic data**

---

## 🔍 Part 1: Current Architecture Assessment

### 1.1 Existing Configuration Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE (Static)                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐    imported at    ┌────────────────────┐   │
│  │ config.json      │ ─────────────────▶ │ ConfigLoader       │   │
│  │ (bundled static) │    build time     │ (singleton)        │   │
│  └──────────────────┘                    └────────────────────┘   │
│                                                   │                │
│                                                   ▼                │
│           ┌───────────────────────────────────────────────────┐   │
│           │ 19 Components directly import config              │   │
│           │ - SubToolbar.ts, MainToolbar.ts, Sidebar.ts      │   │
│           │ - VideoManager.ts, InlineNoteForm.ts, etc.       │   │
│           └───────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

PROBLEM: Any change to config.json requires rebuild + store submission
```

### 1.2 Hardcoded Values Analysis

| Category | Current Location | Hardcoded Items | Update Frequency Need |
|----------|-----------------|-----------------|----------------------|
| **Rate Limits** | `supabase.ts` | maxRequestsPerHour, maxNotesPerUser | Medium |
| **UI Timings** | `config.json` → ui | autoSaveDelay, toastDuration | Low |
| **Storage** | `config.json` → storage | retentionDays range | Medium |
| **Presets** | `config.json` → presets | Template names & content | High |
| **Video Groups** | `config.json` → videoGroups | Default group names | High |
| **Feature Logic** | Various `.ts` files | Feature availability | High |
| **Theme Colors** | `config.json` → theme | Color values | Low |

### 1.3 Areas Requiring Full Extension Update

| Area | File(s) | Change Type | Store Review Required |
|------|---------|-------------|----------------------|
| New UI components | `*.ts` | Code addition | ✅ Yes |
| Bug fixes | Any `.ts` | Logic change | ✅ Yes |
| Default presets | `config.json` | Static data | ✅ Yes |
| Feature enablement | Scattered | Conditional logic | ✅ Yes |
| Rate limits | `supabase.ts` | Constant values | ✅ Yes |
| Default groups | `config.json` | Array data | ✅ Yes |

**Conclusion:** Currently, 100% of behavioral changes require store submission.

---

## 🏗️ Part 2: Remote Configuration Architecture

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TARGET STATE (Hybrid)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                     ┌─────────────────────────┐   │
│  │ Supabase Table  │   fetch on          │ RemoteConfigService     │   │
│  │ vidscholar_     │ ──────────────────▶ │ - fetchConfig()         │   │
│  │ config          │   startup + hourly  │ - validateSchema()      │   │
│  └─────────────────┘                     │ - mergeWithDefaults()   │   │
│          ▲                               │ - cacheLocally()        │   │
│          │                               └───────────┬─────────────┘   │
│     Admin Panel                                      │                  │
│     (you update)                                     ▼                  │
│                               ┌──────────────────────────────────────┐ │
│                               │ ConfigLoader (Enhanced)              │ │
│                               │ - getConfig() → static + remote      │ │
│                               │ - isFeatureEnabled(flag)             │ │
│                               │ - getRemoteValue(key, default)       │ │
│                               └──────────────────────────────────────┘ │
│                                                   │                     │
│                                                   ▼                     │
│              ┌─────────────────────────────────────────────────────┐   │
│              │ All Components (unchanged API)                       │   │
│              │ config.getUIConfig() → merges static + remote        │   │
│              │ config.isFeatureEnabled('note_notifications') → bool │   │
│              └─────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Remote Configuration Schema

```typescript
// types/RemoteConfig.ts
interface RemoteConfig {
    // Metadata
    version: string;              // Config version for cache invalidation
    lastUpdated: string;          // ISO timestamp
    minExtensionVersion?: string; // Minimum compatible extension version
    
    // Feature Flags (boolean toggles)
    featureFlags: {
        [flagName: string]: {
            enabled: boolean;
            rolloutPercentage?: number;   // 0-100 for gradual rollout
            targetUsers?: string[];        // Specific user IDs (for beta)
            description?: string;
        };
    };
    
    // Dynamic Values (key-value overrides)
    values: {
        // Rate Limits
        maxNotesPerUser?: number;
        maxNoteSizeBytes?: number;
        maxRequestsPerHour?: number;
        
        // UI Timings
        autoSaveDelay?: number;
        toastDuration?: number;
        notificationDisplayDuration?: number;
        
        // Storage
        defaultRetentionDays?: number;
        maxRetentionDays?: number;
        
        // Other
        [key: string]: any;
    };
    
    // Content Updates (presets, groups, messages)
    content: {
        defaultPresets?: Record<string, {
            name: string;
            description: string;
            templates: string[];
        }>;
        defaultVideoGroups?: string[];
        announcements?: Array<{
            id: string;
            type: 'info' | 'warning' | 'update';
            message: string;
            dismissible: boolean;
            expiresAt?: string;
        }>;
    };
    
    // Behavioral Rules (declarative, NOT executable)
    rules?: Array<{
        id: string;
        type: 'rate_limit' | 'ui_hint' | 'validation';
        condition: RuleCondition;
        action: RuleAction;
    }>;
}

// Declarative conditions (interpreted, not executed)
interface RuleCondition {
    field: string;           // e.g., 'notesCount', 'videoAge', 'userLocale'
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in';
    value: string | number | boolean | string[];
}

// Declarative actions (predefined action types only)
interface RuleAction {
    type: 'show_message' | 'limit_action' | 'modify_ui' | 'log_event';
    payload: Record<string, any>;
}
```

### 2.3 Supabase Table Design

```sql
-- Remote configuration table
CREATE TABLE vidscholar_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL DEFAULT 'production',
    config_data JSONB NOT NULL,
    version TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial production config
INSERT INTO vidscholar_config (config_key, config_data, version) VALUES (
    'production',
    '{
        "version": "1.0.0",
        "lastUpdated": "2026-01-06T00:00:00Z",
        "featureFlags": {
            "note_notifications": { "enabled": false, "rolloutPercentage": 0 },
            "cloud_sync": { "enabled": true },
            "auto_transcript": { "enabled": true }
        },
        "values": {
            "maxNotesPerUser": 5000,
            "autoSaveDelay": 2000,
            "toastDuration": 3000
        },
        "content": {
            "defaultVideoGroups": ["First-Year English Courses", "Programming Courses", "IELTS", "General Study"]
        }
    }',
    '1.0.0'
);

-- RLS Policy: Allow anonymous read
CREATE POLICY "Allow public read" ON vidscholar_config
    FOR SELECT USING (true);

-- Index for fast lookup
CREATE INDEX idx_config_key ON vidscholar_config(config_key);
```

### 2.4 Remote Config Service Implementation

```typescript
// src/services/RemoteConfigService.ts
import { supabaseService } from './SupabaseService';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase';
import type { RemoteConfig } from '../types/RemoteConfig';

// Default fallback config (shipped with extension)
const DEFAULT_CONFIG: RemoteConfig = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    featureFlags: {},
    values: {},
    content: {},
    rules: []
};

class RemoteConfigService {
    private static instance: RemoteConfigService;
    private config: RemoteConfig = DEFAULT_CONFIG;
    private lastFetch: number = 0;
    private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    private readonly STORAGE_KEY = '__remote_config__';
    private initialized = false;
    
    private constructor() {}
    
    static getInstance(): RemoteConfigService {
        if (!RemoteConfigService.instance) {
            RemoteConfigService.instance = new RemoteConfigService();
        }
        return RemoteConfigService.instance;
    }
    
    /**
     * Initialize: Load cached config, then fetch fresh
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // 1. Load from local cache first (instant startup)
        await this.loadFromCache();
        
        // 2. Fetch fresh config in background
        this.fetchRemoteConfig().catch(console.error);
        
        // 3. Set up periodic refresh
        this.startPeriodicRefresh();
        
        this.initialized = true;
    }
    
    /**
     * Load config from local storage cache
     */
    private async loadFromCache(): Promise<void> {
        try {
            const cached = await chrome.storage.local.get(this.STORAGE_KEY);
            if (cached[this.STORAGE_KEY]) {
                const { config, timestamp } = cached[this.STORAGE_KEY];
                if (this.isValidConfig(config)) {
                    this.config = config;
                    this.lastFetch = timestamp;
                }
            }
        } catch (error) {
            console.warn('RemoteConfig: Failed to load from cache', error);
        }
    }
    
    /**
     * Fetch fresh config from Supabase
     */
    async fetchRemoteConfig(): Promise<boolean> {
        try {
            const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            
            const { data, error } = await client
                .from('vidscholar_config')
                .select('config_data, version')
                .eq('config_key', 'production')
                .single();
            
            if (error) {
                console.warn('RemoteConfig: Fetch failed', error);
                return false;
            }
            
            if (data && this.isValidConfig(data.config_data)) {
                // Validate against current extension version
                if (this.isCompatibleVersion(data.config_data)) {
                    this.config = this.mergeWithDefaults(data.config_data);
                    this.lastFetch = Date.now();
                    
                    // Cache locally
                    await chrome.storage.local.set({
                        [this.STORAGE_KEY]: {
                            config: this.config,
                            timestamp: this.lastFetch
                        }
                    });
                    
                    console.log('RemoteConfig: Updated to version', data.version);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('RemoteConfig: Fetch error', error);
            return false;
        }
    }
    
    /**
     * Validate config structure (security check)
     */
    private isValidConfig(config: any): config is RemoteConfig {
        if (!config || typeof config !== 'object') return false;
        if (typeof config.version !== 'string') return false;
        if (config.featureFlags && typeof config.featureFlags !== 'object') return false;
        if (config.values && typeof config.values !== 'object') return false;
        if (config.content && typeof config.content !== 'object') return false;
        
        // Check for dangerous patterns (no executable content)
        const jsonStr = JSON.stringify(config);
        const dangerousPatterns = [
            /javascript:/i,
            /<script/i,
            /eval\s*\(/i,
            /new\s+Function/i,
            /document\.write/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(jsonStr)) {
                console.error('RemoteConfig: Dangerous pattern detected!');
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check extension version compatibility
     */
    private isCompatibleVersion(config: RemoteConfig): boolean {
        if (!config.minExtensionVersion) return true;
        
        const currentVersion = chrome.runtime.getManifest().version;
        return this.compareVersions(currentVersion, config.minExtensionVersion) >= 0;
    }
    
    private compareVersions(a: string, b: string): number {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            if (numA > numB) return 1;
            if (numA < numB) return -1;
        }
        return 0;
    }
    
    /**
     * Merge remote with defaults (fail-safe)
     */
    private mergeWithDefaults(remote: RemoteConfig): RemoteConfig {
        return {
            ...DEFAULT_CONFIG,
            ...remote,
            featureFlags: {
                ...DEFAULT_CONFIG.featureFlags,
                ...remote.featureFlags
            },
            values: {
                ...DEFAULT_CONFIG.values,
                ...remote.values
            },
            content: {
                ...DEFAULT_CONFIG.content,
                ...remote.content
            }
        };
    }
    
    /**
     * Periodic refresh (every hour)
     */
    private startPeriodicRefresh(): void {
        setInterval(() => {
            if (Date.now() - this.lastFetch > this.CACHE_DURATION) {
                this.fetchRemoteConfig().catch(console.error);
            }
        }, this.CACHE_DURATION);
    }
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /**
     * Check if feature flag is enabled
     */
    isFeatureEnabled(flagName: string, userId?: string): boolean {
        const flag = this.config.featureFlags[flagName];
        if (!flag) return false;
        if (!flag.enabled) return false;
        
        // Check targeted users
        if (flag.targetUsers && userId) {
            return flag.targetUsers.includes(userId);
        }
        
        // Check rollout percentage
        if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
            // Deterministic rollout based on userId hash
            if (userId) {
                const hash = this.simpleHash(userId);
                return (hash % 100) < flag.rolloutPercentage;
            }
            return false; // No userId, not in rollout
        }
        
        return true;
    }
    
    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
    
    /**
     * Get remote value with fallback
     */
    getValue<T>(key: string, defaultValue: T): T {
        const value = this.config.values[key];
        if (value === undefined) return defaultValue;
        return value as T;
    }
    
    /**
     * Get content (presets, groups, etc.)
     */
    getContent<K extends keyof RemoteConfig['content']>(
        key: K
    ): RemoteConfig['content'][K] {
        return this.config.content[key];
    }
    
    /**
     * Get announcements
     */
    getActiveAnnouncements(): RemoteConfig['content']['announcements'] {
        const announcements = this.config.content.announcements || [];
        const now = new Date().toISOString();
        
        return announcements.filter(a => {
            if (a.expiresAt && a.expiresAt < now) return false;
            return true;
        });
    }
    
    /**
     * Evaluate declarative rules
     */
    evaluateRules(context: Record<string, any>): RuleAction[] {
        if (!this.config.rules) return [];
        
        const triggeredActions: RuleAction[] = [];
        
        for (const rule of this.config.rules) {
            if (this.evaluateCondition(rule.condition, context)) {
                triggeredActions.push(rule.action);
            }
        }
        
        return triggeredActions;
    }
    
    private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
        const fieldValue = context[condition.field];
        
        switch (condition.operator) {
            case 'eq': return fieldValue === condition.value;
            case 'neq': return fieldValue !== condition.value;
            case 'gt': return fieldValue > condition.value;
            case 'lt': return fieldValue < condition.value;
            case 'contains': return String(fieldValue).includes(String(condition.value));
            case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
            default: return false;
        }
    }
    
    /**
     * Get full config (for debugging)
     */
    getConfig(): Readonly<RemoteConfig> {
        return Object.freeze({ ...this.config });
    }
    
    /**
     * Force refresh
     */
    async forceRefresh(): Promise<boolean> {
        return this.fetchRemoteConfig();
    }
}

export const remoteConfigService = RemoteConfigService.getInstance();
export default remoteConfigService;
```

---

## 🚩 Part 3: Feature Flag System

### 3.1 Feature Flag Categories

| Category | Purpose | Example Flags |
|----------|---------|---------------|
| **New Features** | Launch new functionality gradually | `note_notifications`, `ai_summarize` |
| **Experiments** | A/B testing | `new_sidebar_layout`, `compact_notes` |
| **Kill Switches** | Emergency disable | `disable_cloud_sync`, `maintenance_mode` |
| **Rollouts** | Gradual percentage rollout | Any flag with `rolloutPercentage` |
| **Beta Access** | Specific users | Any flag with `targetUsers` |

### 3.2 Feature Flag Usage Pattern

```typescript
// Before (hardcoded)
if (true) {
    showNoteNotification(note);
}

// After (flag-controlled)
if (remoteConfigService.isFeatureEnabled('note_notifications', userId)) {
    showNoteNotification(note);
}
```

### 3.3 Refactoring Existing Features

```typescript
// src/services/FeatureGate.ts
import { remoteConfigService } from './RemoteConfigService';
import { supabaseService } from './SupabaseService';

type FeatureName = 
    | 'note_notifications'
    | 'cloud_sync'
    | 'auto_transcript'
    | 'video_groups'
    | 'note_templates'
    | 'export_backup'
    | 'import_notes'
    | 'retention_policy';

class FeatureGate {
    private userId: string | null = null;
    
    async initialize(): Promise<void> {
        // Get user ID for rollout calculations
        await supabaseService.initialize();
        this.userId = await this.getUserId();
    }
    
    private async getUserId(): Promise<string | null> {
        // Implementation based on existing getChromeUserId logic
        return null; // Placeholder
    }
    
    /**
     * Check if feature is available
     * Combines remote flags with local capability checks
     */
    isAvailable(feature: FeatureName): boolean {
        // 1. Check remote flag
        const flagEnabled = remoteConfigService.isFeatureEnabled(feature, this.userId || undefined);
        
        // 2. Check local requirements (e.g., permissions, browser support)
        const localCheck = this.checkLocalRequirements(feature);
        
        return flagEnabled && localCheck;
    }
    
    private checkLocalRequirements(feature: FeatureName): boolean {
        switch (feature) {
            case 'cloud_sync':
                return !!supabaseService.isAvailable();
            case 'auto_transcript':
                // Check if transcript is available on current page
                return true; // Checked at runtime
            default:
                return true;
        }
    }
    
    /**
     * Execute action only if feature is enabled
     */
    async execute<T>(feature: FeatureName, action: () => T | Promise<T>): Promise<T | null> {
        if (!this.isAvailable(feature)) {
            console.log(`Feature "${feature}" is disabled`);
            return null;
        }
        return action();
    }
}

export const featureGate = new FeatureGate();
```

### 3.4 Rollout, Rollback & Kill Switch Strategy

```typescript
// Remote config update example for rollback
{
    "featureFlags": {
        "note_notifications": {
            "enabled": true,
            "rolloutPercentage": 50  // 50% of users
        }
    }
}

// Kill switch (immediate disable)
{
    "featureFlags": {
        "note_notifications": {
            "enabled": false  // Immediately disabled for all
        }
    }
}

// Targeted rollback
{
    "featureFlags": {
        "note_notifications": {
            "enabled": true,
            "targetUsers": ["specific_user_id_1", "specific_user_id_2"]  // Only beta testers
        }
    }
}
```

---

## 🔧 Part 4: Rules & Behavior Engine

### 4.1 Declarative Rules System

The rules engine interprets **declarative rules** defined as JSON data. It does NOT execute arbitrary code.

```typescript
// Example rules in remote config
{
    "rules": [
        {
            "id": "rate_limit_warning",
            "type": "ui_hint",
            "condition": {
                "field": "notesCount",
                "operator": "gt",
                "value": 4500
            },
            "action": {
                "type": "show_message",
                "payload": {
                    "message": "You're approaching the notes limit (5000)",
                    "severity": "warning"
                }
            }
        },
        {
            "id": "old_video_cleanup",
            "type": "ui_hint",
            "condition": {
                "field": "oldestVideoAgeDays",
                "operator": "gt",
                "value": 25
            },
            "action": {
                "type": "show_message",
                "payload": {
                    "message": "Some videos will be auto-deleted soon",
                    "severity": "info"
                }
            }
        }
    ]
}
```

### 4.2 Rule Evaluation Context

```typescript
// src/services/RulesEngine.ts
import { remoteConfigService } from './RemoteConfigService';
import { notesRepository } from '../storage/NotesRepository';
import { settingsService } from './SettingsService';

interface RuleContext {
    notesCount: number;
    videosCount: number;
    oldestVideoAgeDays: number;
    userLocale: string;
    extensionVersion: string;
    isCloudEnabled: boolean;
}

class RulesEngine {
    /**
     * Build context from current state
     */
    async buildContext(): Promise<RuleContext> {
        const videos = await notesRepository.loadAllVideos();
        const notesCount = videos.reduce((sum, v) => sum + v.notes.length, 0);
        
        let oldestVideoAgeDays = 0;
        if (videos.length > 0) {
            const oldest = Math.min(...videos.map(v => v.lastModified || Date.now()));
            oldestVideoAgeDays = Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24));
        }
        
        return {
            notesCount,
            videosCount: videos.length,
            oldestVideoAgeDays,
            userLocale: settingsService.get('locale'),
            extensionVersion: chrome.runtime.getManifest().version,
            isCloudEnabled: storageAdapter.isUsingCloud()
        };
    }
    
    /**
     * Evaluate all rules and return actions
     */
    async evaluateRules(): Promise<RuleAction[]> {
        const context = await this.buildContext();
        return remoteConfigService.evaluateRules(context);
    }
    
    /**
     * Execute triggered actions
     */
    async executeActions(actions: RuleAction[]): Promise<void> {
        for (const action of actions) {
            switch (action.type) {
                case 'show_message':
                    this.handleShowMessage(action.payload);
                    break;
                case 'log_event':
                    console.log('[RulesEngine]', action.payload);
                    break;
                case 'limit_action':
                    // Handle action limiting (e.g., disable save button)
                    break;
                case 'modify_ui':
                    // Handle UI modifications
                    break;
            }
        }
    }
    
    private handleShowMessage(payload: { message: string; severity: string }): void {
        const { showToast } = require('../utils/toast');
        showToast(payload.message, payload.severity as any);
    }
}

export const rulesEngine = new RulesEngine();
```

### 4.3 Why This Is Policy-Compliant

| Requirement | Our Approach | Compliance |
|------------|--------------|------------|
| No remote JS execution | Rules are **data**, interpreted by static code | ✅ |
| No eval() | Condition evaluation uses predefined operators only | ✅ |
| No dynamic code loading | All logic bundled at build time | ✅ |
| Predictable behavior | Same rules → same outcome | ✅ |
| Content Security Policy | No inline scripts, no external scripts | ✅ |

---

## ☁️ Part 5: Cloud vs Client Source of Truth

### 5.1 Sync Strategy Matrix

| Scenario | Source of Truth | Reasoning |
|----------|-----------------|-----------|
| **First install** | Cloud | Get latest data from cloud |
| **Normal load** | Merge (LWW) | Most recent wins |
| **Config update** | Cloud | Config is authoritative |
| **Offline mode** | Client | Local changes preserved |
| **Conflict detected** | Most recent timestamp | Last-Write-Wins |
| **Manual sync** | User choice | User resolves |

### 5.2 Remote Config Sync (One-Way)

```
┌────────────┐       Always        ┌────────────┐
│   Cloud    │  ──────────────────▶│   Client   │
│   Config   │   (Read-Only)       │   Cache    │
└────────────┘                     └────────────┘

Config is ALWAYS fetched from cloud.
Client never writes to config table.
This is one-way sync only.
```

### 5.3 User Data Sync (Bidirectional)

```
┌────────────┐◀─────────────────────▶┌────────────┐
│   Cloud    │    Bidirectional      │   Client   │
│   Data     │    (LWW Merge)        │   Local    │
└────────────┘                       └────────────┘

User notes/settings sync bidirectionally.
lastModified timestamp determines winner.
```

### 5.4 Conflict Resolution Code

```typescript
// Already implemented in StorageAdapter.ts - enhanced version
mergeVideoLists(cloud: StoredVideoData[], local: StoredVideoData[]): StoredVideoData[] {
    const merged = new Map<string, StoredVideoData>();

    // Add cloud videos
    for (const video of cloud) {
        merged.set(video.videoId, video);
    }

    // Override with local if newer (LWW)
    for (const video of local) {
        const existing = merged.get(video.videoId);
        if (!existing || (video.lastModified || 0) > (existing.lastModified || 0)) {
            merged.set(video.videoId, video);
        }
    }

    return Array.from(merged.values())
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
}
```

---

## 🔒 Part 6: Security & Compliance

### 6.1 Manifest V3 CSP Compliance

```json
// Generated manifest.json - CSP is enforced by MV3
{
    "manifest_version": 3,
    "content_security_policy": {
        "extension_pages": "script-src 'self'; object-src 'self'"
    }
}
```

**Our approach complies because:**
- ❌ No `unsafe-eval`
- ❌ No `unsafe-inline`
- ❌ No external script sources
- ✅ All scripts bundled at build time
- ✅ Dynamic data is read, not executed

### 6.2 Input Validation Pipeline

```typescript
// All remote config goes through validation
async fetchRemoteConfig(): Promise<boolean> {
    const data = await supabase.from('vidscholar_config').select('*');
    
    // 1. Schema validation
    if (!this.isValidConfig(data.config_data)) {
        return false;  // Reject malformed config
    }
    
    // 2. Pattern detection (no executable content)
    if (this.containsDangerousPatterns(data.config_data)) {
        return false;  // Reject suspicious content
    }
    
    // 3. Version compatibility
    if (!this.isCompatibleVersion(data.config_data)) {
        return false;  // Reject incompatible config
    }
    
    // 4. Only then apply
    this.config = this.mergeWithDefaults(data.config_data);
    return true;
}
```

### 6.3 Security Safeguards

| Threat | Mitigation |
|--------|------------|
| Malicious config injection | Schema validation + pattern detection |
| XSS via config values | Values are rendered as text, never as HTML |
| Config tampering | Supabase RLS (read-only for users) |
| Stale config | Regular refresh + version checking |
| Offline attacks | Local cache is validated on read |

### 6.4 Chrome Web Store Policy Compliance

| Policy | Compliance Statement |
|--------|---------------------|
| **No remote code** | All JavaScript bundled at build time |
| **Declare permissions** | Only `storage`, `identity` used |
| **Single purpose** | Video note-taking remains core function |
| **Data handling** | User data stays in user's cloud account |
| **Privacy** | Config contains no PII |

---

## 📅 Part 7: Timeline Roadmap

### Phase 1: Foundation (Week 1-2)
**Objective:** Create remote config infrastructure

| Task | Files Affected | Effort | Risk |
|------|---------------|--------|------|
| Create `vidscholar_config` table in Supabase | SQL schema | 1 day | Low |
| Implement `RemoteConfigService.ts` | New file | 3 days | Medium |
| Add config types | `types/RemoteConfig.ts` | 1 day | Low |
| Integrate with background.ts | `background.ts` | 1 day | Low |
| Add local caching | `RemoteConfigService.ts` | 1 day | Low |

**Deliverable:** Config fetching and caching works end-to-end

---

### Phase 2: Feature Flags (Week 3-4)
**Objective:** Wrap existing features with flags

| Task | Files Affected | Effort | Risk |
|------|---------------|--------|------|
| Create `FeatureGate.ts` | New file | 2 days | Low |
| Identify features to flag | All components | 1 day | Low |
| Wrap cloud sync feature | `StorageAdapter.ts`, `SupabaseService.ts` | 2 days | Medium |
| Wrap auto-transcript | `SubToolbar.ts` | 1 day | Low |
| Add flag status UI (debug) | New component | 1 day | Low |

**Deliverable:** 3-5 features controlled by remote flags

---

### Phase 3: Config-Driven Values (Week 5-6)
**Objective:** Replace hardcoded values with remote config

| Task | Files Affected | Effort | Risk |
|------|---------------|--------|------|
| Refactor `ConfigLoader.ts` | `utils/config.ts` | 2 days | Medium |
| Move rate limits to remote | `supabase.ts` | 1 day | Low |
| Move UI timings to remote | All UI components | 2 days | Medium |
| Move default presets to remote | `SettingsService.ts` | 1 day | Low |
| Add fallback logic | `RemoteConfigService.ts` | 1 day | Low |

**Deliverable:** Key values updateable without store submission

---

### Phase 4: Rules Engine (Week 7-8)
**Objective:** Implement declarative behavior rules

| Task | Files Affected | Effort | Risk |
|------|---------------|--------|------|
| Create `RulesEngine.ts` | New file | 3 days | Medium |
| Define rule conditions | Types | 1 day | Low |
| Implement action handlers | `RulesEngine.ts` | 2 days | Medium |
| Add rule evaluation triggers | Various | 2 days | Low |
| Test with sample rules | Integration tests | 2 days | Low |

**Deliverable:** Behavior rules evaluated from remote config

---

### Phase 5: Admin & Monitoring (Week 9-10)
**Objective:** Create config management interface

| Task | Files Affected | Effort | Risk |
|------|---------------|--------|------|
| Create simple admin page (web) | Separate project | 3 days | Low |
| Add config version tracking | Supabase | 1 day | Low |
| Add config update history | Supabase | 1 day | Low |
| Add telemetry (optional) | New service | 2 days | Medium |
| Document config schema | Docs | 1 day | Low |

**Deliverable:** You can update config via web interface

---

## 📊 Part 8: Impact Analysis

### 8.1 Before vs After Store Submissions

| Change Type | Before | After |
|-------------|--------|-------|
| New feature launch | Store review required | Feature flag (no review) |
| Rate limit adjustment | Store review required | Remote config (no review) |
| Default presets update | Store review required | Remote content (no review) |
| Bug fix | Store review required | **Still required** (code change) |
| New UI component | Store review required | **Still required** (code change) |
| A/B testing | Not possible | Remote flags (no review) |
| Kill switch | Store review required | Instant via config |
| Rollout percentage | Not possible | Remote flags (no review) |

### 8.2 Estimated Review Reduction

| Current (12 months) | Estimated After | Reduction |
|---------------------|-----------------|-----------|
| 24 submissions | 8 submissions | **67%** |

Store submissions now only needed for:
- New UI components
- Bug fixes in core logic
- New permissions
- Security updates

---

## 🎯 Part 9: Long-Term Strategy

### 9.1 Maintaining Compliance

1. **Regular Policy Review**: Check Chrome Web Store policies quarterly
2. **Audit Trail**: Log all config changes with timestamps
3. **Staged Rollouts**: Always use percentage rollout for new features
4. **Fallback Defaults**: Extension works fully offline with bundled defaults

### 9.2 Scalability Considerations

1. **Edge Functions**: Consider Supabase Edge Functions for complex rules (still no remote JS to client)
2. **A/B Testing Platform**: Build analytics for flag effectiveness
3. **Config Versioning**: Semantic versioning for config compatibility
4. **Multi-Environment**: Separate configs for dev/staging/production

### 9.3 Adding New Features Safely

```
1. Build feature with flag wrapper (code change → store review)
2. Ship with flag disabled (review approved)
3. Enable flag remotely for beta users (no review)
4. Monitor & iterate on config (no reviews)
5. Full rollout via flag (no review)
```

---

## 📁 Final Deliverables Summary

| Artifact | Location | Purpose |
|----------|----------|---------|
| `RemoteConfigService.ts` | `src/services/` | Config fetching & caching |
| `FeatureGate.ts` | `src/services/` | Feature flag evaluation |
| `RulesEngine.ts` | `src/services/` | Declarative rule evaluation |
| `RemoteConfig.ts` | `src/types/` | TypeScript interfaces |
| `vidscholar_config` | Supabase | Remote config storage |
| Config Admin UI | Separate web app | Config management |

---

## ✅ Compliance Checklist

- [x] No `eval()` or `new Function()`
- [x] No remote JavaScript loading
- [x] No CDN-hosted logic
- [x] No `unsafe-eval` in CSP
- [x] Config is data, not code
- [x] Static logic interprets dynamic data
- [x] All validation happens client-side
- [x] Fallback to bundled defaults
- [x] Supabase RLS prevents tampering

---

**Document Owner:** VidScholar Architecture Team  
**Last Updated:** 2026-01-06  
**Status:** Ready for Implementation

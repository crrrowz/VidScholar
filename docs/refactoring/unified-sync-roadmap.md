# Unified Sync Logic Roadmap
# خارطة طريق توحيد منطق المزامنة

## 🎯 الهدف
توحيد منطق المزامنة والدمج بين:
- استيراد الملفات (File Import)
- المزامنة مع السحابة (Cloud Sync)
- المشاركة بين الأجهزة (Cross-device Sharing)

---

## 📊 تحليل السيناريوهات الحالية

### سيناريوهات الاستيراد (مُختبرة)

| # | السيناريو | الوصف | النتيجة المتوقعة |
|---|-----------|-------|------------------|
| 1 | `NEW_CONTENT` | بيانات جديدة غير موجودة محلياً | إضافة مع شارة "New" |
| 2 | `UPDATED_CONTENT` | بيانات موجودة مع تعديلات | تحديث النص مع شارة "Update" |
| 3 | `IDENTICAL` | بيانات متطابقة تماماً | "كل شيء محدث!" - لا تغييرات |
| 4 | `SUBSET` | بيانات أقل من المحلية | "كل شيء محدث!" - لا محتوى جديد |
| 5 | `MIXED` | خليط من الأنواع السابقة | عرض الجديد والمحدث فقط |

### سيناريوهات السحابة (مطلوب تطبيقها)

| # | السيناريو | الوصف | المنطق المطلوب |
|---|-----------|-------|----------------|
| 1 | `CLOUD_NEWER` | السحابة أحدث من المحلي | تحديث المحلي بالسحابة |
| 2 | `LOCAL_NEWER` | المحلي أحدث من السحابة | رفع المحلي للسحابة |
| 3 | `CONFLICT` | تعديلات متزامنة | عرض واجهة قرار للمستخدم |
| 4 | `FIRST_SYNC` | جهاز جديد بدون بيانات | سحب كل شيء من السحابة |
| 5 | `OFFLINE_CHANGES` | تغييرات أثناء عدم الاتصال | دمج ذكي عند العودة |

---

## 🏗️ الهيكل المقترح

```
src/
├── sync/
│   ├── SyncEngine.ts           # محرك المزامنة الموحد
│   ├── SyncResolver.ts         # حل النزاعات
│   ├── SyncTypes.ts            # أنواع البيانات
│   └── strategies/
│       ├── MergeStrategy.ts    # استراتيجية الدمج
│       ├── ReplaceStrategy.ts  # استراتيجية الاستبدال
│       └── ConflictStrategy.ts # استراتيجية النزاعات
```

---

## 📋 Phase 1: تجريد منطق المزامنة

### 1.1 إنشاء واجهات موحدة

```typescript
// SyncTypes.ts

export interface SyncItem {
    id: string;
    timestamp: string;
    timestampInSeconds: number;
    text: string;
    lastModified: number;
}

export interface SyncContainer {
    containerId: string;       // videoId
    containerTitle: string;    // videoTitle
    items: SyncItem[];         // notes
    metadata: Record<string, any>;
    lastModified: number;
}

export interface SyncResult {
    status: 'success' | 'conflict' | 'no_changes' | 'error';
    newItems: SyncItem[];
    updatedItems: SyncItem[];
    deletedItems: SyncItem[];
    conflicts: SyncConflict[];
}

export interface SyncConflict {
    itemId: string;
    localVersion: SyncItem;
    remoteVersion: SyncItem;
    resolution?: 'keep_local' | 'keep_remote' | 'keep_both';
}

export type SyncSource = 'file' | 'cloud' | 'share';
export type SyncDirection = 'push' | 'pull' | 'bidirectional';
```

### 1.2 محرك المزامنة الموحد

```typescript
// SyncEngine.ts

export class SyncEngine {
    /**
     * Compare two datasets and return sync result
     */
    static compare(
        local: SyncContainer[],
        remote: SyncContainer[]
    ): SyncResult {
        const newItems: SyncItem[] = [];
        const updatedItems: SyncItem[] = [];
        const conflicts: SyncConflict[] = [];
        
        // Map for quick lookup
        const localMap = new Map(local.map(c => [c.containerId, c]));
        const remoteMap = new Map(remote.map(c => [c.containerId, c]));
        
        // Analyze remote containers
        for (const remoteContainer of remote) {
            const localContainer = localMap.get(remoteContainer.containerId);
            
            if (!localContainer) {
                // NEW: Container doesn't exist locally
                newItems.push(...remoteContainer.items);
            } else {
                // EXISTS: Compare items
                const itemResult = this.compareItems(
                    localContainer.items,
                    remoteContainer.items
                );
                newItems.push(...itemResult.newItems);
                updatedItems.push(...itemResult.updatedItems);
                conflicts.push(...itemResult.conflicts);
            }
        }
        
        const hasChanges = newItems.length > 0 || updatedItems.length > 0;
        
        return {
            status: conflicts.length > 0 ? 'conflict' : 
                    hasChanges ? 'success' : 'no_changes',
            newItems,
            updatedItems,
            deletedItems: [], // Calculated separately if needed
            conflicts
        };
    }
    
    /**
     * Compare items within a container
     */
    private static compareItems(
        local: SyncItem[],
        remote: SyncItem[]
    ): { newItems: SyncItem[], updatedItems: SyncItem[], conflicts: SyncConflict[] } {
        const newItems: SyncItem[] = [];
        const updatedItems: SyncItem[] = [];
        const conflicts: SyncConflict[] = [];
        
        const localByTimestamp = new Map(
            local.map(item => [item.timestampInSeconds, item])
        );
        const localById = new Map(
            local.map(item => [item.id, item])
        );
        
        for (const remoteItem of remote) {
            // Try to match by ID first
            let localItem = localById.get(remoteItem.id);
            
            // Fallback to timestamp match
            if (!localItem) {
                localItem = localByTimestamp.get(remoteItem.timestampInSeconds);
            }
            
            if (!localItem) {
                // NEW item
                newItems.push(remoteItem);
            } else if (localItem.text !== remoteItem.text) {
                // DIFFERENT text - check modification time
                if (remoteItem.lastModified > localItem.lastModified) {
                    // Remote is newer - UPDATE
                    updatedItems.push(remoteItem);
                } else if (localItem.lastModified > remoteItem.lastModified) {
                    // Local is newer - CONFLICT (local might need to push)
                    conflicts.push({
                        itemId: remoteItem.id,
                        localVersion: localItem,
                        remoteVersion: remoteItem
                    });
                } else {
                    // Same time but different content - TRUE CONFLICT
                    conflicts.push({
                        itemId: remoteItem.id,
                        localVersion: localItem,
                        remoteVersion: remoteItem
                    });
                }
            }
            // If same text - skip (no changes)
        }
        
        return { newItems, updatedItems, conflicts };
    }
    
    /**
     * Apply sync result to local storage
     */
    static async apply(
        result: SyncResult,
        resolver: SyncResolver
    ): Promise<boolean> {
        // Apply new items
        for (const item of result.newItems) {
            await resolver.addItem(item);
        }
        
        // Apply updates
        for (const item of result.updatedItems) {
            await resolver.updateItem(item);
        }
        
        // Handle conflicts (may require UI)
        for (const conflict of result.conflicts) {
            await resolver.resolveConflict(conflict);
        }
        
        return true;
    }
}
```

---

## 📋 Phase 2: تكامل مع النظام الحالي

### 2.1 تحديث ImportService

```typescript
// ImportService.ts - الجديد

import { SyncEngine, SyncResult } from '../sync/SyncEngine';

async handleImport(importedData: AllNotesExport): Promise<ImportResult> {
    // Convert to SyncContainers
    const remote = this.toSyncContainers(importedData);
    const local = await this.getLocalSyncContainers();
    
    // Use unified sync logic
    const syncResult = SyncEngine.compare(local, remote);
    
    if (syncResult.status === 'no_changes') {
        // Show "All up to date" UI
        return { success: true, message: 'allUpToDate' };
    }
    
    // Show decision UI
    const decision = await showImportDecisionManager({
        type: 'all_notes',
        syncResult,
        // ... other options
    });
    
    // Apply based on decision
    if (decision === 'merge') {
        await SyncEngine.apply(syncResult, this.resolver);
    }
    
    return { success: true };
}
```

### 2.2 تحديث CloudSyncService

```typescript
// CloudSyncService.ts - الجديد

import { SyncEngine, SyncResult } from '../sync/SyncEngine';

async syncWithCloud(): Promise<SyncResult> {
    const remote = await this.fetchFromCloud();
    const local = await this.getLocalData();
    
    // Use SAME unified logic
    const syncResult = SyncEngine.compare(local, remote);
    
    if (syncResult.status === 'conflict') {
        // Show conflict resolution UI
        const resolved = await this.showConflictUI(syncResult.conflicts);
        syncResult.conflicts = resolved;
    }
    
    // Apply changes (same logic as file import)
    await SyncEngine.apply(syncResult, this.resolver);
    
    // Push local changes to cloud if needed
    if (this.hasLocalChangesToPush(syncResult)) {
        await this.pushToCloud(local);
    }
    
    return syncResult;
}
```

---

## 📋 Phase 3: واجهة المستخدم الموحدة

### 3.1 إعادة هيكلة ImportDecisionManager

```typescript
// ImportDecisionManager.ts - الجديد

export interface UnifiedSyncModalOptions {
    source: SyncSource;        // 'file' | 'cloud' | 'share'
    syncResult: SyncResult;
    showMergeOption: boolean;
    showConflicts: boolean;
}

export function showUnifiedSyncModal(options: UnifiedSyncModalOptions) {
    // Same UI logic for all sources
    // - Show new items with "New" badge
    // - Show updated items with "Update" badge
    // - Show conflicts with resolution options
    // - Show "All up to date" when no changes
}
```

---

## 📋 Phase 4: اختبار شامل

### 4.1 سيناريوهات اختبار موحدة

| # | السيناريو | File Import | Cloud Sync | Share Import |
|---|-----------|-------------|------------|--------------|
| 1 | New content | ✓ | ✓ | ✓ |
| 2 | Updated content | ✓ | ✓ | ✓ |
| 3 | Identical | ✓ | ✓ | ✓ |
| 4 | Subset | ✓ | ✓ | ✓ |
| 5 | Mixed | ✓ | ✓ | ✓ |
| 6 | Conflict | N/A | ✓ | ✓ |

### 4.2 ملفات الاختبار

استخدام نفس ملفات `test-scenarios/` للاختبار مع جميع المصادر.

---

## 🔄 خطة التنفيذ

### المرحلة الأولى (1-2 أسابيع)
- [ ] إنشاء `src/sync/SyncTypes.ts`
- [ ] إنشاء `src/sync/SyncEngine.ts`
- [ ] إنشاء `src/sync/SyncResolver.ts`
- [ ] كتابة اختبارات وحدة

### المرحلة الثانية (1 أسبوع)
- [ ] تحديث `ImportService.ts` لاستخدام SyncEngine
- [ ] تحديث `ShareService.ts` لاستخدام SyncEngine
- [ ] اختبار مع سيناريوهات الملفات

### المرحلة الثالثة (1-2 أسابيع)
- [ ] تحديث `StorageAdapter.ts` لاستخدام SyncEngine
- [ ] تحديث `SupabaseService.ts`
- [ ] إضافة منطق حل النزاعات للسحابة

### المرحلة الرابعة (1 أسبوع)
- [ ] توحيد واجهة المستخدم
- [ ] اختبار شامل
- [ ] توثيق

---

## 🎁 الفوائد المتوقعة

1. **كود موحد**: منطق واحد لجميع أنواع المزامنة
2. **سهولة الصيانة**: تعديل واحد يُطبق في كل مكان
3. **اتساق السلوك**: نفس التجربة للمستخدم مع أي مصدر
4. **اختبار أسهل**: سيناريوهات موحدة تغطي جميع الحالات
5. **قابلية التوسع**: إضافة مصادر جديدة بسهولة

---

## 📁 ملفات السيناريوهات المرجعية

```
test data/test-scenarios/
├── 01_all_notes_with_new_videos.json    → NEW_CONTENT
├── 02_all_notes_with_updated_notes.json → UPDATED_CONTENT
├── 03_all_notes_identical.json          → IDENTICAL
├── 04_all_notes_subset.json             → SUBSET
├── 05_video_notes_new.json              → NEW_CONTENT (single)
├── 06_video_notes_updated.json          → UPDATED_CONTENT (single)
├── 07_video_notes_identical.json        → IDENTICAL (single)
├── 08_video_notes_subset.json           → SUBSET (single)
└── 09_mixed_new_and_updated.json        → MIXED
```

---

## 🚀 الخطوة التالية

لبدء التنفيذ، نوصي بـ:
1. البدء بـ `SyncEngine.ts` كنواة المنطق الموحد
2. تطبيقها على `ImportService` أولاً (لديها اختبارات جاهزة)
3. ثم توسيعها للسحابة والمشاركة

هل تريد البدء بإنشاء `SyncEngine.ts`؟

# Zone: Drag & Drop Behavior Extraction

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Drag & Drop Behavior zone encompasses all sortable/reorderable list functionality. This includes drag initialization, drop zone visualization, reorder persistence, and animation during drag operations.

**How it emerges from the current codebase:**
Three major components independently implement Sortable.js integration with nearly identical configuration and event handlers:
- `VideoManager.ts` - Video list reordering
- `TemplateEditor.ts` - Group reordering AND preset reordering (twice!)
- Potential future: Note reordering within sidebar

---

## 2️⃣ Evidence From Code

### Sortable.js Implementations

**VideoManager.ts (Groups section):**
```typescript
// Lines 435-491
new Sortable(videoGroupsContainer, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  onStart: () => {
    // Identical pattern: create drop indicators, attach drag handlers
    items.forEach((item, index) => {
      if (index === 0) return;
      const dropIndicator = document.createElement('div');
      dropIndicator.className = 'group-drop-indicator';
      item.before(dropIndicator);
    });
    
    const handleDragOver = (e: DragEvent) => {
      // Complex drop zone detection logic (~30 lines)
    };
    document.addEventListener('dragover', handleDragOver);
  },
  onEnd: () => {
    // Save new order
    document.querySelectorAll('.group-drop-indicator').forEach(el => el.remove());
  }
});
```

**TemplateEditor.ts (Groups section):**
```typescript
// Lines 187-242 - Nearly identical
new Sortable(groupsListContainer, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  onStart: () => {
    // Same drop indicator creation
    items.forEach((item, index) => {
      if (index === 0) return;
      const dropIndicator = document.createElement('div');
      dropIndicator.className = 'group-drop-indicator';
      item.before(dropIndicator);
    });
    
    const handleDragOver = (e: DragEvent) => {
      // Same complex logic, ~30 lines
    };
  },
  onEnd: () => { /* same cleanup */ }
});
```

**TemplateEditor.ts (Presets section):**
```typescript
// Lines 389-441 - Third copy!
new Sortable(presetsListContainer, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  onStart: () => {
    // Same pattern again
  },
  onEnd: () => { /* same cleanup */ }
});
```

### Specific Code Duplications

**Drop Indicator Creation (3 copies):**
```typescript
const dropIndicator = document.createElement('div');
dropIndicator.className = 'group-drop-indicator';  // or 'preset-drop-indicator'
item.before(dropIndicator);
```

**Drag Cleanup Function (3 copies):**
```typescript
const __dragCleanup = () => {
  document.querySelectorAll('.group-drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
    el.classList.remove('drag-over-above', 'drag-over-below');
  });
  document.removeEventListener('dragover', handleDragOver);
  window.removeEventListener('dragend', __dragCleanup);
};
window.addEventListener('dragend', __dragCleanup);
```

**Drop Zone Detection (3 copies):**
```typescript
const handleDragOver = (e: DragEvent) => {
  const target = (e.target as HTMLElement).closest('.group-item, .preset-item');
  if (!target) return;
  
  const rect = target.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  
  // Remove previous indicators
  document.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
    el.classList.remove('drag-over-above', 'drag-over-below');
  });
  
  // Add appropriate indicator
  if (e.clientY < midpoint) {
    target.classList.add('drag-over-above');
  } else {
    target.classList.add('drag-over-below');
  }
};
```

---

## 3️⃣ Current Problems

### Massive Code Duplication
- **~150 lines** of drag logic repeated **3 times**
- Total: **~450 lines** that could be **~100 lines**
- Each copy has slight variations (class names) but same structure

### Maintenance Nightmare
- Bug fix in one Sortable setup must be copied to all 3
- New feature (e.g., keyboard accessibility) requires 3 implementations
- Different class names (`group-drop-indicator` vs `preset-drop-indicator`) for same visual

### Inconsistent Class Naming
```typescript
// VideoManager uses:
'.group-drop-indicator', '.video-item'

// TemplateEditor groups uses:
'.group-drop-indicator', '.group-item'

// TemplateEditor presets uses:
'.preset-drop-indicator', '.preset-item'
```

### No Reusability for Future Lists
- If note reordering is added, will require copying ~150 lines again
- No shared abstraction for "sortable list with visual feedback"

---

## 4️⃣ Unification & Merge Opportunities

### Extractable Configuration

```typescript
interface SortableConfig {
  container: HTMLElement;
  itemSelector: string;            // '.video-item', '.group-item', etc.
  dropIndicatorClass?: string;     // Default: 'sortable-drop-indicator'
  animation?: number;              // Default: 150
  ghostClass?: string;            // Default: 'sortable-ghost'
  onReorder: (newOrder: string[]) => Promise<void>;
  getItemId: (item: HTMLElement) => string;
}
```

### Unified Sortable Factory

```typescript
// Proposed: src/components/ui/Sortable/createSortableList.ts

export function createSortableList(config: SortableConfig): SortableCleanup {
  const { container, itemSelector, onReorder, getItemId } = config;
  const dropIndicatorClass = config.dropIndicatorClass ?? 'sortable-drop-indicator';
  
  // Create Sortable instance with standardized handlers
  const sortable = new Sortable(container, {
    animation: config.animation ?? 150,
    ghostClass: config.ghostClass ?? 'sortable-ghost',
    
    onStart: () => {
      attachDropIndicators(container, itemSelector, dropIndicatorClass);
      attachDragOverHandler(container, itemSelector);
    },
    
    onEnd: (evt) => {
      cleanupDropIndicators(dropIndicatorClass);
      
      // Get new order
      const items = container.querySelectorAll(itemSelector);
      const newOrder = Array.from(items).map(item => getItemId(item as HTMLElement));
      onReorder(newOrder);
    }
  });
  
  // Return cleanup function
  return () => sortable.destroy();
}

// Internal helpers (not exported)
function attachDropIndicators(container, selector, indicatorClass) { ... }
function attachDragOverHandler(container, selector) { ... }
function cleanupDropIndicators(indicatorClass) { ... }
```

### Simplified Usage

```typescript
// Before: 60+ lines in VideoManager.ts
new Sortable(videoGroupsContainer, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  onStart: () => {
    // 30+ lines of drop indicator logic
  },
  onEnd: () => {
    // 20+ lines of cleanup and save
  }
});

// After: 8 lines
createSortableList({
  container: videoGroupsContainer,
  itemSelector: '.group-item',
  getItemId: item => item.dataset.groupId,
  onReorder: async (ids) => {
    await settingsService.saveVideoGroupsOrder(ids);
  }
});
```

---

## 5️⃣ Proposed Target Shape

```
src/components/ui/
├── Sortable/                     # NEW: Drag-drop abstraction
│   ├── createSortableList.ts     # Main factory function
│   ├── dropIndicators.ts         # Indicator creation/cleanup
│   ├── dragHandlers.ts           # Drag over/end handlers
│   ├── types.ts                  # SortableConfig interface
│   └── sortable.css              # Shared sortable styles
│
└── index.ts                      # Export createSortableList
```

### CSS Consolidation

```css
/* src/components/ui/Sortable/sortable.css */

/* Universal drop indicator */
.sortable-drop-indicator {
  height: 2px;
  background: var(--color-primary);
  margin: 4px 0;
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.15s;
}

/* Ghost element (item being dragged) */
.sortable-ghost {
  opacity: 0.5;
  background: var(--color-primary-muted);
}

/* Above/below indicators */
.drag-over-above {
  border-top: 2px solid var(--color-primary);
}

.drag-over-below {
  border-bottom: 2px solid var(--color-primary);
}
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Extract Utility Functions
1. Create `src/components/ui/Sortable/dropIndicators.ts`
   - `attachDropIndicators(container, selector, className)`
   - `cleanupDropIndicators(className)`
2. Create `src/components/ui/Sortable/dragHandlers.ts`
   - `attachDragOverHandler(container, selector)`
   - `createDragCleanup(indicatorClass, handler)`

### Phase 2: Create Main Factory
3. Create `src/components/ui/Sortable/types.ts`
4. Create `src/components/ui/Sortable/createSortableList.ts`
5. Export from `src/components/ui/index.ts`

### Phase 3: Migrate VideoManager
6. Replace ~60 lines in `VideoManager.ts` with `createSortableList()`
7. Test video group reordering
8. Test drag visual feedback

### Phase 4: Migrate TemplateEditor
9. Replace groups Sortable (~55 lines) with `createSortableList()`
10. Replace presets Sortable (~55 lines) with `createSortableList()`
11. Test both reorder flows

### Phase 5: CSS Consolidation
12. Create `src/components/ui/Sortable/sortable.css`
13. Remove duplicate `.group-drop-indicator`, `.preset-drop-indicator` styles
14. Import shared CSS in components that use sortable

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Event bubbling**: Changing event attachment may affect other handlers
- **Custom styling**: Some lists may have unique visual requirements
- **Order persistence**: Must verify saves work after abstraction

### Validation Strategy

1. **VideoManager Tests**:
   - [ ] Drag video group to new position → order persists
   - [ ] Drop indicators appear during drag
   - [ ] Ghost element visible
   - [ ] Cancel drag (ESC) → no changes saved

2. **TemplateEditor Tests**:
   - [ ] Drag group to new position → order persists
   - [ ] Drag preset to new position → order persists
   - [ ] Both work in same modal session

3. **Edge Cases**:
   - [ ] Single item list (can't reorder) → no errors
   - [ ] Drag outside list → handles gracefully
   - [ ] Rapid successive drags → no race conditions

### Extensibility Check
- [ ] New sortable list can be created with minimal code
- [ ] Configuration allows customization without modifying factory
- [ ] Different styling can be applied via CSS class override

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Sortable setup implementations | 3 | 1 factory |
| Lines of drag logic | ~450 | ~100 |
| Drop indicator CSS rules | 3 sets | 1 shared set |
| Time to add new sortable list | ~1 hour | ~10 minutes |
| Bug fix propagation | Manual 3x | Automatic |

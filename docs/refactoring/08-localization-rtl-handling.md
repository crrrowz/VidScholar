# Zone: Localization & RTL Direction Handling

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Localization zone manages internationalization (i18n) - translating UI strings and handling text direction (LTR/RTL). This ensures the extension works correctly for users in different languages, particularly Arabic, Hebrew, and other RTL languages.

**How it emerges from the current codebase:**
The `LanguageService` handles translations, but RTL direction handling is scattered across components with duplicated patterns for updating `dir` attributes and registering direction change listeners.

---

## 2️⃣ Evidence From Code

### LanguageService Core

```typescript
// src/services/LanguageService.ts
export class LanguageService {
  private currentLanguage: string;
  private listeners: Set<() => void> = new Set();
  private directionListeners: Set<() => void> = new Set();
  
  translate(key: string): string { ... }
  getCurrentDirection(): 'ltr' | 'rtl' { ... }
  addDirectionListener(listener: () => void): void { ... }
  removeDirectionListener(listener: () => void): void { ... }
}
```

### Direction Handling Duplication

**Pattern 1: Set direction attribute + add listener**

```typescript
// src/components/sidebar/Sidebar.ts:40-45
container.setAttribute('dir', languageService.getCurrentDirection());
const updateDirection = () => {
  container.setAttribute('dir', languageService.getCurrentDirection());
};
languageService.addDirectionListener(updateDirection);

// src/components/modals/ConfirmDialog.ts:40
container.setAttribute('dir', languageService.getCurrentDirection());
// ❌ No listener! Direction won't update if language changes while dialog is open

// src/components/modals/PromptDialog.ts:39
container.setAttribute('dir', languageService.getCurrentDirection());
// ❌ Same problem - no listener

// src/components/modals/VideoManager.ts:95-97
const updateDirection = () => {
  container.setAttribute('dir', languageService.getCurrentDirection());
};
languageService.addDirectionListener(updateDirection);

// src/components/modals/TemplateEditor.ts (similar)
// src/components/modals/ImportDecisionManager.ts:165-167
```

**Pattern 2: Translation helper duplication**

```typescript
// src/components/modals/TemplateEditor.ts:10-15
function t(key: string, fallback?: string): string {
  const translation = languageService.translate(key);
  return translation !== key ? translation : (fallback || key);
}

// This pattern is useful but defined locally instead of shared
```

### Missing Listener Cleanup

Many components add direction/language listeners but don't clean them up:

```typescript
// VideoManager.ts - Listener added
languageService.addDirectionListener(updateDirection);

// But when modal closes, listener is NOT removed
// This can cause memory leaks and stale updates
```

### Inconsistent Direction Application

```typescript
// Some components set direction on container
container.setAttribute('dir', languageService.getCurrentDirection());

// Some use style
container.style.direction = languageService.getCurrentDirection();

// Some don't handle direction at all
// (CSS handles it globally, but component-level overrides exist)
```

---

## 3️⃣ Current Problems

### Code Duplication
- `setAttribute('dir', ...)` pattern appears **10+ times**
- Direction listener pattern appears **5+ times**
- Translation helper `t()` exists but only locally

### Memory Leaks
- Components add direction listeners
- Listeners not cleaned up when components are destroyed
- Modals are especially problematic (created/destroyed frequently)

### Inconsistency
- Some modals update direction on language change
- Others don't (ConfirmDialog, PromptDialog)
- User experience differs based on which modal is open

### No Automatic Cleanup
```typescript
// Current: Manual cleanup required
const listener = () => updateDirection();
languageService.addDirectionListener(listener);
// ... later, must remember to:
languageService.removeDirectionListener(listener);
```

---

## 4️⃣ Unification & Merge Opportunities

### AutoDirectional Component Mixin

```typescript
// Proposed: Apply direction automatically with cleanup
interface AutoDirectionalOptions {
  element: HTMLElement;
  trackChanges?: boolean;  // Update on language change
}

function applyAutoDirection(options: AutoDirectionalOptions): Cleanup {
  const { element, trackChanges = true } = options;
  
  // Apply initial direction
  element.setAttribute('dir', languageService.getCurrentDirection());
  
  if (!trackChanges) {
    return () => {};  // No cleanup needed
  }
  
  // Track changes with automatic cleanup
  const updateDir = () => {
    element.setAttribute('dir', languageService.getCurrentDirection());
  };
  languageService.addDirectionListener(updateDir);
  
  // Return cleanup function
  return () => {
    languageService.removeDirectionListener(updateDir);
  };
}
```

### Shared Translation Helper

```typescript
// Proposed: Add to LanguageService
class LanguageService {
  translate(key: string): string { ... }
  
  // NEW: With fallback
  t(key: string, fallback?: string): string {
    const translation = this.translate(key);
    return translation !== key ? translation : (fallback || key);
  }
  
  // NEW: Bulk translate
  translateAll(keys: string[]): Record<string, string> {
    return Object.fromEntries(keys.map(k => [k, this.translate(k)]));
  }
}
```

### React-like Cleanup Pattern

```typescript
// Proposed: Lifecycle-aware helper
function useDirection(element: HTMLElement): void {
  const cleanup = applyAutoDirection({ element });
  
  // If using a component lifecycle, register cleanup
  onDestroy(cleanup);
}

// For imperative code (modals)
function createModal(options) {
  const overlay = document.createElement('div');
  const directionCleanup = applyAutoDirection({ element: container });
  
  return {
    overlay,
    destroy: () => {
      directionCleanup();
      overlay.remove();
    }
  };
}
```

---

## 5️⃣ Proposed Target Shape

```
src/services/
├── LanguageService.ts           # Enhanced with new helpers
│   ├── translate(key)           # Existing
│   ├── t(key, fallback?)        # NEW: With fallback
│   ├── getCurrentDirection()    # Existing
│   └── applyDirection(el, opts) # NEW: Auto-cleanup helper
│
└── i18n/                        # NEW: Internationalization utilities
    ├── DirectionManager.ts      # Direction tracking with cleanup
    ├── translations/            # Future: External translation files
    └── index.ts
```

### Enhanced LanguageService

```typescript
// src/services/LanguageService.ts - Enhanced

export class LanguageService {
  // ... existing code ...
  
  /**
   * Translate with fallback value
   */
  t(key: string, fallback?: string): string {
    const translation = this.translate(key);
    return (translation && translation !== key) ? translation : (fallback || key);
  }
  
  /**
   * Apply direction to element with automatic cleanup
   * @returns Cleanup function to stop tracking
   */
  applyDirection(element: HTMLElement, options?: { trackChanges?: boolean }): () => void {
    const trackChanges = options?.trackChanges ?? true;
    
    // Apply initial
    element.setAttribute('dir', this.getCurrentDirection());
    
    if (!trackChanges) return () => {};
    
    // Track changes
    const listener = () => {
      element.setAttribute('dir', this.getCurrentDirection());
    };
    this.addDirectionListener(listener);
    
    // Return cleanup
    return () => this.removeDirectionListener(listener);
  }
  
  /**
   * Create auto-updating text node
   * Useful for translated labels that should update when language changes
   */
  createTranslatedText(key: string): { element: Text; cleanup: () => void } {
    const textNode = document.createTextNode(this.translate(key));
    
    const listener = () => {
      textNode.textContent = this.translate(key);
    };
    this.addListener(listener);
    
    return {
      element: textNode,
      cleanup: () => this.removeListener(listener)
    };
  }
}
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Add New Helpers to LanguageService
1. Add `t(key, fallback?)` method for cleaner translations
2. Add `applyDirection(element, options)` with auto-cleanup
3. Export new helpers

### Phase 2: Update Modal Core (when created)
4. If implementing Modal Framework (doc 02), include direction in core
5. All modals automatically get direction + cleanup

### Phase 3: Migrate Components Individually
6. Update `ConfirmDialog.ts` - add direction listener with cleanup
7. Update `PromptDialog.ts` - add direction listener with cleanup
8. Update `Sidebar.ts` - use new `applyDirection()` helper
9. Verify existing direction listeners have cleanup

### Phase 4: Audit All Components
10. Search for `getAttribute('dir')` and `setAttribute('dir')` usages
11. Replace with `applyDirection()` helper
12. Ensure cleanup paths exist

### Phase 5: Add Missing RTL Support
13. Audit CSS for RTL issues (floats, margins, etc.)
14. Test with RTL language active
15. Fix any visual direction bugs

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **Listener timing**: Too-early listener registration may miss language init
- **Cleanup order**: Must cleanup before element removal
- **Nested direction**: Some elements may intentionally override parent direction

### Validation Strategy

1. **Direction Change Tests**:
   - [ ] Open sidebar → Change language → Direction updates
   - [ ] Open ConfirmDialog → Change language → Direction updates
   - [ ] Open VideoManager → Change language → Direction updates

2. **Memory Leak Tests**:
   - [ ] Open/close modal 100 times → Memory stable
   - [ ] Check `languageService.directionListeners.size` doesn't grow

3. **RTL Visual Tests**:
   - [ ] Sidebar layout correct in Arabic
   - [ ] Note timestamps on correct side
   - [ ] Buttons grouped correctly
   - [ ] Text alignment appropriate

4. **LTR to RTL Switch**:
   - [ ] No layout jumps during transition
   - [ ] All elements reflow correctly

### Edge Cases
- Direction for code blocks (should stay LTR even in RTL context)
- Timestamps (numbers, always LTR)
- Mixed content (RTL text with English words)

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Direction setup patterns | 10+ copies | 1 helper function |
| Memory leak risk | High (no cleanup) | Low (auto cleanup) |
| Components with direction listeners | Some | All major components |
| Translation helper copies | 1 local | 1 in LanguageService |
| RTL testing coverage | Unknown | Documented checklist |

# Zone: Modal Dialog Framework Consolidation

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The Modal Dialog Framework encompasses all overlay/popup UI components that interrupt the main user flow, require user input or confirmation, and must be dismissed before continuing. This includes confirmation dialogs, prompts, the video manager, template editor, and import decision manager.

**How it emerges from the current codebase:**
Examining `src/components/modals/` reveals 5 modal-type components, each implementing its own:
- Overlay creation and styling
- Escape key handling
- Click-outside-to-close behavior
- Direction (RTL/LTR) handling
- Animation transitions
- DOM cleanup

---

## 2️⃣ Evidence From Code

### Modal Files & Complexity

| File | Lines | Purpose | Unique Features |
|------|-------|---------|-----------------|
| `ConfirmDialog.ts` | 80 | Yes/No confirmation | Simple, two buttons |
| `PromptDialog.ts` | 85 | Text input | Single input field |
| `ImportDecisionManager.ts` | 476 | Import conflict UI | Complex per-video decisions |
| `TemplateEditor.ts` | 601 | Template/Preset management | Tabs, drag-drop, CRUD |
| `VideoManager.ts` | 905 | Video library browser | Search, sort, cards |

### Duplicated Modal Patterns

**1. Overlay Creation (appears 5 times):**

```typescript
// ConfirmDialog.ts:21-23
const overlay = document.createElement('div');
overlay.id = "confirmDialog";
overlay.className = "confirm-dialog-overlay";

// PromptDialog.ts:20-22
const overlay = document.createElement('div');
overlay.id = "promptDialog";
overlay.className = "prompt-dialog-overlay";

// VideoManager.ts:37-40
const overlay = document.createElement("div");
overlay.id = "videoManager";
overlay.className = "video-manager-overlay";

// TemplateEditor.ts (similar pattern)
// ImportDecisionManager.ts (similar pattern)
```

**2. Close & Cleanup Logic (appears 5 times):**

```typescript
// ConfirmDialog.ts:25-31
const closeDialog = (result: boolean) => {
  overlay.classList.remove('visible');
  setTimeout(() => {
    overlay.remove();
    document.body.style.overflow = '';
    resolve(result);
  }, 200);
};

// PromptDialog.ts:24-31 (identical structure)
// VideoManager.ts:42-49 (slightly different)
// etc.
```

**3. Escape Key Handler (appears 5 times):**

```typescript
// ConfirmDialog.ts:71-77
const handleEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeDialog(false);
    document.removeEventListener('keydown', handleEsc);
  }
};
document.addEventListener('keydown', handleEsc);

// Identical pattern in all other modals
```

**4. Direction Handling (appears 4 times):**

```typescript
// ConfirmDialog.ts:40
container.setAttribute('dir', languageService.getCurrentDirection());

// VideoManager.ts:95-97
const updateDirection = () => {
  container.setAttribute('dir', languageService.getCurrentDirection());
};
languageService.addDirectionListener(updateDirection);

// Repeated in TemplateEditor, ImportDecisionManager
```

**5. Click-Outside Handler (appears 5 times):**

```typescript
// ConfirmDialog.ts:78
overlay.addEventListener('click', (e) => { 
  if (e.target === overlay) closeDialog(false); 
});
```

---

## 3️⃣ Current Problems

### Code Bloat
- **~2,200 lines** across 5 modal files
- Core modal behavior (~50 lines) repeated 5 times = **~250 redundant lines**
- CSS for each modal duplicates overlay/container styles

### Inconsistencies
- `VideoManager` has slightly different close animation timing (200ms vs immediate)
- `TemplateEditor` doesn't clean up direction listener on close (memory leak potential)
- `ImportDecisionManager` uses different class naming convention

### Fragility
- Bug fix in one modal (e.g., accessibility) must be replicated to 4 others
- New modals require copying ~80 lines of boilerplate
- No standardized focus trap (accessibility issue)

### Missing Features Present Elsewhere
- `FloatingButton` has shake animation - no modal has this
- No modal has loading/spinner state standardized
- No modal has "stacking" support (modal over modal)

---

## 4️⃣ Unification & Merge Opportunities

### Extractable Base Behavior

```typescript
// Proposed: BaseModal infrastructure
interface ModalConfig {
  id: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  showCloseButton?: boolean;
  direction?: 'auto' | 'ltr' | 'rtl';
  animation?: 'fade' | 'slide-up' | 'scale';
}
```

### Shared Infrastructure to Extract

| Current Duplicate | Unified Primitive |
|-------------------|-------------------|
| 5 overlay creators | `createModalOverlay(config)` |
| 5 close handlers | `closeWithAnimation(overlay, result)` |
| 5 ESC listeners | `attachModalKeyboardHandlers(overlay, callbacks)` |
| 5 click-outside handlers | Built into `createModalOverlay` |
| 4 direction handlers | Built into `createModalOverlay` |

### Proposed Utilities

```typescript
// src/components/modals/core/ModalFactory.ts
function createModal<T>(config: ModalConfig): {
  overlay: HTMLElement;
  container: HTMLElement;
  close: (result: T) => void;
  destroy: () => void;
}

// src/components/modals/core/ModalKeyboard.ts
function attachFocusTrap(container: HTMLElement): Cleanup;
function attachEscapeHandler(onEscape: () => void): Cleanup;

// src/components/modals/core/ModalAccessibility.ts
function announceModal(title: string): void;
function restoreFocus(previousElement: HTMLElement): void;
```

---

## 5️⃣ Proposed Target Shape

```
src/components/modals/
├── core/                      # NEW: Shared modal infrastructure
│   ├── ModalFactory.ts        # createModal() function
│   ├── ModalOverlay.ts        # Overlay DOM + animations
│   ├── ModalContainer.ts      # Container with header/body/footer
│   ├── ModalKeyboard.ts       # ESC, Tab trap, shortcuts
│   ├── ModalAccessibility.ts  # ARIA, focus management
│   └── types.ts               # ModalConfig, ModalResult, etc.
│
├── primitives/                # Thin wrappers over core
│   ├── ConfirmModal.ts        # ~30 lines, uses ModalFactory
│   └── PromptModal.ts         # ~40 lines, uses ModalFactory
│
├── composed/                  # Complex modals, content-focused only
│   ├── VideoManager/
│   │   ├── VideoManager.ts    # Just the content, no boilerplate
│   │   └── VideoCard.ts       # Extracted component
│   ├── TemplateEditor/
│   │   ├── TemplateEditor.ts
│   │   ├── GroupsTab.ts
│   │   └── PresetsTab.ts
│   └── ImportDecision/
│       ├── ImportDecisionManager.ts
│       └── DecisionRow.ts
│
└── index.ts                   # Public exports
```

### Before vs After Comparison

**Before (ConfirmDialog.ts):** 80 lines
- 25 lines: overlay/container creation
- 15 lines: ESC handler + click-outside
- 10 lines: direction handling
- 30 lines: actual content (header, message, buttons)

**After (ConfirmModal.ts):** ~30 lines
```typescript
import { createModal, ModalSize } from './core/ModalFactory';

export async function showConfirmModal(options: ConfirmOptions): Promise<boolean> {
  const { overlay, container, close } = createModal({
    id: 'confirmDialog',
    size: 'sm',
    closeOnEscape: true,
    closeOnClickOutside: true
  });

  // Only content-specific code remains
  container.innerHTML = `
    <div class="modal-header">${options.title}</div>
    <div class="modal-body">${options.message}</div>
    <div class="modal-footer">
      <button class="btn btn--default" data-action="cancel">${options.cancelText}</button>
      <button class="btn btn--primary" data-action="confirm">${options.confirmText}</button>
    </div>
  `;

  container.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(false));
  container.querySelector('[data-action="confirm"]')?.addEventListener('click', () => close(true));

  return new Promise(resolve => overlay.addEventListener('modal-close', (e) => resolve(e.detail)));
}
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Core Infrastructure (No Breaking Changes)
1. Create `src/components/modals/core/types.ts` - define interfaces
2. Create `src/components/modals/core/ModalOverlay.ts` - overlay creation
3. Create `src/components/modals/core/ModalKeyboard.ts` - ESC handler, focus trap
4. Create `src/components/modals/core/ModalFactory.ts` - compose above

### Phase 2: Primitive Modal Migration
5. Create `src/components/modals/primitives/ConfirmModal.ts` using new core
6. Update `ConfirmDialog.ts` to delegate to `ConfirmModal`
7. Repeat for `PromptDialog.ts`
8. Delete old implementations after testing

### Phase 3: Complex Modal Extraction
9. Extract `VideoCard.ts` from `VideoManager.ts` (standalone component)
10. Create `VideoManager/VideoManager.ts` using core
11. Repeat for `TemplateEditor` (extract `GroupsTab`, `PresetsTab`)
12. Repeat for `ImportDecisionManager` (extract `DecisionRow`)

### Phase 4: Polish & Cleanup
13. Add focus trap for accessibility
14. Add loading state support to core
15. Update CSS to use shared modal classes
16. Remove deprecated files

### Dependency Order
```
types.ts (no deps)
   ↓
ModalOverlay.ts, ModalKeyboard.ts (depend on types)
   ↓
ModalFactory.ts (compose above)
   ↓
ConfirmModal, PromptModal (depend on Factory)
   ↓
VideoManager, etc. (depend on Factory + their own extracted components)
```

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **CSS selectors**: Some CSS may target `.video-manager-overlay` directly
- **Event handlers**: Custom event dispatching for `modal-close` may conflict
- **Animations**: Unified animation may feel different

### Validation Strategy

1. **Visual Regression Testing**:
   - Screenshot each modal before/after
   - Compare overlay opacity, container size, animation timing

2. **Interaction Tests**:
   - [ ] ESC closes all modals correctly
   - [ ] Click outside closes (where enabled)
   - [ ] Focus trap works (Tab doesn't escape modal)
   - [ ] Direction updates work (switch language mid-modal)

3. **Specific Modal Tests**:
   - [ ] ConfirmDialog returns true/false correctly
   - [ ] PromptDialog returns input value or null
   - [ ] VideoManager CRUD operations still work
   - [ ] TemplateEditor save/load works
   - [ ] ImportDecision merge/replace/skip works

### Accessibility Checklist
- [ ] `role="dialog"` on container
- [ ] `aria-modal="true"` set
- [ ] `aria-labelledby` pointing to title
- [ ] Focus moves to modal on open
- [ ] Focus returns to trigger on close
- [ ] Focus is trapped within modal

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Modal files | 5 (2,147 total lines) | 8 files but ~1,400 lines |
| Lines per new modal | ~80+ boilerplate | ~30-50 content only |
| ESC handler copies | 5 | 1 |
| Overlay creation copies | 5 | 1 |
| Accessibility features | Partial | Complete |
| Focus trap | None | Yes |

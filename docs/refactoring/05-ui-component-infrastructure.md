# Zone: UI Component Infrastructure & Button Factory

## 1️⃣ Zone Definition

**What this zone represents conceptually:**
The UI Component Infrastructure handles the creation, styling, and behavior of reusable UI primitives - buttons, inputs, overlays, progress indicators, and toast notifications. This provides the design system foundation that all features build upon.

**How it emerges from the current codebase:**
Currently, `src/components/ui/` contains only 4 files (Button, ProgressOverlay, Toast, index). However, button creation logic and UI helpers are scattered across:
- `src/components/ui/Button.ts` - main `createButton()` function
- `src/utils/ui.ts` - `styleToolbarButton()` helper
- Multiple components with inline button styling
- Toolbar components with their own button patterns

---

## 2️⃣ Evidence From Code

### Centralized Button Factory

```typescript
// src/components/ui/Button.ts (main implementation)
export function createButton(
  icon: string | null,
  text: string | null,
  onClick: (e: MouseEvent) => void,
  color?: string | null,
  variant: 'default' | 'primary' | 'danger' | 'success' = 'default'
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `btn btn--${variant}`;
  // ... styling and event handling
}
```

### Scattered Button Styling

```typescript
// src/utils/ui.ts
export function styleToolbarButton(button: HTMLElement) {
  Object.assign(button.style, {
    padding: '0.5rem',
    borderRadius: '4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    // ... more inline styles
  });
}
```

### Inline Button Creation in Components

**VideoManager.ts:**
```typescript
// Lines 564, 634, 721, etc. - multiple inline onclick handlers
const button = document.createElement('button');
button.className = 'video-card-action-btn';
button.onclick = () => { ... };
```

**TemplateEditor.ts:**
```typescript
// Inline button creation with similar patterns
const deleteBtn = document.createElement('button');
deleteBtn.className = 'preset-delete-btn';
deleteBtn.innerHTML = icons.DELETE;
```

**Note.ts:**
```typescript
// Uses createButton but also has custom styling:
const shareButton = createButton(icons.COPY, null, async (e) => { ... }, null, 'default');
shareButton.classList.add('share-button', 'btn--icon');  // Additional classes
```

### Missing Common Patterns

Components repeatedly implement the same UI patterns without shared utilities:

1. **Icon Button** (icon-only, no text):
```typescript
// Appears in Note.ts, VideoManager.ts, TemplateEditor.ts
button.classList.add('btn--icon');
button.innerHTML = icons.DELETE;  // or COPY, SETTINGS, etc.
```

2. **Loading State**:
```typescript
// No standard way to show loading on buttons
button.disabled = true;
button.textContent = 'Loading...';  // Manual, inconsistent
```

3. **Tooltip Support**:
```typescript
// Every component sets title manually
button.title = languageService.translate("deleteNote");
```

---

## 3️⃣ Current Problems

### Fragmented Button Creation
- `createButton()` exists but doesn't cover all use cases
- Components add classes like `btn--icon`, `btn--timestamp` after creation
- No standard icon-button variant in the factory

### Inline Styles vs CSS Classes
```typescript
// Some buttons use pure CSS classes (good)
button.className = 'btn btn--primary';

// Others mix inline styles (inconsistent)
Object.assign(button.style, { padding: '8px', ... });
```

### Missing Component Variants
Current `createButton()` supports: `default`, `primary`, `danger`, `success`

Missing but used in codebase:
- `icon` (icon-only buttons)
- `ghost` (transparent background)
- `link` (appears as link)
- `timestamp` (special note timestamp styling)

### No Loading/Disabled State API
```typescript
// Current: Manual state management
button.disabled = true;
button.classList.add('loading');
button.innerHTML = '<span class="spinner"></span>';

// Ideal: Built-in support
setButtonLoading(button, true);
// or
const button = createButton({ loading: true, ... });
```

### styleToolbarButton() Inconsistency
This function in `utils/ui.ts` applies inline styles that should be in CSS:
```typescript
export function styleToolbarButton(button: HTMLElement) {
  Object.assign(button.style, {
    padding: '0.5rem',
    borderRadius: '4px',
    // ... 10+ inline style properties
  });
}
```

---

## 4️⃣ Unification & Merge Opportunities

### Extended Button Variants

```typescript
type ButtonVariant = 
  | 'default'   // Neutral secondary action
  | 'primary'   // Main CTA
  | 'danger'    // Destructive action
  | 'success'   // Positive confirmation
  | 'ghost'     // Transparent, minimal  
  | 'icon'      // Icon-only, circular/square
  | 'link'      // Appears as link
  | 'timestamp'; // Special note timestamp styling

interface ButtonOptions {
  icon?: string;          // SVG or icon class
  text?: string;          // Button text
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;      // Shows spinner
  disabled?: boolean;
  tooltip?: string;       // i18n key
  ariaLabel?: string;     // Accessibility
  onClick?: (e: MouseEvent) => void;
}
```

### Unified Button Factory

```typescript
// Proposed enhancement to createButton
function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  
  // Base classes
  button.className = `btn btn--${options.variant ?? 'default'} btn--${options.size ?? 'md'}`;
  
  // Content
  if (options.icon && !options.text) {
    button.classList.add('btn--icon-only');
  }
  if (options.icon) {
    button.innerHTML = `<span class="btn__icon">${options.icon}</span>`;
  }
  if (options.text) {
    button.innerHTML += `<span class="btn__text">${options.text}</span>`;
  }
  
  // State
  if (options.loading) setButtonLoading(button, true);
  if (options.disabled) button.disabled = true;
  
  // Accessibility
  if (options.tooltip) button.title = languageService.translate(options.tooltip);
  if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel);
  
  // Events
  if (options.onClick) button.addEventListener('click', options.onClick);
  
  return button;
}
```

### State Management Utilities

```typescript
function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  button.classList.toggle('btn--loading', loading);
  button.disabled = loading;
  if (loading) {
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span>';
  } else {
    button.innerHTML = button.dataset.originalContent || '';
    delete button.dataset.originalContent;
  }
}

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
  button.classList.toggle('btn--disabled', disabled);
}
```

---

## 5️⃣ Proposed Target Shape

```
src/components/ui/
├── buttons/                   # NEW: Button-related components
│   ├── Button.ts              # Enhanced createButton()
│   ├── IconButton.ts          # Specialized icon-only button
│   ├── ButtonGroup.ts         # Radio-style button groups
│   └── buttonUtils.ts         # setButtonLoading, etc.
│
├── feedback/                  # NEW: Feedback components
│   ├── Toast.ts               # Keep existing
│   ├── ProgressOverlay.ts     # Keep existing  
│   └── Spinner.ts             # NEW: Reusable spinner
│
├── inputs/                    # NEW: Input components
│   ├── TextArea.ts            # Enhanced textarea with auto-resize
│   ├── Select.ts              # Custom styled select
│   └── Checkbox.ts            # Styled checkbox/toggle
│
├── layout/                    # NEW: Layout utilities
│   └── Tooltip.ts             # Proper tooltip component
│
└── index.ts                   # Barrel exports
```

### CSS Class Architecture

```css
/* Proposed: components.css enhancement */

/* Base button */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--btn-padding-y) var(--btn-padding-x);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}

/* Variants */
.btn--primary { ... }
.btn--danger { ... }
.btn--ghost { background: transparent; }
.btn--icon-only { 
  padding: var(--btn-padding-y);
  aspect-ratio: 1;
}

/* Sizes */
.btn--sm { font-size: var(--font-sm); }
.btn--md { font-size: var(--font-md); }
.btn--lg { font-size: var(--font-lg); }

/* States */
.btn--loading { pointer-events: none; }
.btn--loading .btn__text { visibility: hidden; }
.btn--loading::after { /* spinner pseudo-element */ }
```

---

## 6️⃣ Refactoring Plan

### Phase 1: Enhance Button Factory (Non-Breaking)
1. Extend `ButtonOptions` interface with new properties
2. Add `size`, `loading`, `disabled`, `tooltip` support
3. Add `btn--icon-only` class logic
4. Keep backward compatibility with current signature

### Phase 2: Extract State Utilities
5. Create `src/components/ui/buttons/buttonUtils.ts`
6. Implement `setButtonLoading()`, `setButtonDisabled()`
7. Export from main index

### Phase 3: Consolidate Inline Styles
8. Remove `styleToolbarButton()` from `utils/ui.ts`
9. Replace with CSS classes in `components.css`
10. Update components using `styleToolbarButton()`

### Phase 4: Create Specialized Components
11. Create `IconButton.ts` for icon-only shorthand
12. Create `Spinner.ts` for reusable loading indicator
13. Create `ButtonGroup.ts` if needed for presets

### Phase 5: Update Component Usage
14. Update `Note.ts` to use `IconButton` for share/delete
15. Update `VideoManager.ts` action buttons
16. Update `TemplateEditor.ts` button creation
17. Audit all button creation sites

---

## 7️⃣ Risk & Validation Notes

### What Might Break
- **CSS specificity**: New classes may conflict with existing styles
- **Backward compatibility**: Old 5-arg signature must still work
- **Icon rendering**: Different icon HTML structures

### Validation Strategy

1. **Visual Regression**:
   - Screenshot all button types before/after
   - Compare hover, active, disabled states
   - Check theme switching (light/dark)

2. **Functional Tests**:
   - [ ] All button variants render correctly
   - [ ] Loading state shows spinner and disables
   - [ ] Tooltip appears on hover
   - [ ] Click handlers fire correctly
   - [ ] Keyboard navigation works

3. **Accessibility Audit**:
   - [ ] All buttons have accessible names
   - [ ] Focus states visible
   - [ ] Disabled buttons not focusable (or indicate state)

### Backward Compatibility

```typescript
// Current signature (keep working)
createButton(icon, text, onClick, color, variant);

// New signature (add support)
createButton({ icon, text, onClick, variant, loading, ... });

// Implementation detects which was used
function createButton(
  iconOrOptions: string | null | ButtonOptions,
  text?: string | null,
  onClick?: Function,
  color?: string | null,
  variant?: ButtonVariant
): HTMLButtonElement {
  const options = typeof iconOrOptions === 'object' && iconOrOptions !== null
    ? iconOrOptions
    : { icon: iconOrOptions, text, onClick, variant };
  // ... proceed with options object
}
```

---

## 📊 Impact Summary

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Button creation patterns | 3+ variations | 1 unified factory |
| Inline button styles | Many | 0 (all CSS) |
| Loading state support | None | Built-in |
| Button size variants | 1 | 3 (sm, md, lg) |
| Icon button shorthand | None | `createIconButton()` |
| `styleToolbarButton()` usages | Multiple | 0 (deprecated) |

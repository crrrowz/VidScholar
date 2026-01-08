# 🎯 Dynamic Preset System - Implementation Plan (Final)

**Document Version:** 3.0  
**Created:** January 8, 2026  
**Revised:** January 8, 2026  
**Status:** Ready for Implementation

---

## 📊 Executive Summary

Extend the existing `TemplateEditor.ts` to manage Presets dynamically using the **same UI pattern as Video Groups**. The Templates tab will be hidden by default and only appear when editing a specific preset.

---

## 🗄️ Database Schema

### Current Cloud Structure (Supabase)

```json
{
  "1": {
    "name": "High Importance",
    "description": "Critical concepts, exam topics, and core definitions",
    "templates": [
      "Critical Concept: ",
      "Definition: ",
      "Potential Exam Question: ",
      "Key Takeaway: ",
      "Must Memorize: ",
      "Core Principle: ",
      "Summary of Main Point: ",
      "Important Formula/Rule: ",
      "Conclusion: ",
      "Cause and Effect: "
    ]
  },
  "2": {
    "name": "Medium Importance",
    "description": "Supporting details, examples, and clarifications",
    "templates": ["Supporting Example: ", "..."]
  },
  "3": {
    "name": "Low Importance",
    "description": "General notes, references, and questions",
    "templates": ["Side Note: ", "..."]
  },
  "4": { "name": "Preset 4", "description": "Custom preset 4", "templates": [] },
  "5": { "name": "Preset 5", "description": "Custom preset 5", "templates": [] },
  "6": { "name": "Preset 6", "description": "Custom preset 6", "templates": [] },
  "7": { "name": "Preset 7", "description": "Custom preset 7", "templates": [] },
  "8": { "name": "Preset 8", "description": "Custom preset 8", "templates": [] },
  "9": { "name": "Preset 9", "description": "Custom preset 9", "templates": [] }
}
```

### Extended Dynamic Structure

We'll keep the same structure but add optional fields for dynamic management:

```json
{
  "1": {
    "name": "High Importance",
    "description": "Critical concepts, exam topics, and core definitions",
    "templates": ["Critical Concept: ", "..."],
    "order": 0,           // NEW: Display order
    "isDefault": true,    // NEW: Protected from deletion
    "createdAt": 1704700000000,  // NEW: Optional
    "updatedAt": 1704700000000   // NEW: Optional
  },
  "2": { ... },
  "3": { ... },
  "10": {                 // NEW: User-created preset
    "name": "My Research Notes",
    "description": "For academic research",
    "templates": ["Hypothesis: ", "Evidence: ", "Conclusion: "],
    "order": 9,
    "isDefault": false,   // Can be deleted
    "createdAt": 1704800000000,
    "updatedAt": 1704800000000
  }
}
```

### Key Points

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Display name of preset |
| `description` | string | ✅ | Tooltip/description |
| `templates` | string[] | ✅ | Array of template strings |
| `order` | number | ❌ | Display order (falls back to key) |
| `isDefault` | boolean | ❌ | If true, cannot be deleted (1-3) |
| `createdAt` | number | ❌ | Unix timestamp |
| `updatedAt` | number | ❌ | Unix timestamp |

### Dynamic Operations

```typescript
// ADD: Generate next available numeric key
const existingKeys = Object.keys(presets).map(Number).filter(n => !isNaN(n));
const newKey = String(Math.max(...existingKeys, 0) + 1); // "10", "11", etc.

// DELETE: Only if isDefault !== true and key > 3
if (presets[key] && !presets[key].isDefault && parseInt(key) > 3) {
  delete presets[key];
}

// REORDER: Update 'order' field, sort by order when displaying
presets[key].order = newOrderIndex;

// SYNC: Push entire presets object to SettingsService
await settingsService.update({ presets });
```

### Backward Compatibility

- Existing presets (1-9) continue to work without any migration
- New fields (`order`, `isDefault`, `createdAt`, `updatedAt`) are optional
- `config.json` remains as fallback for fresh installs
- Cloud data takes priority over local config

---

## 🎯 UX Flow

### Default View (2 Tabs)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐                            [X]  │
│  │ Groups   │ │ Presets  │  ← Only 2 tabs visible          │
│  └──────────┘ └──────────┘                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRESETS TAB (Active by default)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Preset List (scrollable, drag & drop)               │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ ● 1 - High Importance    [Edit] [Delete] [≡]   │ │   │
│  │ │   2 - Medium Importance  [Edit] [Delete] [≡]   │ │   │
│  │ │   3 - Low Importance     [Edit] [Delete] [≡]   │ │   │
│  │ │   4 - My Custom Preset   [Edit] [Delete] [≡]   │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │ ADD NEW PRESET                                       │   │
│  │ ┌────────────────────────────────┐ ┌───────────────┐│   │
│  │ │ New preset name...             │ │ Copy from: ▼ ││   │
│  │ └────────────────────────────────┘ └───────────────┘│   │
│  │                                              [+ Add] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### When Editing a Preset (3 Tabs - Templates tab appears)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────┐    [X]  │
│  │ Groups   │ │ Presets  │ │ 📝 High Importance  │         │
│  └──────────┘ └──────────┘ └─────────────────────┘         │
│                             ↑ Dynamic tab with preset name  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EDIT PRESET TAB (Active)                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │ Preset Name: [High Importance_______________]        │   │
│  │                                                      │   │
│  │ Description: [Critical concepts and exam topics]     │   │
│  │                                                      │   │
│  │ Templates:                                           │   │
│  │ ┌───────────────────────────────────────────────┐   │   │
│  │ │ Critical Concept:                              │   │   │
│  │ │ Definition:                                    │   │   │
│  │ │ Key Takeaway:                                  │   │   │
│  │ │ Must Memorize:                                 │   │   │
│  │ │ ...                                            │   │   │
│  │ └───────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │          [Cancel]              [💾 Save Changes]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                       USER FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Open Template Editor                                    │
│          ↓                                                  │
│  2. See Presets tab (default) with list of presets          │
│          ↓                                                  │
│  3. Click [Edit] on any preset                              │
│          ↓                                                  │
│  4. Templates tab appears with preset name                  │
│     - Edit name, description, templates                     │
│          ↓                                                  │
│  5a. Click [Save] → Save changes, hide Templates tab,       │
│       return to Presets list                                │
│                                                             │
│  5b. Click [Cancel] → Discard changes, hide Templates tab,  │
│       return to Presets list                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Details

### Key Changes to TemplateEditor.ts

#### 1. Tab Structure

```typescript
// Tabs: Groups | Presets | [Edit: Preset Name] (hidden by default)

// Groups tab (existing)
const groupTabButton = createButton(/* ... */);

// Presets tab (NEW - default active)
const presetTabButton = createButton(
  null,
  languageService.translate("presetsTitle", "Presets"),
  () => switchToPresetsTab(),
  'presetTabButton',
  'ghost'
);

// Edit Preset tab (hidden by default, shows when editing)
const editPresetTabButton = createButton(
  null,
  '', // Will be set dynamically: "📝 Preset Name"
  () => { /* Already on this tab */ },
  'editPresetTabButton',
  'ghost'
);
editPresetTabButton.style.display = 'none'; // Hidden by default
```

#### 2. Content Sections

```typescript
// Groups content (existing)
const groupContent = document.createElement('div');

// Presets list content (NEW)
const presetContent = document.createElement('div');
presetContent.className = 'preset-management-content';

// Edit preset content (replaces old templateContent)
const editPresetContent = document.createElement('div');
editPresetContent.className = 'template-editor-content-section';
editPresetContent.style.display = 'none'; // Hidden by default
```

#### 3. Preset List Rendering (reuse group styling)

```typescript
function renderPresets() {
  presetListContainer.innerHTML = '';
  
  const presets = getPresetsFromSettings();
  const currentPresetId = getCurrentPresetId();
  
  Object.entries(presets)
    .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
    .forEach(([id, preset]) => {
      
      // Reuse EXACT same structure as group items
      const presetItem = document.createElement('div');
      presetItem.className = 'group-item template-editor-group-item group-item-board';
      presetItem.dataset.presetId = id;
      
      // Active indicator
      if (id === String(currentPresetId)) {
        presetItem.classList.add('preset-item--active');
      }
      
      // Name span (same as groups)
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${id} - ${preset.name}`;
      presetItem.appendChild(nameSpan);
      
      // Button container (same as groups)
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'group-item-actions';
      
      // Select button (make current)
      const selectBtn = createButton('check_circle', null, async () => {
        await noteStorage.savePresetNumber(parseInt(id));
        renderPresets();
      }, undefined, 'ghost');
      selectBtn.title = 'Select this preset';
      
      // Edit button → Shows Templates tab
      const editBtn = createButton('edit', null, () => {
        showEditPresetTab(id, preset);
      }, undefined, 'ghost');
      editBtn.classList.add('edit-group-btn');
      
      // Delete button (disabled for defaults 1-3)
      const deleteBtn = createButton('delete', null, async () => {
        if (parseInt(id) <= 3) {
          showToast('Cannot delete default preset', 'error');
          return;
        }
        await deletePreset(id);
        renderPresets();
      }, undefined, 'ghost');
      deleteBtn.classList.add('delete-group-btn');
      if (parseInt(id) <= 3) {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.3';
      }
      
      // Drag handle (same as groups)
      const dragHandle = createButton('drag_indicator', null, () => {}, undefined, 'ghost');
      dragHandle.classList.add('drag-handle');
      dragHandle.style.cursor = 'grab';
      
      buttonContainer.append(selectBtn, editBtn, deleteBtn, dragHandle);
      presetItem.appendChild(buttonContainer);
      presetListContainer.appendChild(presetItem);
    });
}
```

#### 4. Show Edit Tab Function

```typescript
function showEditPresetTab(presetId: string, preset: Preset) {
  // Update tab button text
  editPresetTabButton.textContent = `📝 ${preset.name}`;
  editPresetTabButton.style.display = 'inline-flex';
  
  // Populate edit form
  presetNameInput.value = preset.name;
  presetDescInput.value = preset.description || '';
  editTextArea.value = preset.templates.join('\n');
  
  // Store current editing preset ID
  editingPresetId = presetId;
  
  // Switch to edit tab
  groupContent.style.display = 'none';
  presetContent.style.display = 'none';
  editPresetContent.style.display = 'flex';
  
  // Update tab active states
  groupTabButton.classList.remove('active-tab');
  presetTabButton.classList.remove('active-tab');
  editPresetTabButton.classList.add('active-tab');
}
```

#### 5. Save and Cancel Functions

```typescript
async function savePresetChanges() {
  const newName = presetNameInput.value.trim();
  const newDesc = presetDescInput.value.trim();
  const newTemplates = editTextArea.value
    .split('\n')
    .map(t => t.trim())
    .filter(t => t);
  
  await noteStorage.savePresetName(parseInt(editingPresetId), newName);
  await noteStorage.savePresetDescription(parseInt(editingPresetId), newDesc);
  await noteStorage.savePresetTemplates(parseInt(editingPresetId), newTemplates);
  
  // If this is the current preset, update the store
  const currentPreset = await noteStorage.getCurrentPreset();
  if (String(currentPreset) === editingPresetId) {
    actions.setTemplates(newTemplates);
  }
  
  showToast('Preset saved successfully', 'success');
  hideEditTabAndReturnToPresets();
}

function cancelPresetEdit() {
  hideEditTabAndReturnToPresets();
}

function hideEditTabAndReturnToPresets() {
  // Hide edit tab button
  editPresetTabButton.style.display = 'none';
  
  // Switch back to presets tab
  editPresetContent.style.display = 'none';
  presetContent.style.display = 'flex';
  
  // Update tab active states
  editPresetTabButton.classList.remove('active-tab');
  presetTabButton.classList.add('active-tab');
  
  // Refresh presets list
  renderPresets();
  
  // Clear editing state
  editingPresetId = null;
}
```

#### 6. Add New Preset Function

```typescript
async function addNewPreset() {
  const name = addPresetNameInput.value.trim();
  if (!name) {
    showToast('Please enter a preset name', 'error');
    return;
  }
  
  const copyFromId = copyFromSelect.value;
  
  // Get templates to copy
  let templates: string[] = [];
  if (copyFromId) {
    const settings = settingsService.getSettings();
    templates = settings.presets[copyFromId]?.templates || [];
  }
  
  // Generate new ID
  const settings = settingsService.getSettings();
  const existingIds = Object.keys(settings.presets).map(Number).filter(n => !isNaN(n));
  const newId = String(Math.max(...existingIds, 0) + 1);
  
  // Create new preset
  const presets = settings.presets || {};
  presets[newId] = {
    id: newId,
    name: name,
    description: '',
    templates: templates,
    order: Object.keys(presets).length,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  await settingsService.update({ presets });
  
  // Clear input
  addPresetNameInput.value = '';
  copyFromSelect.value = '';
  
  showToast('Preset added', 'success');
  renderPresets();
  
  // Optionally open edit mode for the new preset
  showEditPresetTab(newId, presets[newId]);
}
```

---

## 📁 File Changes Summary

### 1. `src/types/index.ts`

```typescript
// Add Preset interface
export interface Preset {
  id?: string;
  name: string;
  description: string;
  templates: string[];
  order?: number;
  isDefault?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
```

### 2. `src/classes/NoteStorage.ts`

Add methods:
- `savePresetDescription(presetNumber, description)`
- `addPreset(name, copyFromId?)`
- `deletePreset(presetId)`
- `reorderPresets(orderedIds[])`

### 3. `src/components/modals/TemplateEditor.ts`

Major changes:
- Add `presetTabButton` (default active)
- Add `presetContent` section with list
- Rename/repurpose `templateContent` → `editPresetContent`
- Hide `templateTabButton` → becomes `editPresetTabButton`
- Add `renderPresets()` function
- Add `showEditPresetTab()` function
- Add `savePresetChanges()` / `cancelPresetEdit()`
- Add `addNewPreset()` function
- Initialize Sortable for preset reordering

### 4. `src/components/toolbar/PresetButtons.ts`

Update to read from `settingsService.getSettings().presets` instead of `config.getPresets()`.

### 5. `entrypoints/content/styles/modals.css`

Add styles:
```css
.preset-management-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-md);
}

.preset-item--active {
  border-left: 3px solid var(--color-primary);
  background: var(--color-surface-elevated);
}

.add-preset-container {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.add-preset-container input {
  flex: 1;
}

.add-preset-container select {
  width: 150px;
}
```

### 6. Translation Keys

```json
{
  "presetsTitle": "Presets",
  "addPreset": "Add Preset",
  "presetNamePlaceholder": "Preset name",
  "copyFromPlaceholder": "Copy from...",
  "noCopy": "Empty (no templates)",
  "presetAdded": "Preset added",
  "presetSaved": "Preset saved",
  "presetDeleted": "Preset deleted",
  "cannotDeleteDefault": "Cannot delete default presets (1-3)",
  "selectPreset": "Select",
  "cancelEdit": "Cancel"
}
```

---

## 📅 Implementation Steps

| Step | Task | Time |
|------|------|------|
| 1 | Update `types/index.ts` with Preset interface | 15 min |
| 2 | Add CRUD methods to `NoteStorage.ts` | 45 min |
| 3 | Add Presets tab and content to `TemplateEditor.ts` | 2 hours |
| 4 | Implement `renderPresets()` with group styling | 30 min |
| 5 | Implement edit flow (show/hide tabs) | 45 min |
| 6 | Implement add new preset | 30 min |
| 7 | Add Sortable for reordering | 30 min |
| 8 | Update `PresetButtons.ts` to use dynamic data | 30 min |
| 9 | Add CSS styles | 20 min |
| 10 | Add translations | 15 min |
| 11 | Testing & bug fixes | 1 hour |
| **Total** | | **~7 hours** |

---

## ✅ Success Criteria

- [ ] Presets tab is default when opening TemplateEditor
- [ ] All presets displayed in list with group-style cards
- [ ] Click [Edit] shows Templates tab with preset name
- [ ] Click [Save] saves and returns to Presets list
- [ ] Click [Cancel] discards and returns to Presets list
- [ ] Add new preset works with optional "copy from"
- [ ] Delete works for custom presets (not 1-3)
- [ ] Drag & drop reordering works
- [ ] Active preset visually highlighted
- [ ] Changes sync to cloud
- [ ] PresetButtons toolbar updates dynamically

---

*Final implementation plan - ready for development*

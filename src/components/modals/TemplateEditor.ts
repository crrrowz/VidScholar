import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { showToast } from '../../utils/toast';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import { settingsService } from '../../services/SettingsService';
import config from '../../utils/config';
import Sortable from 'sortablejs';

// Helper for translation with fallback
// Helper for translation with fallback
const t = (key: string, fallback?: string): string => {
  const translated = languageService.translate(key);
  return translated === key && fallback ? fallback : translated;
};

// State for editing preset
let editingPresetId: string | null = null;

export async function showTemplateEditor(): Promise<void> {
  if (document.querySelector("#editContainer")) return;

  try {
    const currentPreset = await noteStorage.getCurrentPreset();
    const currentTemplates = await noteStorage.loadPresetTemplates(currentPreset);
    actions.setTemplates(currentTemplates);

    const overlay = document.createElement('div');
    overlay.className = "template-editor-overlay";

    const editContainer = document.createElement("div");
    editContainer.id = "editContainer";
    editContainer.className = "template-editor-container";
    editContainer.setAttribute('dir', languageService.getCurrentDirection());

    const icons = config.getIcons();

    // ==========================================
    // TAB CONTAINER
    // ==========================================
    const tabContainer = document.createElement('div');
    tabContainer.className = 'template-editor-tabs';
    Object.assign(tabContainer.style, { marginBottom: '1rem' });

    const tabButtonsContainer = document.createElement('div');
    tabButtonsContainer.className = 'template-editor-tab-buttons-container';

    // --- Groups Tab Button ---
    const groupTabButton = createButton(
      null,
      t("videoGroupsTitle", "Groups"),
      () => switchToGroupsTab(),
      'groupTabButton',
      'ghost'
    );
    groupTabButton.classList.add('template-editor-tab-button');

    // --- Presets Tab Button (NEW - default active) ---
    const presetTabButton = createButton(
      null,
      t("presetsTitle", "Presets"),
      () => switchToPresetsTab(),
      'presetTabButton',
      'ghost'
    );
    presetTabButton.classList.add('template-editor-tab-button', 'active-tab');

    tabButtonsContainer.appendChild(groupTabButton);
    tabButtonsContainer.appendChild(presetTabButton);
    tabContainer.appendChild(tabButtonsContainer);

    // Close button
    const closeButton = createButton(icons['CLOSE'] ?? 'close', null, () => overlay.remove(), undefined, 'default');
    closeButton.classList.add('btn--icon');
    tabContainer.appendChild(closeButton);

    editContainer.appendChild(tabContainer);

    // ==========================================
    // GROUPS CONTENT (existing)
    // ==========================================
    const groupContent = document.createElement('div');
    groupContent.className = 'group-management-content';
    groupContent.style.display = 'none';

    const groupListContainer = document.createElement('div');
    groupListContainer.className = 'group-list-container template-editor-group-list-container';
    groupContent.appendChild(groupListContainer);

    const addGroupContainer = document.createElement('div');
    addGroupContainer.className = 'add-group-container template-editor-add-group-container';

    const addGroupInput = document.createElement('input');
    addGroupInput.type = 'text';
    addGroupInput.className = 'add-group-input template-editor-input-add-group';
    addGroupInput.placeholder = t("addNewGroupPlaceholder", "Add new group");

    const addGroupButton = createButton('add', null, () => {
      const newGroup = addGroupInput.value.trim();
      if (newGroup) {
        const currentGroups = settingsService.get('videoGroups');
        if (!currentGroups.includes(newGroup)) {
          const updatedGroups = [...currentGroups, newGroup];
          settingsService.update({ videoGroups: updatedGroups });
          renderGroups(updatedGroups);
          addGroupInput.value = '';
        } else {
          showToast(t("groupExistsError", "Group already exists"), 'error');
        }
      }
    }, undefined, 'primary');
    addGroupButton.classList.add('btn--icon');

    addGroupContainer.appendChild(addGroupInput);
    addGroupContainer.appendChild(addGroupButton);
    groupContent.appendChild(addGroupContainer);

    function renderGroups(groups: string[]) {
      groupListContainer.innerHTML = '';
      groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item template-editor-group-item group-item-board';
        Object.assign(groupItem.style, { marginBottom: '0.5rem' });

        const groupName = document.createElement('span');
        groupName.textContent = group;
        groupItem.appendChild(groupName);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'group-item-actions';

        const moveButton = createButton('drag_indicator', null, () => { }, undefined, 'ghost');
        moveButton.classList.add('drag-handle');
        moveButton.style.cursor = 'grab';

        const editButton = createButton('edit', null, () => {
          const groupNameInput = document.createElement('input');
          groupNameInput.type = 'text';
          groupNameInput.value = group;
          groupNameInput.className = 'edit-group-input';
          groupItem.replaceChild(groupNameInput, groupName);
          groupNameInput.focus();

          const saveButton = createButton('save', null, () => {
            const newGroupName = groupNameInput.value.trim();
            const currentGroups = settingsService.get('videoGroups');
            if (newGroupName && newGroupName !== group) {
              if (currentGroups.includes(newGroupName)) {
                showToast(t("groupExistsError", "Group already exists"), 'error');
                groupItem.replaceChild(groupName, groupNameInput);
                buttonContainer.replaceChild(editButton, saveButton);
              } else {
                const updatedGroups = currentGroups.map(g => (g === group ? newGroupName : g));
                settingsService.update({ videoGroups: updatedGroups });
                renderGroups(updatedGroups);
              }
            } else {
              groupItem.replaceChild(groupName, groupNameInput);
              buttonContainer.replaceChild(editButton, saveButton);
            }
          }, undefined, 'ghost');
          saveButton.classList.add('save-group-btn');
          buttonContainer.replaceChild(saveButton, editButton);
        }, undefined, 'ghost');
        editButton.classList.add('edit-group-btn');

        const deleteButton = createButton('delete', null, () => {
          const updatedGroups = settingsService.get('videoGroups').filter(g => g !== group);
          settingsService.update({ videoGroups: updatedGroups });
          renderGroups(updatedGroups);
        }, undefined, 'ghost');
        deleteButton.classList.add('delete-group-btn');

        buttonContainer.appendChild(editButton);
        buttonContainer.appendChild(deleteButton);
        buttonContainer.appendChild(moveButton);
        groupItem.appendChild(buttonContainer);
        groupListContainer.appendChild(groupItem);
      });

      // Sortable for groups
      new Sortable(groupListContainer, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        scroll: false,
        onStart: () => {
          let scrollInterval: ReturnType<typeof setInterval> | null = null;
          let currentScrollSpeed = 0;

          const handleDragOver = (e: DragEvent) => {
            const container = groupListContainer;
            const rect = container.getBoundingClientRect();
            const mouseY = e.clientY;
            const containerHeight = rect.height;
            const scrollZone = containerHeight * 0.25;
            const maxSpeed = 20;
            const minSpeed = 5;

            // Scroll Up
            if (mouseY < rect.top + scrollZone) {
              // Calculate proximity (starts at 0 at edge of zone, 1 at top edge, >1 outside)
              const distanceIntoZone = (rect.top + scrollZone) - mouseY;
              // Cap proximity at 1.5 for speed calc to avoid excessive speed
              const proximity = Math.min(distanceIntoZone / scrollZone, 1.5);
              currentScrollSpeed = -(minSpeed + (maxSpeed - minSpeed) * proximity);
            }
            // Scroll Down
            else if (mouseY > rect.bottom - scrollZone) {
              // Calculate proximity (starts at 0 at edge of zone, 1 at bottom edge, >1 outside)
              const distanceIntoZone = mouseY - (rect.bottom - scrollZone);
              const proximity = Math.min(distanceIntoZone / scrollZone, 1.5);
              currentScrollSpeed = minSpeed + (maxSpeed - minSpeed) * proximity;
            }
            else {
              currentScrollSpeed = 0;
            }
          };

          scrollInterval = setInterval(() => {
            if (currentScrollSpeed !== 0) {
              groupListContainer.scrollTop += currentScrollSpeed;
            }
          }, 16);

          document.addEventListener('dragover', handleDragOver, { capture: true });

          (groupListContainer as any).__dragCleanup = () => {
            document.removeEventListener('dragover', handleDragOver, { capture: true });
            if (scrollInterval) clearInterval(scrollInterval);
          };
        },
        onEnd: () => {
          if ((groupListContainer as any).__dragCleanup) {
            (groupListContainer as any).__dragCleanup();
            delete (groupListContainer as any).__dragCleanup;
          }

          const groupItems = [...groupListContainer.querySelectorAll('.group-item')];
          const newGroupOrder = groupItems.map(item => item.querySelector('span')!.textContent!);
          settingsService.update({ videoGroups: newGroupOrder });
        }
      });
    }

    // ==========================================
    // PRESETS CONTENT (using same classes as Groups)
    // ==========================================
    const presetContent = document.createElement('div');
    presetContent.className = 'group-management-content';
    presetContent.style.display = 'flex';

    const presetListContainer = document.createElement('div');
    presetListContainer.className = 'group-list-container template-editor-group-list-container';
    presetContent.appendChild(presetListContainer);

    // Add New Preset Section
    const addPresetContainer = document.createElement('div');
    addPresetContainer.className = 'add-group-container template-editor-add-group-container';

    const addPresetInput = document.createElement('input');
    addPresetInput.type = 'text';
    addPresetInput.className = 'add-group-input template-editor-input-add-group';
    addPresetInput.placeholder = t("addNewPresetPlaceholder", "New preset name...");
    addPresetInput.style.flex = '1';

    const copyFromSelect = document.createElement('select');
    copyFromSelect.className = 'template-editor-select';
    copyFromSelect.style.cssText = 'padding: 8px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); min-width: 120px;';

    const addPresetButton = createButton('add', null, async () => {
      const name = addPresetInput.value.trim();
      if (!name) {
        showToast(t("enterPresetName", "Please enter a preset name"), 'error');
        return;
      }
      const copyFromId = copyFromSelect.value || undefined;
      await noteStorage.addPreset(name, '', copyFromId);
      addPresetInput.value = '';
      copyFromSelect.value = '';
      showToast(t("presetAdded", "Preset added"), 'success');
      renderPresets();
    }, undefined, 'primary');
    addPresetButton.classList.add('btn--icon');

    addPresetContainer.appendChild(addPresetInput);
    addPresetContainer.appendChild(copyFromSelect);
    addPresetContainer.appendChild(addPresetButton);
    presetContent.appendChild(addPresetContainer);

    async function renderPresets() {
      presetListContainer.innerHTML = '';

      const presets = noteStorage.getAllPresets();
      const currentPresetId = await noteStorage.getCurrentPreset();

      // Debug logging
      console.log('[TemplateEditor] Presets:', presets);
      console.log('[TemplateEditor] Presets count:', Object.keys(presets).length);
      console.log('[TemplateEditor] Current preset:', currentPresetId);

      // Update copy-from dropdown
      copyFromSelect.innerHTML = `<option value="">${t("noCopy", "Empty (no copy)")}</option>`;
      Object.entries(presets).forEach(([id, preset]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = preset.name;
        copyFromSelect.appendChild(option);
      });

      // Sort presets by order or key
      const sortedPresets = Object.entries(presets)
        .sort(([aId, a], [bId, b]) => {
          const orderA = (a as any).order ?? parseInt(aId);
          const orderB = (b as any).order ?? parseInt(bId);
          return orderA - orderB;
        });

      sortedPresets.forEach(([id, preset]) => {
        const presetItem = document.createElement('div');
        presetItem.className = 'group-item template-editor-group-item group-item-board';
        presetItem.dataset['presetId'] = id;
        Object.assign(presetItem.style, { marginBottom: '0.5rem', cursor: 'pointer' });

        // Active indicator
        if (String(currentPresetId) === id) {
          presetItem.classList.add('preset-item--active');
        }

        // Click on preset item to select it
        presetItem.addEventListener('click', async (e) => {
          // Don't trigger if clicking on buttons
          if ((e.target as HTMLElement).closest('.group-item-actions')) return;

          await noteStorage.savePresetNumber(parseInt(id));
          const templates = await noteStorage.loadPresetTemplates(parseInt(id));
          actions.setTemplates(templates);
          showToast(t("presetSelected", `Preset ${id} selected`), 'success');
          renderPresets();
        });

        // Name span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = (preset as any).name || 'Preset ' + id;
        presetItem.appendChild(nameSpan);

        // Buttons container (same as Groups: edit, delete, drag)
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'group-item-actions';

        // Edit button → Shows Templates tab
        const editBtn = createButton('edit', null, () => {
          showEditPresetTab(id, preset as any);
        }, undefined, 'ghost');
        editBtn.classList.add('edit-group-btn');
        editBtn.title = t("editPreset", "Edit preset");

        // Delete button (disabled for 1-3)
        const deleteBtn = createButton('delete', null, async () => {
          if (parseInt(id) <= 3) {
            showToast(t("cannotDeleteDefault", "Cannot delete default presets (1-3)"), 'error');
            return;
          }
          const deleted = await noteStorage.deletePreset(id);
          if (deleted) {
            showToast(t("presetDeleted", "Preset deleted"), 'success');
            renderPresets();
          }
        }, undefined, 'ghost');
        deleteBtn.classList.add('delete-group-btn');
        if (parseInt(id) <= 3) {
          deleteBtn.style.opacity = '0.3';
          deleteBtn.style.cursor = 'not-allowed';
        }

        // Drag handle
        const dragHandle = createButton('drag_indicator', null, () => { }, undefined, 'ghost');
        dragHandle.classList.add('drag-handle');
        dragHandle.style.cursor = 'grab';

        buttonContainer.appendChild(editBtn);
        buttonContainer.appendChild(deleteBtn);
        buttonContainer.appendChild(dragHandle);
        presetItem.appendChild(buttonContainer);
        presetListContainer.appendChild(presetItem);
      });

      // Debug: Verify items were added
      console.log('[TemplateEditor] Items added to list:', presetListContainer.children.length);

      // Sortable for presets
      new Sortable(presetListContainer, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        scroll: false,
        onStart: () => {
          let scrollInterval: ReturnType<typeof setInterval> | null = null;
          let currentScrollSpeed = 0;

          const handleDragOver = (e: DragEvent) => {
            const container = presetListContainer;
            const rect = container.getBoundingClientRect();
            const mouseY = e.clientY;
            const containerHeight = rect.height;
            const scrollZone = containerHeight * 0.25;
            const maxSpeed = 20;
            const minSpeed = 5;

            // Scroll Up
            if (mouseY < rect.top + scrollZone) {
              const distanceIntoZone = (rect.top + scrollZone) - mouseY;
              const proximity = Math.min(distanceIntoZone / scrollZone, 1.5);
              currentScrollSpeed = -(minSpeed + (maxSpeed - minSpeed) * proximity);
            }
            // Scroll Down
            else if (mouseY > rect.bottom - scrollZone) {
              const distanceIntoZone = mouseY - (rect.bottom - scrollZone);
              const proximity = Math.min(distanceIntoZone / scrollZone, 1.5);
              currentScrollSpeed = minSpeed + (maxSpeed - minSpeed) * proximity;
            }
            else {
              currentScrollSpeed = 0;
            }
          };

          scrollInterval = setInterval(() => {
            if (currentScrollSpeed !== 0) {
              presetListContainer.scrollTop += currentScrollSpeed;
            }
          }, 16);

          document.addEventListener('dragover', handleDragOver, { capture: true });

          (presetListContainer as any).__dragCleanup = () => {
            document.removeEventListener('dragover', handleDragOver, { capture: true });
            if (scrollInterval) clearInterval(scrollInterval);
          };
        },
        onEnd: async () => {
          if ((presetListContainer as any).__dragCleanup) {
            (presetListContainer as any).__dragCleanup();
            delete (presetListContainer as any).__dragCleanup;
          }

          const presetItems = [...presetListContainer.querySelectorAll('.group-item')];
          const orderedIds = presetItems.map(item => (item as HTMLElement).dataset['presetId']!);
          await noteStorage.reorderPresets(orderedIds);
        }
      });
    }

    // ==========================================
    // EDIT PRESET CONTENT (Hidden by default)
    // ==========================================
    const editPresetContent = document.createElement('div');
    editPresetContent.className = 'template-editor-content template-editor-content-section';
    editPresetContent.style.display = 'none';

    // Preset Name Input
    const presetNameInput = document.createElement('input');
    presetNameInput.type = 'text';
    presetNameInput.className = 'preset-name-input template-editor-input-preset-name';
    presetNameInput.placeholder = t("presetNamePlaceholder", "Preset name");
    Object.assign(presetNameInput.style, { marginBottom: '0.5rem' });
    editPresetContent.appendChild(presetNameInput);

    // Preset Description Input
    const presetDescInput = document.createElement('input');
    presetDescInput.type = 'text';
    presetDescInput.className = 'preset-desc-input';
    presetDescInput.placeholder = t("presetDescPlaceholder", "Description (optional)");
    Object.assign(presetDescInput.style, {
      marginBottom: '1rem',
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      color: 'var(--color-text-primary)'
    });
    editPresetContent.appendChild(presetDescInput);

    // Templates Textarea
    const editTextArea = document.createElement("textarea");
    editTextArea.className = "template-editor-textarea";
    editTextArea.placeholder = t("templatePlaceholder", "Enter templates, one per line");
    Object.assign(editTextArea.style, { marginBottom: '1rem', flex: '1' });
    editPresetContent.appendChild(editTextArea);

    // Button Row
    const editButtonRow = document.createElement('div');
    editButtonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const cancelButton = createButton(null, t("goBackButton", "Back"), () => {
      hideEditTabAndReturnToPresets();
    }, undefined, 'default');

    const savePresetButton = createButton(null, t("saveChangesButton", "Save"), async () => {
      await savePresetChanges();
    }, undefined, 'primary');

    editButtonRow.appendChild(cancelButton);
    editButtonRow.appendChild(savePresetButton);
    editPresetContent.appendChild(editButtonRow);

    // ==========================================
    // TAB SWITCHING FUNCTIONS
    // ==========================================
    function switchToGroupsTab() {
      groupContent.style.display = 'flex';
      presetContent.style.display = 'none';
      editPresetContent.style.display = 'none';

      groupTabButton.classList.add('active-tab');
      presetTabButton.classList.remove('active-tab');

      renderGroups(settingsService.get('videoGroups'));
    }

    function switchToPresetsTab() {
      groupContent.style.display = 'none';
      presetContent.style.display = 'flex';
      editPresetContent.style.display = 'none';

      groupTabButton.classList.remove('active-tab');
      presetTabButton.classList.add('active-tab');

      renderPresets();
    }

    function showEditPresetTab(presetId: string, preset: { name: string; description?: string; templates: string[] }) {
      editingPresetId = presetId;

      // Populate form
      presetNameInput.value = preset.name || '';
      presetDescInput.value = preset.description || '';
      editTextArea.value = (preset.templates || []).join('\n');

      // Switch to edit content (keep Presets tab active)
      groupContent.style.display = 'none';
      presetContent.style.display = 'none';
      editPresetContent.style.display = 'flex';

      // Keep Presets tab active
      groupTabButton.classList.remove('active-tab');
      presetTabButton.classList.add('active-tab');

      editTextArea.focus();
    }

    async function savePresetChanges() {
      if (!editingPresetId) return;

      const presetNumber = parseInt(editingPresetId);
      const newName = presetNameInput.value.trim();
      const newDesc = presetDescInput.value.trim();
      const newTemplates = editTextArea.value
        .split('\n')
        .map(t => t.trim())
        .filter(t => t);

      // Save name
      if (newName) {
        await noteStorage.savePresetName(presetNumber, newName);
      }

      // Save description
      await noteStorage.savePresetDescription(presetNumber, newDesc);

      // Save templates
      await noteStorage.savePresetTemplates(presetNumber, newTemplates);

      // If this is the current preset, update the store
      const currentPreset = await noteStorage.getCurrentPreset();
      if (currentPreset === presetNumber) {
        actions.setTemplates(newTemplates);
      }

      showToast(t("presetSaved", "Preset saved successfully"), 'success');
      hideEditTabAndReturnToPresets();
    }

    function hideEditTabAndReturnToPresets() {
      editingPresetId = null;
      switchToPresetsTab();
    }

    // ==========================================
    // ASSEMBLE & RENDER
    // ==========================================
    editContainer.appendChild(groupContent);
    editContainer.appendChild(presetContent);
    editContainer.appendChild(editPresetContent);

    overlay.appendChild(editContainer);
    document.querySelector("#vidscholar-root")?.appendChild(overlay);

    // Initial render - Presets tab is default
    await renderPresets();

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
    });

  } catch (error) {
    showToast(t("failedToLoadTemplates", "Failed to load templates"), "error");
  }
}
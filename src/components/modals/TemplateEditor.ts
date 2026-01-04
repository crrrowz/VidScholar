import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { themeService } from '../../services/ThemeService';
import { showToast } from '../../utils/toast';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import { settingsService } from '../../services/SettingsService';
import config from '../../utils/config'; // Import config
import Sortable from 'sortablejs';

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
    // Removed editContainer.style.position = 'relative'

    const icons = config.getIcons(); // Get icons for close button

    const tabContainer = document.createElement('div');
    tabContainer.className = 'template-editor-tabs';
    Object.assign(tabContainer.style, {
      marginBottom: '1rem' // Added margin
    });

    // Container for the two tab buttons
    const tabButtonsContainer = document.createElement('div');
    tabButtonsContainer.className = 'template-editor-tab-buttons-container';
    // Removed Object.assign(tabButtonsContainer.style, {...}) and replaced with class

    const templateTabButton = createButton(
      null,
      languageService.translate("editTemplatesTitle", "Edit Templates"),
      () => {
        templateContent.style.display = 'flex';
        groupContent.style.display = 'none';
        templateTabButton.classList.add('active-tab'); // Use class for active state
        groupTabButton.classList.remove('active-tab'); // Use class for active state
      },
      'templateTabButton',
      'ghost'
    );
    templateTabButton.classList.add('template-editor-tab-button', 'active-tab'); // Apply common class and initial active state
    templateTabButton.addEventListener('click', () => {
      templateTabButton.classList.add('active-tab');
      groupTabButton.classList.remove('active-tab');
    });


    const groupTabButton = createButton(
      null,
      languageService.translate("videoGroupsTitle", "Video Groups"),
      () => {
        templateContent.style.display = 'none';
        groupContent.style.display = 'flex';
        groupTabButton.classList.add('active-tab'); // Use class for active state
        templateTabButton.classList.remove('active-tab'); // Use class for active state
      },
      'groupTabButton',
      'ghost'
    );
    groupTabButton.classList.add('template-editor-tab-button'); // Apply common class
    groupTabButton.addEventListener('click', () => {
      groupTabButton.classList.add('active-tab');
      templateTabButton.classList.remove('active-tab');
    });

    tabButtonsContainer.appendChild(templateTabButton);
    tabButtonsContainer.appendChild(groupTabButton);
    tabContainer.appendChild(tabButtonsContainer); // Append tab buttons group

    // Create a new close button (not absolutely positioned)
    const closeButton = createButton(icons.CLOSE, null, () => overlay.remove(), undefined, 'default');
    closeButton.classList.add('btn--icon');
    // The closeButton now has default flex behavior within tabContainer
    tabContainer.appendChild(closeButton);

    editContainer.appendChild(tabContainer);

    // Template Content Section
    const templateContent = document.createElement('div');
    templateContent.className = 'template-editor-content template-editor-content-section';
    // Removed Object.assign(templateContent.style, {...}) and replaced with class

    // Preset Name Input
    let presetName = await noteStorage.loadPresetName(currentPreset);
    if (!presetName) {
      presetName = noteStorage.getPresetDefaultName(currentPreset);
    }
    const presetNameInput = document.createElement('input');
    presetNameInput.type = 'text';
    presetNameInput.className = 'preset-name-input template-editor-input-preset-name';
    presetNameInput.value = presetName;
    presetNameInput.placeholder = languageService.translate("presetNamePlaceholder");
    Object.assign(presetNameInput.style, {
      marginBottom: '1rem' // Added margin
    });
    templateContent.appendChild(presetNameInput);

    const editTextArea = document.createElement("textarea");
    editTextArea.className = "template-editor-textarea";
    editTextArea.value = getStore().getState().templates.join("\n");
    editTextArea.placeholder = languageService.translate("templatePlaceholder");
    Object.assign(editTextArea.style, {
      marginBottom: '1rem' // Added margin
    });
    templateContent.appendChild(editTextArea);

    const templateSaveButton = createButton(null, languageService.translate("saveChangesButton"), async () => {
      try {
        const newTemplates = editTextArea.value
          .split("\n")
          .map(template => template.trim())
          .filter(template => template);

        await noteStorage.savePresetTemplates(currentPreset, newTemplates);

        const newPresetName = presetNameInput.value.trim();
        if (newPresetName) {
          await noteStorage.savePresetName(currentPreset, newPresetName);
        } else {
          // Revert to default name
          const defaultName = noteStorage.getPresetDefaultName(currentPreset);
          await noteStorage.savePresetName(currentPreset, defaultName);
        }

        actions.setTemplates(newTemplates);
        overlay.remove();
        showToast(languageService.translate("templatesSavedSuccessfully"), "success");
      } catch (error) {
        console.error('Failed to save templates:', error);
        showToast(languageService.translate("failedToSaveTemplates"), "error");
      }
    }, undefined, 'primary');
    Object.assign(templateSaveButton.style, {
      marginBottom: '1rem' // Added margin
    });
    templateContent.appendChild(templateSaveButton);


    // Group Content Section
    const groupContent = document.createElement('div');
    groupContent.className = 'group-management-content'; // Apply class for flexbox layout

    const groupListContainer = document.createElement('div');
    groupListContainer.className = 'group-list-container template-editor-group-list-container';
    groupContent.appendChild(groupListContainer);

    const addGroupContainer = document.createElement('div');
    addGroupContainer.className = 'add-group-container template-editor-add-group-container';

    const addGroupInput = document.createElement('input');
    addGroupInput.type = 'text';
    addGroupInput.className = 'add-group-input template-editor-input-add-group';
    addGroupInput.placeholder = languageService.translate("addNewGroupPlaceholder", "Add new group");
    // Removed Object.assign(addGroupInput.style, {...}) and replaced with class

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
          showToast(languageService.translate("groupExistsError", "Group already exists"), 'error');
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
        Object.assign(groupItem.style, {
          marginBottom: '0.5rem' // Added margin
        });

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
                showToast(languageService.translate("groupExistsError", "Group already exists"), 'error');
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
    }

    renderGroups(settingsService.get('videoGroups'));

    new Sortable(groupListContainer, {
      animation: 150,
      handle: '.drag-handle',
      direction: languageService.getCurrentDirection(),
      onEnd: () => {
        const groupItems = [...groupListContainer.querySelectorAll('.group-item')];
        const newGroupOrder = groupItems.map(item => item.querySelector('span')!.textContent!);
        settingsService.update({ videoGroups: newGroupOrder });
      }
    });

    editContainer.appendChild(templateContent);
    editContainer.appendChild(groupContent);


    overlay.appendChild(editContainer);
    document.querySelector("#vidscholar-root")?.appendChild(overlay);

    // Initial focus on template editor textarea if templates tab is active
    editTextArea.focus();
    editTextArea.setSelectionRange(editTextArea.value.length, editTextArea.value.length);

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
    });

  } catch (error) {
    showToast(languageService.translate("failedToLoadTemplates"), "error");
  }
}
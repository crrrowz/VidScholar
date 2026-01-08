// components/toolbar/PresetButtons.ts
import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { showToast } from '../../utils/toast';
import { languageService } from '../../services/LanguageService';

export async function createPresetButtons(): Promise<HTMLElement> {
  // Create a select dropdown instead of button grid
  const presetSelect = document.createElement("select");
  presetSelect.id = 'presetSelect';
  presetSelect.classList.add('sub-toolbar-group-select');
  presetSelect.style.cssText = 'width: 100%; height: 36px; padding: 6px 10px; box-sizing: border-box; flex-shrink: 0;';

  const updatePresetSelect = async () => {
    const currentPreset = await noteStorage.getCurrentPreset();
    const presets = noteStorage.getAllPresets();

    presetSelect.innerHTML = '';

    // Sort presets by order or key
    const sortedPresets = Object.entries(presets)
      .sort(([aId, a], [bId, b]) => {
        const orderA = (a as any).order ?? parseInt(aId);
        const orderB = (b as any).order ?? parseInt(bId);
        return orderA - orderB;
      });

    sortedPresets.forEach(([key, preset]) => {
      const option = document.createElement("option");
      option.value = key;
      option.text = (preset as any).name || 'Preset ' + key;
      option.title = (preset as any).description || '';
      presetSelect.add(option);
    });

    // Set the selected value
    presetSelect.value = String(currentPreset);
  };

  try {
    await updatePresetSelect();

    presetSelect.onchange = async () => {
      const selectedPreset = parseInt(presetSelect.value);
      await handlePresetChange(selectedPreset);
    };

    // Subscribe to template changes to refresh dropdown
    noteStorage.addTemplateListener(() => {
      updatePresetSelect();
    });

  } catch (error) {
    console.error('Failed to initialize preset dropdown:', error);
    showToast(languageService.translate("failedToInitializePresets"), 'error');
  }

  return presetSelect;
}

async function handlePresetChange(presetNumber: number): Promise<void> {
  try {
    const state = getStore().getState();
    const currentPreset = await noteStorage.getCurrentPreset();
    if (currentPreset === presetNumber) return;

    // Save current templates before switching
    await noteStorage.savePresetTemplates(currentPreset, [...state.templates]);

    // Switch to new preset
    await noteStorage.savePresetNumber(presetNumber);

    // Load new preset templates
    const newTemplates = await noteStorage.loadPresetTemplates(presetNumber);
    actions.setTemplates(newTemplates);

    showToast(languageService.translate("switchedToPreset", [presetNumber.toString()]), 'success');
  } catch (error) {
    console.error('Preset change failed:', error);
    showToast(languageService.translate("failedToChangePresets"), 'error');
  }
}

// components/toolbar/PresetButtons.ts
import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { showToast } from '../../utils/toast';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';

export async function createPresetButtons(): Promise<HTMLElement> {
  const container = document.createElement("div");
  container.className = 'preset-group';
  Object.assign(container.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px'
  });

  try {
    const currentPreset = await noteStorage.getCurrentPreset();
    const presets = noteStorage.getAllPresets();
    const buttons: HTMLButtonElement[] = [];

    // Sort presets by order or key
    const sortedPresets = Object.entries(presets)
      .sort(([aId, a], [bId, b]) => {
        const orderA = (a as any).order ?? parseInt(aId);
        const orderB = (b as any).order ?? parseInt(bId);
        return orderA - orderB;
      });

    // Limit to first 9 presets for toolbar display
    const displayPresets = sortedPresets.slice(0, 9);

    displayPresets.forEach(([key, preset]) => {
      const num = parseInt(key);

      const button = createButton(
        null,
        String(num),
        () => { },
        `preset-btn-${num}`,
        'default'
      );
      button.title = `${(preset as any).name}: ${(preset as any).description || ''}`;
      Object.assign(button.style, {
        padding: '4px 8px',
        fontSize: '12px'
      });

      if (num === currentPreset) {
        button.classList.add('active');
      }

      button.addEventListener("click", async () => {
        try {
          await handlePresetChange(num);

          buttons.forEach((btn) => {
            btn.classList.remove('active');
          });
          button.classList.add('active');
        } catch (error) {
          console.error('Failed to handle preset change:', error);
          showToast(languageService.translate("failedToSwitchPresets"), 'error');
        }
      });

      buttons.push(button);
      container.appendChild(button);
    });

    // Subscribe to template changes to refresh buttons
    noteStorage.addTemplateListener(() => {
      refreshPresetButtons(container, buttons);
    });

  } catch (error) {
    console.error('Failed to initialize preset buttons:', error);
    showToast(languageService.translate("failedToInitializePresets"), 'error');
  }

  return container;
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

async function refreshPresetButtons(_container: HTMLElement, buttons: HTMLButtonElement[]): Promise<void> {
  try {
    const currentPreset = await noteStorage.getCurrentPreset();
    const presets = noteStorage.getAllPresets();

    // Update button titles and active states
    buttons.forEach((btn, index) => {
      const presetId = Object.keys(presets).sort((a, b) => {
        const orderA = (presets[a] as any).order ?? parseInt(a);
        const orderB = (presets[b] as any).order ?? parseInt(b);
        return orderA - orderB;
      })[index];

      if (presetId && presets[presetId]) {
        const preset = presets[presetId] as any;
        btn.title = `${preset.name}: ${preset.description || ''}`;
        btn.textContent = presetId;

        if (parseInt(presetId) === currentPreset) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  } catch (error) {
    console.error('Failed to refresh preset buttons:', error);
  }
}

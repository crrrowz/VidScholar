// components/toolbar/PresetButtons.ts
import { getStore } from '../../state/Store';
import { actions } from '../../state/actions';
import { noteStorage } from '../../classes/NoteStorage';
import { themeService } from '../../services/ThemeService'; // Keep for event listener, if needed globally
import { showToast } from '../../utils/toast';
import config from '../../utils/config';
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
    const presets = config.getPresets();
    const buttons: HTMLButtonElement[] = [];

    Object.keys(presets).forEach(key => {
      const num = parseInt(key);
      const preset = presets[key];
      
      const button = createButton(
        null,
        String(num),
        () => {},
        `preset-btn-${num}`,
        'default'
      );
      button.title = preset.description;
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

  } catch (error) {
    console.error('Failed to initialize preset buttons:', error);
    showToast(languageService.translate("failedToInitializePresets"), 'error');
  }

  return container;
}

async function handlePresetChange(
  presetNumber: number
): Promise<void> {
  try {
    const state = getStore().getState();
    const currentPreset = await noteStorage.getCurrentPreset();
    if (currentPreset === presetNumber) return;

    await noteStorage.savePresetTemplates(currentPreset, [...state.templates]);
    
    await noteStorage.savePresetNumber(presetNumber);
    
    showToast(languageService.translate("switchedToPreset", [presetNumber.toString()]), 'success');
  } catch (error) {
    console.error('Preset change failed:', error);
    showToast(languageService.translate("failedToChangePresets"), 'error');
  }
}

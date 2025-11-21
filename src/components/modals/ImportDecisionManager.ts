import { themeService } from '../../services/ThemeService';
import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import config from '../../utils/config';

export interface ImportDecision {
  videoId: string;
  action: 'merge' | 'replace' | 'skip';
  notes?: Note[];
}

export interface ImportDecisionModalOptions {
    type: 'video_notes' | 'all_notes';
    importedData: VideoNotesExport | AllNotesExport;
    existingAllNotes?: StoredVideoData[];
    currentVideoId?: string;
}

export async function showImportDecisionManager(options: ImportDecisionModalOptions): Promise<ImportDecision[] | null> {
  return new Promise((resolve) => {
    if (document.querySelector("#importDecisionManager")) return;

    const overlay = document.createElement('div');
    overlay.id = "importDecisionManager";
    overlay.className = "import-decision-manager-overlay";

    const closeManager = (result: ImportDecision[] | null) => {
      overlay.classList.remove('visible');
      setTimeout(() => {
          overlay.remove();
          document.body.style.overflow = '';
          resolve(result);
      }, 200);
    };

    document.querySelector("#vidscholar-root")?.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';
    
    const container = document.createElement('div');
    container.className = "import-decision-manager-container";
    container.setAttribute('dir', languageService.getCurrentDirection());
  
    const updateDirection = () => {
      container.setAttribute('dir', languageService.getCurrentDirection());
    };
    languageService.addDirectionListener(updateDirection);

    const header = document.createElement('div');
    header.className = "import-decision-header";

    const title = document.createElement('h2');
    title.textContent = languageService.translate("importDecisionTitle");

    const icons = config.getIcons();
    const closeButton = createButton(icons.CLOSE, '', () => closeManager(null), undefined, 'ghost');
    closeButton.classList.add('btn--icon');

    header.appendChild(title);
    header.appendChild(closeButton);

    const content = document.createElement('div');
    content.className = "import-decision-content";
    content.textContent = languageService.translate("loadingDecisions");

    const footer = document.createElement('div');
    footer.className = "import-decision-footer";

    const cancelButton = createButton(null, languageService.translate("cancelButton"), () => closeManager(null), undefined, 'default');
    
    const applyButton = createButton(null, languageService.translate("applyChanges"), () => {}, 'import-decision-apply-button', 'primary');
    
    footer.appendChild(cancelButton);
    footer.appendChild(applyButton);

    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);
    overlay.appendChild(container);

    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeManager(null);
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeManager(null); });

    renderDecisionContent(content, options, closeManager);
  });
}

async function renderDecisionContent(
    contentElement: HTMLElement,
    options: ImportDecisionModalOptions,
    closeManager: (result: ImportDecision[] | null) => void
) {
    contentElement.innerHTML = '';

    const decisionState = new Map<string, 'merge' | 'replace' | 'skip'>();

    if (options.type === 'video_notes') {
        const data = options.importedData as VideoNotesExport;

        const title = document.createElement('h3');
        title.textContent = languageService.translate("singleVideoImportTitle", [data.videoTitle || data.videoId]);
        contentElement.appendChild(title);

        const description = document.createElement('p');
        description.className = "import-description";
        description.textContent = languageService.translate("singleVideoImportDescription");
        contentElement.appendChild(description);

        const mergeCheckboxWrapper = document.createElement('div');
        mergeCheckboxWrapper.className = "import-checkbox-wrapper";

        const mergeCheckbox = document.createElement('input');
        mergeCheckbox.type = 'checkbox';
        mergeCheckbox.id = `merge-checkbox-${data.videoId}`;
        mergeCheckbox.checked = decisionState.get(data.videoId) === 'merge';
        mergeCheckbox.onchange = (e) => {
            const isChecked = (e.target as HTMLInputElement).checked;
            decisionState.set(data.videoId, isChecked ? 'merge' : 'replace');
        };

        const mergeLabel = document.createElement('label');
        mergeLabel.htmlFor = mergeCheckbox.id;
        mergeLabel.textContent = languageService.translate("mergeWithExistingNotes");

        mergeCheckboxWrapper.append(mergeCheckbox, mergeLabel);
        contentElement.appendChild(mergeCheckboxWrapper);

        if (!decisionState.has(data.videoId)) {
            decisionState.set(data.videoId, 'merge');
            mergeCheckbox.checked = true;
        }

        const applyButton = document.querySelector('#import-decision-apply-button');
        if (applyButton) {
            applyButton.onclick = () => {
                const action = mergeCheckbox.checked ? 'merge' : 'replace';
                const finalDecisions: ImportDecision[] = [{ videoId: data.videoId, action: action, notes: data.notes }];
                closeManager(finalDecisions);
            };
        }

    } else if (options.type === 'all_notes') {
        const importedAllNotes = (options.importedData as AllNotesExport).notesByVideo;
        const existingAllNotesMap = new Map<string, StoredVideoData>();
        options.existingAllNotes?.forEach(video => existingAllNotesMap.set(video.videoId, video));

        const mergeCheckboxWrapper = document.createElement('div');
        mergeCheckboxWrapper.className = "import-checkbox-wrapper global-merge-checkbox";
        const mergeCheckbox = document.createElement('input');
        mergeCheckbox.type = 'checkbox';
        mergeCheckbox.id = `merge-checkbox-global`;
        mergeCheckbox.checked = true;

        const mergeLabel = document.createElement('label');
        mergeLabel.htmlFor = mergeCheckbox.id;
        mergeLabel.textContent = languageService.translate("mergeWithExistingNotes");
        
        mergeCheckboxWrapper.append(mergeCheckbox, mergeLabel);
        contentElement.appendChild(mergeCheckboxWrapper);

        const videoListContainer = document.createElement('div');
        videoListContainer.className = "import-video-list";
        contentElement.appendChild(videoListContainer);

        importedAllNotes.forEach(importedVideo => {
            const existingVideo = existingAllNotesMap.get(importedVideo.videoId);
            const isNew = !existingVideo;

            const videoRow = document.createElement('div');
            videoRow.className = "import-video-row";

            const statusIndicator = document.createElement('span');
            statusIndicator.className = `status-indicator ${isNew ? 'new' : 'existing'}`;
            statusIndicator.textContent = isNew ? languageService.translate("newVideo") : languageService.translate("existingVideo");

            const videoTitle = document.createElement('span');
            videoTitle.className = "video-title";
            videoTitle.textContent = importedVideo.videoTitle || importedVideo.videoId;

            videoRow.append(statusIndicator, videoTitle);
            videoListContainer.appendChild(videoRow);
        });

        const applyButton = document.querySelector('#import-decision-apply-button');
        if (applyButton) {
            applyButton.onclick = () => {
                const isMerge = mergeCheckbox.checked;
                const finalDecisions: ImportDecision[] = [];

                importedAllNotes.forEach(importedVideo => {
                    const existingVideo = existingAllNotesMap.get(importedVideo.videoId);
                    const action = existingVideo ? (isMerge ? 'merge' : 'replace') : 'merge';
                    finalDecisions.push({ videoId: importedVideo.videoId, action: action, notes: importedVideo.notes });
                });

                closeManager(finalDecisions);
            };
        }
    }
}
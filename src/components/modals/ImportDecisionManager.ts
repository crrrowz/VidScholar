import { languageService } from '../../services/LanguageService';
import { createButton } from '../ui/Button';
import config from '../../utils/config';
import type { Note, VideoNotesExport, AllNotesExport, StoredVideoData } from '../../types';

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
        container.id = "import-decision-manager-container"; // Add ID for specificity
        container.setAttribute('dir', languageService.getCurrentDirection());

        // INJECT STYLES DIRECTLY TO GUARANTEE APPLICATION
        const style = document.createElement('style');
        style.textContent = `
            #import-decision-manager-container .import-section {
                margin-top: 24px !important;
                padding: 20px !important;
                background-color: var(--color-surface-elevated, #fff) !important;
                border-radius: 12px !important;
                border: 1px solid var(--color-border, #e5e7eb) !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
            }
            #import-decision-manager-container .import-section-header {
                margin: 0 0 16px 0 !important;
                font-size: 18px !important;
                font-weight: 700 !important;
                color: var(--color-text-primary, #111) !important;
                padding-bottom: 12px !important;
                border-bottom: 2px solid var(--color-border, #e5e7eb) !important;
                display: flex !important; 
                align-items: center !important;
                gap: 12px !important;
            }
            #import-decision-manager-container .import-warning-message {
                display: block;
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05)) !important;
                border: 1px solid rgba(239, 68, 68, 0.3) !important;
                border-left: 4px solid #ef4444 !important;
                border-radius: 12px !important;
                padding: 16px !important;
                color: #ef4444 !important;
                font-weight: bold !important;
                margin-top: 24px !important;
                margin-bottom: 20px !important;
                text-align: center !important;
            }
            #import-decision-manager-container .status-indicator {
                font-weight: 700 !important;
                font-size: 11px !important;
                padding: 4px 10px !important;
                border-radius: 6px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-width: 70px !important;
                color: white !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            }
            #import-decision-manager-container .status-indicator.new { background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; }
            #import-decision-manager-container .status-indicator.existing { background: linear-gradient(135deg, #d97706, #b45309) !important; }
            #import-decision-manager-container .status-indicator.kept { background: linear-gradient(135deg, #16a34a, #15803d) !important; }
            #import-decision-manager-container .status-indicator.deleted { background: linear-gradient(135deg, #dc2626, #b91c1c) !important; }
            
            #import-decision-manager-container .import-video-row {
                display: flex !important;
                align-items: center !important;
                gap: 16px !important;
                padding: 12px !important;
                background: var(--color-surface, #fff) !important;
                border-bottom: 1px solid var(--color-border, #f3f4f6) !important;
                position: relative !important; /* Needed for overlay */
                overflow: hidden !important; /* Ensure overlay stays inside */
            }
            
            /* Remove section background change */
            #import-decision-manager-container .existing-section.delete-mode {
                background: transparent !important;
                border: 1px solid var(--color-border, #e5e7eb) !important;
            }

            /* Red layer OVER the video card */
            #import-decision-manager-container .import-video-row.to-be-deleted::after {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgba(239, 68, 68, 0.12) !important; /* Light red layer */
                pointer-events: none !important;
                z-index: 1 !important;
            }

            /* Strikethrough text */
            #import-decision-manager-container .import-video-row.to-be-deleted .video-title {
                text-decoration: line-through !important;
                text-decoration-color: rgba(239, 68, 68, 0.8) !important;
                color: var(--color-text-secondary, #6b7280) !important;
                opacity: 0.8 !important;
            }
        `;
        container.appendChild(style);

        const updateDirection = () => {
            container.setAttribute('dir', languageService.getCurrentDirection());
        };
        languageService.addDirectionListener(updateDirection);

        const header = document.createElement('div');
        header.className = "import-decision-header";

        const title = document.createElement('h2');
        title.textContent = languageService.translate("importDecisionTitle");

        const icons = config.getIcons();
        const closeIcon = icons['CLOSE'] || null;
        const closeButton = createButton(closeIcon, '', () => closeManager(null), undefined, 'ghost');
        closeButton.classList.add('btn--icon');

        header.appendChild(title);
        header.appendChild(closeButton);

        const content = document.createElement('div');
        content.className = "import-decision-content";
        content.textContent = languageService.translate("loadingDecisions");

        const footer = document.createElement('div');
        footer.className = "import-decision-footer";

        const cancelButton = createButton(null, languageService.translate("cancelButton"), () => closeManager(null), undefined, 'default');

        const applyButton = createButton(null, languageService.translate("applyChanges"), () => { }, 'import-decision-apply-button', 'primary');

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

        const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
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

        // Get imported video IDs for comparison
        const importedVideoIds = new Set(importedAllNotes.map(v => v.videoId));

        // Find existing videos that are NOT in the import (will be deleted on replace)
        const videosToDelete: StoredVideoData[] = [];
        existingAllNotesMap.forEach((video, videoId) => {
            if (!importedVideoIds.has(videoId)) {
                videosToDelete.push(video);
            }
        });

        // Merge checkbox
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

        // Warning message (shown when merge is disabled)
        const warningMessage = document.createElement('div');
        warningMessage.className = "import-warning-message";
        warningMessage.innerHTML = `⚠️ ${languageService.translate("replaceWarning") || "Warning: Videos below will be DELETED when merge is disabled!"}`;
        warningMessage.style.display = 'none';
        contentElement.appendChild(warningMessage);

        // === IMPORTED VIDEOS SECTION ===
        const importedSection = document.createElement('div');
        importedSection.className = "import-section";

        const importedHeader = document.createElement('h4');
        importedHeader.className = "import-section-header";
        importedHeader.textContent = `📥 ${languageService.translate("importedVideos") || "Imported Videos"} (${importedAllNotes.length})`;
        importedSection.appendChild(importedHeader);

        const importedListContainer = document.createElement('div');
        importedListContainer.className = "import-video-list imported-list";

        importedAllNotes.forEach(importedVideo => {
            const existingVideo = existingAllNotesMap.get(importedVideo.videoId);
            const isNew = !existingVideo;

            const videoRow = document.createElement('div');
            videoRow.className = "import-video-row";

            const statusIndicator = document.createElement('span');
            statusIndicator.className = `status-indicator ${isNew ? 'new' : 'existing'}`;
            statusIndicator.textContent = isNew
                ? (languageService.translate("newVideo") || "New")
                : (languageService.translate("willUpdate") || "Update");

            const videoTitle = document.createElement('span');
            videoTitle.className = "video-title";
            videoTitle.textContent = importedVideo.videoTitle || importedVideo.videoId;

            const notesCount = document.createElement('span');
            notesCount.className = "notes-count";
            notesCount.textContent = `(${importedVideo.notes.length} ${languageService.translate("notes") || "notes"})`;

            videoRow.append(statusIndicator, videoTitle, notesCount);
            importedListContainer.appendChild(videoRow);
        });

        importedSection.appendChild(importedListContainer);
        contentElement.appendChild(importedSection);

        // === EXISTING VIDEOS SECTION (only if there are videos to delete) ===
        let existingSection: HTMLElement | null = null;
        let existingListContainer: HTMLElement | null = null;

        if (videosToDelete.length > 0) {
            existingSection = document.createElement('div');
            existingSection.className = "import-section existing-section";

            const existingHeader = document.createElement('h4');
            existingHeader.className = "import-section-header existing-header";
            existingHeader.textContent = `📁 ${languageService.translate("existingVideos") || "Existing Videos (not in import)"} (${videosToDelete.length})`;
            existingSection.appendChild(existingHeader);

            const listContainer = document.createElement('div');
            listContainer.className = "import-video-list existing-list";
            existingListContainer = listContainer; // Assign to outer var for updateDeleteWarning use

            videosToDelete.forEach(existingVideo => {
                const videoRow = document.createElement('div');
                videoRow.className = "import-video-row existing-video-row";
                videoRow.dataset['videoId'] = existingVideo.videoId;

                const statusIndicator = document.createElement('span');
                statusIndicator.className = "status-indicator kept";
                statusIndicator.textContent = languageService.translate("willKeep") || "Keep";

                const videoTitle = document.createElement('span');
                videoTitle.className = "video-title";
                videoTitle.textContent = existingVideo.videoTitle || existingVideo.videoId;

                const notesCount = document.createElement('span');
                notesCount.className = "notes-count";
                notesCount.textContent = `(${existingVideo.notes.length} ${languageService.translate("notes") || "notes"})`;

                videoRow.append(statusIndicator, videoTitle, notesCount);
                listContainer.appendChild(videoRow);
            });

            existingSection.appendChild(listContainer);
            contentElement.appendChild(existingSection);
        }

        // Function to update UI based on merge checkbox state
        const updateDeleteWarning = () => {
            const isMerge = mergeCheckbox.checked;

            if (existingSection && existingListContainer) {
                if (isMerge) {
                    // Merge mode: existing videos will be kept
                    existingSection.classList.remove('delete-mode');
                    warningMessage.style.display = 'none';
                    existingListContainer.querySelectorAll('.existing-video-row').forEach(row => {
                        row.classList.remove('to-be-deleted');
                        const indicator = row.querySelector('.status-indicator');
                        if (indicator) {
                            indicator.textContent = languageService.translate("willKeep") || "Keep";
                            indicator.className = "status-indicator kept";
                        }
                    });
                } else {
                    // Replace mode: existing videos will be deleted
                    existingSection.classList.add('delete-mode');
                    warningMessage.style.display = 'block';
                    existingListContainer.querySelectorAll('.existing-video-row').forEach(row => {
                        row.classList.add('to-be-deleted');
                        const indicator = row.querySelector('.status-indicator');
                        if (indicator) {
                            indicator.textContent = languageService.translate("willDelete") || "DELETE";
                            indicator.className = "status-indicator deleted";
                        }
                    });
                }
            }
        };

        // Listen for checkbox changes
        mergeCheckbox.addEventListener('change', updateDeleteWarning);

        const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
        if (applyButton) {
            applyButton.onclick = () => {
                const isMerge = mergeCheckbox.checked;
                const finalDecisions: ImportDecision[] = [];

                importedAllNotes.forEach(importedVideo => {
                    const action = isMerge ? 'merge' : 'replace';
                    finalDecisions.push({ videoId: importedVideo.videoId, action: action, notes: importedVideo.notes });
                });

                closeManager(finalDecisions);
            };
        }
    }
}
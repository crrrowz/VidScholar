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
    existingVideoNotes?: Note[];  // For single video import comparison
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
            #import-decision-manager-container .import-info-message {
                display: block;
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05)) !important;
                border: 1px solid rgba(34, 197, 94, 0.3) !important;
                border-left: 4px solid #22c55e !important;
                border-radius: 12px !important;
                padding: 16px !important;
                color: #15803d !important; /* Green-700 */
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
            }
            
            /* Force transparent background on section container */
            #import-decision-manager-container .existing-section.delete-mode {
                background: transparent !important;
                background-color: transparent !important;
                border: 1px solid var(--color-border, #e5e7eb) !important;
                box-shadow: none !important;
            }

            /* Ensure row background is white (not red) underneath the overlay */
            #import-decision-manager-container .import-video-row.to-be-deleted {
                background: var(--color-surface, #fff) !important;
                background-color: var(--color-surface, #fff) !important;
                position: relative !important;
            }

            /* Strikethrough style: RED LINE BEHIND TEXT for maximum readability */
            #import-decision-manager-container .import-video-row.to-be-deleted .video-title {
                text-decoration: none !important;
                position: relative !important;
                display: inline-block !important;
                color: var(--color-text-primary, #000) !important; /* Adaptive contrast */
                font-weight: 600 !important;
                
                /* Create a 2px red line in the center using background gradient */
                background-image: linear-gradient(transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)) !important;
                background-repeat: no-repeat !important;
                background-size: 100% 100% !important;
                background-position: center !important;
            }
            /* Red layer OVER the video card - made slightly more visible */
            #import-decision-manager-container .import-video-row.to-be-deleted::after {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgba(239, 68, 68, 0.08) !important; /* Subtle red tint */
                pointer-events: none !important;
                z-index: 1 !important;
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

    if (options.type === 'video_notes') {
        const data = options.importedData as VideoNotesExport;
        const existingNotes = options.existingVideoNotes || [];

        // Helper to check for note differences
        const areNotesDifferent = (note1: Note, note2: Note): boolean => {
            return note1.timestamp !== note2.timestamp || note1.text?.trim() !== note2.text?.trim();
        };

        // Find notes that exist in both (by timestamp)
        const existingTimestamps = new Set(existingNotes.map(n => n.timestamp));
        const importedTimestamps = new Set(data.notes.map(n => n.timestamp));

        // Categorize imported notes
        const newNotes = data.notes.filter(n => !existingTimestamps.has(n.timestamp));
        const updatedNotes = data.notes.filter(n => {
            if (!existingTimestamps.has(n.timestamp)) return false;
            const existing = existingNotes.find(e => e.timestamp === n.timestamp);
            return existing && areNotesDifferent(n, existing);
        });
        // Note: unchanged notes are not displayed, only new and updated are shown

        // Existing notes that are NOT in the import (will be deleted on replace)
        const notesToDelete = existingNotes.filter(n => !importedTimestamps.has(n.timestamp));

        // Notes to display in imported section (only new or changed)
        const displayedImportedNotes = [...newNotes, ...updatedNotes];

        // ========== NO CHANGES AT ALL: Show simple "up to date" message ==========
        if (displayedImportedNotes.length === 0 && notesToDelete.length === 0) {
            // Show a simple "everything is up to date" message
            const upToDateContainer = document.createElement('div');
            upToDateContainer.className = "import-up-to-date-container";
            upToDateContainer.style.cssText = "text-align: center; padding: 40px 20px;";

            const iconWrapper = document.createElement('div');
            iconWrapper.style.cssText = "width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);";
            const icon = document.createElement('span');
            icon.className = "material-icons";
            icon.style.cssText = "font-size: 32px; color: white;";
            icon.textContent = "check_circle";
            iconWrapper.appendChild(icon);

            const message = document.createElement('p');
            message.style.cssText = "font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 8px 0;";
            message.textContent = languageService.translate("allUpToDate") || "Everything is up to date!";

            const subMessage = document.createElement('p');
            subMessage.style.cssText = "font-size: 14px; color: var(--color-text-secondary); margin: 0;";
            subMessage.textContent = languageService.translate("noChangesNeeded") || "The imported notes match your existing notes exactly.";

            upToDateContainer.append(iconWrapper, message, subMessage);
            contentElement.appendChild(upToDateContainer);

            // Change apply button to just "OK"
            const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
            if (applyButton) {
                applyButton.textContent = languageService.translate("okButton") || "OK";
                applyButton.onclick = () => {
                    const finalDecisions: ImportDecision[] = [{ videoId: data.videoId, action: 'merge', notes: data.notes }];
                    closeManager(finalDecisions);
                };
            }

            // Hide cancel button when there's nothing to cancel
            const cancelButton = document.querySelector('.import-decision-footer .btn--default') as HTMLElement;
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }

            return;
        }

        // ========== NO NEW CONTENT (even if import is subset) ==========
        // If there are NO new/updated notes, show "up to date" message
        // The import file might be older/smaller, but there's nothing new to add
        if (displayedImportedNotes.length === 0) {
            // Show "everything is up to date" message
            const upToDateContainer = document.createElement('div');
            upToDateContainer.className = "import-up-to-date-container";
            upToDateContainer.style.cssText = "text-align: center; padding: 40px 20px;";

            const iconWrapper = document.createElement('div');
            iconWrapper.style.cssText = "width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);";
            const icon = document.createElement('span');
            icon.className = "material-icons";
            icon.style.cssText = "font-size: 32px; color: white;";
            icon.textContent = "check_circle";
            iconWrapper.appendChild(icon);

            const message = document.createElement('p');
            message.style.cssText = "font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 8px 0;";
            message.textContent = languageService.translate("allUpToDate") || "Everything is up to date!";

            const subMessage = document.createElement('p');
            subMessage.style.cssText = "font-size: 14px; color: var(--color-text-secondary); margin: 0;";
            subMessage.textContent = languageService.translate("noChangesNeeded") || "The imported notes match your existing notes exactly.";

            upToDateContainer.append(iconWrapper, message, subMessage);
            contentElement.appendChild(upToDateContainer);

            // Change apply button to just "OK"
            const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
            if (applyButton) {
                applyButton.textContent = languageService.translate("okButton") || "OK";
                applyButton.onclick = () => {
                    const finalDecisions: ImportDecision[] = [{ videoId: data.videoId, action: 'merge', notes: data.notes }];
                    closeManager(finalDecisions);
                };
            }

            // Hide cancel button
            const cancelButton = document.querySelector('.import-decision-footer .btn--default') as HTMLElement;
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }

            return;
        }

        // From here, we have new content to show
        const mergeCheckboxWrapper = document.createElement('div');
        mergeCheckboxWrapper.className = "import-checkbox-wrapper global-merge-checkbox";
        const mergeCheckbox = document.createElement('input');
        mergeCheckbox.type = 'checkbox';
        mergeCheckbox.id = `merge-checkbox-${data.videoId}`;
        mergeCheckbox.checked = true;

        const mergeLabel = document.createElement('label');
        mergeLabel.htmlFor = mergeCheckbox.id;
        mergeLabel.textContent = languageService.translate("mergeWithExistingNotes");

        mergeCheckboxWrapper.append(mergeCheckbox, mergeLabel);

        // Only show merge checkbox if there are NEW notes
        // If only updates (no new notes), merge/replace doesn't apply - we're just updating
        const hasNewNotes = newNotes.length > 0;
        if (hasNewNotes) {
            contentElement.appendChild(mergeCheckboxWrapper);
        }

        // Warning message (shown when merge is disabled)
        const warningMessage = document.createElement('div');
        warningMessage.className = "import-warning-message";
        warningMessage.innerHTML = `⚠️ ${languageService.translate("replaceNotesWarning") || "Warning: Notes below will be DELETED when merge is disabled!"}`;
        warningMessage.style.display = 'none';
        contentElement.appendChild(warningMessage);

        // === IMPORTED NOTES SECTION ===
        if (displayedImportedNotes.length > 0) {
            const importedSection = document.createElement('div');
            importedSection.className = "import-section";

            const importedHeader = document.createElement('h4');
            importedHeader.className = "import-section-header";
            importedHeader.textContent = `📥 ${languageService.translate("importedNotes") || "Imported Notes"} (${displayedImportedNotes.length})`;
            importedSection.appendChild(importedHeader);

            const importedListContainer = document.createElement('div');
            importedListContainer.className = "import-video-list imported-list";

            displayedImportedNotes.forEach(note => {
                const isNew = newNotes.includes(note);

                const noteRow = document.createElement('div');
                noteRow.className = "import-video-row";

                const statusIndicator = document.createElement('span');
                statusIndicator.className = `status-indicator ${isNew ? 'new' : 'existing'}`;
                statusIndicator.textContent = isNew
                    ? (languageService.translate("newNote") || "New")
                    : (languageService.translate("willUpdate") || "Update");

                const timestamp = document.createElement('span');
                timestamp.className = "note-timestamp";
                timestamp.textContent = note.timestamp;

                const noteText = document.createElement('span');
                noteText.className = "video-title note-text";
                noteText.textContent = note.text?.substring(0, 50) + (note.text?.length > 50 ? '...' : '');

                noteRow.append(statusIndicator, timestamp, noteText);
                importedListContainer.appendChild(noteRow);
            });

            importedSection.appendChild(importedListContainer);
            contentElement.appendChild(importedSection);
        }
        // Note: If displayedImportedNotes is empty, we handled it earlier with "up to date" message

        // === EXISTING NOTES SECTION ===
        // Only show if there are NEW notes being added
        // If only updates, we're not changing the note count, so no need for merge/delete options
        let existingSection: HTMLElement | null = null;
        let existingListContainer: HTMLElement | null = null;

        if (notesToDelete.length > 0 && hasNewNotes) {
            existingSection = document.createElement('div');
            existingSection.className = "import-section existing-section";

            const existingHeader = document.createElement('h4');
            existingHeader.className = "import-section-header existing-header";
            existingHeader.textContent = `📁 ${languageService.translate("existingNotes") || "Existing Notes (not in import)"} (${notesToDelete.length})`;
            existingSection.appendChild(existingHeader);

            const listContainer = document.createElement('div');
            listContainer.className = "import-video-list existing-list";
            existingListContainer = listContainer;

            notesToDelete.forEach(note => {
                const noteRow = document.createElement('div');
                noteRow.className = "import-video-row existing-video-row";
                noteRow.dataset['timestamp'] = note.timestamp;

                const statusIndicator = document.createElement('span');
                statusIndicator.className = "status-indicator kept";
                statusIndicator.textContent = languageService.translate("willKeep") || "Keep";

                const timestamp = document.createElement('span');
                timestamp.className = "note-timestamp";
                timestamp.textContent = note.timestamp;

                const noteText = document.createElement('span');
                noteText.className = "video-title note-text";
                noteText.textContent = note.text?.substring(0, 50) + (note.text?.length > 50 ? '...' : '');

                noteRow.append(statusIndicator, timestamp, noteText);
                listContainer.appendChild(noteRow);
            });

            existingSection.appendChild(listContainer);
            contentElement.appendChild(existingSection);
        }

        // Function to update UI based on merge checkbox state
        const updateDeleteWarning = () => {
            const isMerge = mergeCheckbox.checked;

            if (existingSection && existingListContainer) {
                if (isMerge) {
                    // Merge mode: existing notes will be kept
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
                    // Replace mode: existing notes will be deleted
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

        // Helper to check for actual changes
        const areNotesDifferent = (notes1: Note[], notes2: Note[]): boolean => {
            if (notes1.length !== notes2.length) return true;
            // Create a signature based on timestamp and text for comparison
            // We verify: timestamp (string), text
            const sig = (n: Note[]) => n.map(x => `${x.timestamp}:${x.text?.trim()}`).sort().join('||');
            return sig(notes1) !== sig(notes2);
        };

        // Filter imported notes to render ONLY new or changed videos
        const displayedImportedNotes = importedAllNotes.filter(importedVideo => {
            const existingVideo = existingAllNotesMap.get(importedVideo.videoId);
            if (!existingVideo) return true; // New video -> Show
            return areNotesDifferent(importedVideo.notes, existingVideo.notes); // Different -> Show, Identical -> Hide
        });

        // Find existing videos that are NOT in the import (will be deleted on replace)
        const videosToDelete: StoredVideoData[] = [];
        existingAllNotesMap.forEach((video, videoId) => {
            if (!importedVideoIds.has(videoId)) {
                videosToDelete.push(video);
            }
        });

        // ========== NO CHANGES AT ALL: Show simple "up to date" message ==========
        if (displayedImportedNotes.length === 0 && videosToDelete.length === 0) {
            // Show a simple "everything is up to date" message
            const upToDateContainer = document.createElement('div');
            upToDateContainer.className = "import-up-to-date-container";
            upToDateContainer.style.cssText = "text-align: center; padding: 40px 20px;";

            const iconWrapper = document.createElement('div');
            iconWrapper.style.cssText = "width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);";
            const icon = document.createElement('span');
            icon.className = "material-icons";
            icon.style.cssText = "font-size: 32px; color: white;";
            icon.textContent = "check_circle";
            iconWrapper.appendChild(icon);

            const message = document.createElement('p');
            message.style.cssText = "font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 8px 0;";
            message.textContent = languageService.translate("allUpToDate") || "Everything is up to date!";

            const subMessage = document.createElement('p');
            subMessage.style.cssText = "font-size: 14px; color: var(--color-text-secondary); margin: 0;";
            subMessage.textContent = languageService.translate("noChangesNeededVideos") || "The imported videos match your existing data exactly.";

            upToDateContainer.append(iconWrapper, message, subMessage);
            contentElement.appendChild(upToDateContainer);

            // Change apply button to just "OK"
            const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
            if (applyButton) {
                applyButton.textContent = languageService.translate("okButton") || "OK";
                applyButton.onclick = () => {
                    const finalDecisions: ImportDecision[] = importedAllNotes.map(v => ({
                        videoId: v.videoId,
                        action: 'merge' as const,
                        notes: v.notes
                    }));
                    closeManager(finalDecisions);
                };
            }

            // Hide cancel button
            const cancelButton = document.querySelector('.import-decision-footer .btn--default') as HTMLElement;
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }

            return;
        }

        // ========== NO NEW CONTENT (even if import is subset) ==========
        // If there are NO new/updated videos, show "up to date" message
        if (displayedImportedNotes.length === 0) {
            // Show "everything is up to date" message
            const upToDateContainer = document.createElement('div');
            upToDateContainer.className = "import-up-to-date-container";
            upToDateContainer.style.cssText = "text-align: center; padding: 40px 20px;";

            const iconWrapper = document.createElement('div');
            iconWrapper.style.cssText = "width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);";
            const icon = document.createElement('span');
            icon.className = "material-icons";
            icon.style.cssText = "font-size: 32px; color: white;";
            icon.textContent = "check_circle";
            iconWrapper.appendChild(icon);

            const message = document.createElement('p');
            message.style.cssText = "font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 8px 0;";
            message.textContent = languageService.translate("allUpToDate") || "Everything is up to date!";

            const subMessage = document.createElement('p');
            subMessage.style.cssText = "font-size: 14px; color: var(--color-text-secondary); margin: 0;";
            subMessage.textContent = languageService.translate("noChangesNeededVideos") || "The imported videos match your existing data exactly.";

            upToDateContainer.append(iconWrapper, message, subMessage);
            contentElement.appendChild(upToDateContainer);

            // Change apply button to just "OK"
            const applyButton = document.querySelector('#import-decision-apply-button') as HTMLElement;
            if (applyButton) {
                applyButton.textContent = languageService.translate("okButton") || "OK";
                applyButton.onclick = () => {
                    const finalDecisions: ImportDecision[] = importedAllNotes.map(v => ({
                        videoId: v.videoId,
                        action: 'merge' as const,
                        notes: v.notes
                    }));
                    closeManager(finalDecisions);
                };
            }

            // Hide cancel button
            const cancelButton = document.querySelector('.import-decision-footer .btn--default') as HTMLElement;
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }

            return;
        }

        // From here, we have new content to show
        // Calculate which are NEW videos vs UPDATES
        const newVideos = displayedImportedNotes.filter(v => !existingAllNotesMap.has(v.videoId));
        const hasNewVideos = newVideos.length > 0;

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

        // Only show merge checkbox if there are NEW videos
        // If only updates, merge/replace doesn't apply
        if (hasNewVideos) {
            contentElement.appendChild(mergeCheckboxWrapper);
        }

        // Warning message (shown when merge is disabled)
        const warningMessage = document.createElement('div');
        warningMessage.className = "import-warning-message";
        warningMessage.innerHTML = `⚠️ ${languageService.translate("replaceWarning") || "Warning: Videos below will be DELETED when merge is disabled!"}`;
        warningMessage.style.display = 'none';
        contentElement.appendChild(warningMessage);

        // === IMPORTED VIDEOS SECTION ===
        if (displayedImportedNotes.length > 0) {
            const importedSection = document.createElement('div');
            importedSection.className = "import-section";

            const importedHeader = document.createElement('h4');
            importedHeader.className = "import-section-header";
            importedHeader.textContent = `📥 ${languageService.translate("importedVideos") || "Imported Videos"} (${displayedImportedNotes.length})`;
            importedSection.appendChild(importedHeader);

            const importedListContainer = document.createElement('div');
            importedListContainer.className = "import-video-list imported-list";

            displayedImportedNotes.forEach(importedVideo => {
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
        }
        // Note: If displayedImportedNotes is empty, we handled it earlier with "up to date" message

        // === EXISTING VIDEOS SECTION ===
        // Only show if there are NEW videos being added
        // If only updates, we're not changing the video count, so no need for merge/delete options
        let existingSection: HTMLElement | null = null;
        let existingListContainer: HTMLElement | null = null;

        if (videosToDelete.length > 0 && hasNewVideos) {
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
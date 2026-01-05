import { supabaseService } from '../src/services/SupabaseService';
import { storageAdapter } from '../src/storage/StorageAdapter';

export default defineBackground(() => {
    // 1. YouTube Video Data Loader
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
            const urlParams = new URL(tab.url).searchParams;
            const videoId = urlParams.get("v");

            if (videoId) {
                chrome.tabs.sendMessage(tabId, {
                    type: "LOAD_VIDEO_DATA",
                    videoId: videoId
                }).catch(err => {
                    // Content script might not be ready, this is safe to ignore usually
                });
            }
        }
    });

    // 2. Initial Cloud Sync on Install/Update
    chrome.runtime.onInstalled.addListener(async (details) => {
        if (details.reason === "install" || details.reason === "update") {
            console.log(`Extension ${details.reason} detected. Starting background cloud sync...`);
            try {
                await storageAdapter.initialize();
                if (supabaseService.isAvailable()) {
                    console.log("Background: Fetching all videos from cloud...");
                    const cloudVideos = await supabaseService.loadAllVideos();
                    if (cloudVideos) {
                        console.log(`Background: Synced ${cloudVideos.length} videos from cloud.`);
                        // StorageAdapter handles merging internally in loadAllVideos, 
                        // but we can explicitly save them to local to be sure
                        for (const video of cloudVideos) {
                            await chrome.storage.local.set({ [`notes_${video.videoId}`]: video });
                        }
                        console.log("Background: Cloud data cached locally.");
                    }

                    console.log("Background: Syncing settings...");
                    const cloudSettings = await supabaseService.loadSettings();
                    if (cloudSettings) {
                        await chrome.storage.local.set({ 'userSettings': cloudSettings });
                        console.log("Background: Settings cached locally.");
                    }
                }
            } catch (error) {
                console.error("Background sync failed:", error);
            }
        }
    });

    // 3. Async Message Handler (The FIX for "Message send error")
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        if (request.type === "VIDEO_OPEN") {
            const videoId = request.videoId;
            const tabId = sender.tab ? sender.tab.id : undefined;

            // Perform the async operation
            chrome.storage.local.set({
                pendingVideoId: videoId,
                targetTabId: tabId
            }).then(() => {
                // ✅ Send response AFTER operation finishes
                sendResponse({ success: true });
            }).catch((error) => {
                sendResponse({ success: false, error: error.message });
            });

            // ✅ Tell Chrome we will respond asynchronously
            return true;
        } else if (request.type === "RELOAD_TAB") { // New message type
            if (sender.tab && sender.tab.id) {
                chrome.tabs.reload(sender.tab.id);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: "No tab ID found for reload." });
            }
            return true; // Indicate async response
        }

        // For synchronous messages
        return false;
    });
});
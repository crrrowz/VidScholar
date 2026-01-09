import { supabaseService } from '../src/services/SupabaseService';
import { storageAdapter } from '../src/storage/StorageAdapter';

export default defineBackground(() => {
    // 🔑 Store Chrome User ID on startup for content scripts to access
    const storeChomeUserId = () => {
        try {
            chrome.identity.getProfileUserInfo((userInfo) => {
                if (userInfo && userInfo.id) {
                    chrome.storage.sync.set({
                        __chrome_user_id__: userInfo.id,
                        __chrome_user_email__: userInfo.email || ''
                    });
                } else {
                    chrome.storage.sync.remove(['__chrome_user_id__', '__chrome_user_email__']);
                }
            });
        } catch (error) {
            // Silently fail - device ID will be used as fallback
        }
    };

    // Store Chrome User ID immediately on startup
    storeChomeUserId();

    // 1. YouTube Video Data Loader
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
            const urlParams = new URL(tab.url).searchParams;
            const videoId = urlParams.get("v");

            if (videoId) {
                chrome.tabs.sendMessage(tabId, {
                    type: "LOAD_VIDEO_DATA",
                    videoId: videoId
                }).catch(() => {
                    // Content script might not be ready, this is safe to ignore usually
                });
            }
        }
    });

    // 2. Initial Cloud Sync on Install/Update
    chrome.runtime.onInstalled.addListener(async (details) => {
        // Re-check Chrome User ID on install/update
        storeChomeUserId();

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
        } else if (request.type === "GET_CHROME_USER_ID") {
            // 🔑 Get Chrome Profile User ID from background script
            console.log('[Background] GET_CHROME_USER_ID request received');

            chrome.identity.getProfileUserInfo((userInfo) => {
                console.log('[Background] getProfileUserInfo result:');
                console.log('[Background] - lastError:', chrome.runtime.lastError);
                console.log('[Background] - userInfo:', JSON.stringify(userInfo, null, 2));
                console.log('[Background] - id:', userInfo?.id);
                console.log('[Background] - email:', userInfo?.email);

                if (chrome.runtime.lastError) {
                    console.error('[Background] Identity error:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message, userId: null });
                } else if (userInfo && userInfo.id) {
                    console.log('[Background] ✅ Chrome Profile ID found:', userInfo.id);
                    sendResponse({ success: true, userId: userInfo.id, email: userInfo.email });
                } else {
                    console.log('[Background] ⚠️ User not signed in or ID empty');
                    sendResponse({ success: false, error: 'User not signed in Chrome', userId: null });
                }
            });
            return true; // Async response
        }

        // For synchronous messages
        return false;
    });
});
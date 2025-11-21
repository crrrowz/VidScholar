// entrypoints/background.ts
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

  // 2. Async Message Handler (The FIX for "Message send error")
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
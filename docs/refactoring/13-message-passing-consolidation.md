# 13 - Message Passing Architecture Consolidation

## 🎯 Zone Definition

### What This Zone Represents
The **Message Passing Zone** encompasses all inter-context communication:
- **Content Script ↔ Background Script** messaging
- **Cross-tab synchronization** signals
- **Extension event broadcasting**

Currently, message types are **scattered strings** without type safety, and message handlers are **inline anonymous functions** without centralization.

### How It Emerged
Messages were added as needed:
1. `VIDEO_OPEN` - for tracking video opens
2. `LOAD_VIDEO_DATA` - for background → content communication
3. `RELOAD_TAB` - for forcing tab refresh
4. `NOTES_UPDATED_GLOBALLY` - for import sync

Each message was added inline where needed, without a message type registry.

---

## 📊 Evidence From Code

### 1. Untyped Message Strings

```typescript
// background.ts - Lines 55-84
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "VIDEO_OPEN") {
    // ...
  } else if (request.type === "RELOAD_TAB") {
    // ...
  }
  return false;
});

// content.ts
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "LOAD_VIDEO_DATA") {
    // ...
  }
});

// ShareService.ts - Line 407
chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' }).catch(...);
```

**Problem**: No TypeScript enforcement of message types or payloads.

### 2. Inconsistent Response Handling

```typescript
// background.ts - Lines 60-72
if (request.type === "VIDEO_OPEN") {
  chrome.storage.local.set({...}).then(() => {
    sendResponse({ success: true });  // Uses sendResponse
  });
  return true;  // Async response
}

// background.ts - Lines 74-81
else if (request.type === "RELOAD_TAB") {
  chrome.tabs.reload(sender.tab.id);
  sendResponse({ success: true });  // Sync response
  return true;  // But still returns true?
}
```

Some handlers use async response, some sync, with inconsistent `return true/false`.

### 3. Fire-and-Forget Without Error Handling

```typescript
// background.ts - Lines 11-17
chrome.tabs.sendMessage(tabId, {
  type: "LOAD_VIDEO_DATA",
  videoId: videoId
}).catch(err => {
  // Content script might not be ready, this is safe to ignore usually
});
```

Silent `.catch()` hides failures.

### 4. No Message Type Registry

Messages are defined implicitly:
- `VIDEO_OPEN` - defined by usage in content.ts, handled in background.ts
- `LOAD_VIDEO_DATA` - defined in background.ts, handled in content.ts
- `NOTES_UPDATED_GLOBALLY` - defined in ShareService.ts, handler unknown
- `RELOAD_TAB` - defined inline, handled in background.ts

**No single source of truth** for what messages exist.

---

## ⚠️ Current Problems

### Problem 1: No Compile-Time Safety
```typescript
// Typo goes unnoticed:
chrome.runtime.sendMessage({ type: 'VIDOE_OPEN' });  // Typo!
// No TypeScript error, silent failure
```

### Problem 2: Missing Handler for Global Note Update
```typescript
// ShareService.ts
chrome.runtime.sendMessage({ type: 'NOTES_UPDATED_GLOBALLY' });

// Where is this handled?
// Searching codebase: NO HANDLER FOUND
// The message is sent but nothing listens!
```

### Problem 3: Tab ID Context Loss
```typescript
// background.ts
const tabId = sender.tab ? sender.tab.id : undefined;
chrome.storage.local.set({
  pendingVideoId: videoId,
  targetTabId: tabId  // Stored in storage, not used later
});
```

`targetTabId` is stored but never read - dead code or missing feature.

### Problem 4: No Request/Response Typing
```typescript
// Caller sends:
chrome.runtime.sendMessage({ type: 'VIDEO_OPEN', videoId: '...' });

// Handler expects:
const videoId = request.videoId;  // Untyped, could be undefined

// Response shape:
sendResponse({ success: true });  // Also untyped
```

---

## 🔧 Unification & Merge Opportunities

### Opportunity 1: Message Type Registry
```typescript
type MessageTypes = {
  VIDEO_OPEN: { videoId: string };
  LOAD_VIDEO_DATA: { videoId: string };
  RELOAD_TAB: {};
  NOTES_UPDATED_GLOBALLY: {};
};
```

### Opportunity 2: Type-Safe Message Helpers
```typescript
function sendToBackground<T extends keyof MessageTypes>(
  type: T,
  payload: MessageTypes[T]
): Promise<ResponseType<T>>;
```

### Opportunity 3: Centralized Message Router
```typescript
class MessageRouter {
  static handle<T>(type: MessageType, handler: Handler<T>): void;
  static send<T>(type: MessageType, payload: T): Promise<Response>;
}
```

---

## 🏗️ Proposed Target Shape

### After Refactoring

```
src/
├── messaging/
│   ├── MessageTypes.ts    # Type definitions
│   ├── MessageBus.ts      # Centralized send/receive
│   └── handlers/
│       ├── BackgroundHandlers.ts
│       └── ContentHandlers.ts
```

### Key Interfaces

```typescript
// MessageTypes.ts
export const MessageTypes = {
  // Background → Content
  LOAD_VIDEO_DATA: 'LOAD_VIDEO_DATA',
  
  // Content → Background
  VIDEO_OPEN: 'VIDEO_OPEN',
  RELOAD_TAB: 'RELOAD_TAB',
  
  // Broadcast
  NOTES_UPDATED_GLOBALLY: 'NOTES_UPDATED_GLOBALLY',
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

// Payload type map
export interface MessagePayloads {
  [MessageTypes.VIDEO_OPEN]: { videoId: string };
  [MessageTypes.LOAD_VIDEO_DATA]: { videoId: string };
  [MessageTypes.RELOAD_TAB]: undefined;
  [MessageTypes.NOTES_UPDATED_GLOBALLY]: undefined;
}

// Response type map
export interface MessageResponses {
  [MessageTypes.VIDEO_OPEN]: { success: boolean };
  [MessageTypes.RELOAD_TAB]: { success: boolean };
  // Others return void
}

// MessageBus.ts
export class MessageBus {
  private static handlers = new Map<MessageType, Handler>();
  
  static on<T extends MessageType>(
    type: T,
    handler: (
      payload: MessagePayloads[T],
      sender: chrome.runtime.MessageSender
    ) => Promise<MessageResponses[T]> | MessageResponses[T]
  ): void {
    this.handlers.set(type, handler);
  }
  
  static async send<T extends MessageType>(
    type: T,
    payload: MessagePayloads[T]
  ): Promise<MessageResponses[T] | undefined> {
    return chrome.runtime.sendMessage({ type, ...payload });
  }
  
  static async sendToTab<T extends MessageType>(
    tabId: number,
    type: T,
    payload: MessagePayloads[T]
  ): Promise<MessageResponses[T] | undefined> {
    return chrome.tabs.sendMessage(tabId, { type, ...payload });
  }
  
  static startListening(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = this.handlers.get(message.type);
      if (handler) {
        const result = handler(message, sender);
        if (result instanceof Promise) {
          result.then(sendResponse);
          return true;  // Async
        }
        sendResponse(result);
      }
      return false;
    });
  }
}
```

### Usage After Refactoring

```typescript
// BackgroundHandlers.ts
export function registerBackgroundHandlers(): void {
  MessageBus.on(MessageTypes.VIDEO_OPEN, async (payload) => {
    await chrome.storage.local.set({
      pendingVideoId: payload.videoId
    });
    return { success: true };
  });
  
  MessageBus.on(MessageTypes.RELOAD_TAB, async (_, sender) => {
    if (sender.tab?.id) {
      await chrome.tabs.reload(sender.tab.id);
      return { success: true };
    }
    return { success: false };
  });
}

// ContentHandlers.ts
export function registerContentHandlers(): void {
  MessageBus.on(MessageTypes.LOAD_VIDEO_DATA, async (payload) => {
    const videoId = payload.videoId;
    // Load video data...
  });
  
  MessageBus.on(MessageTypes.NOTES_UPDATED_GLOBALLY, async () => {
    // Refresh notes from storage
    await noteStorage.loadNotes(true);  // forceRefresh
  });
}

// ShareService.ts - Sending messages
await MessageBus.send(MessageTypes.NOTES_UPDATED_GLOBALLY, undefined);
// TypeScript enforces correct payload type!

// content.ts - Sending to background
const result = await MessageBus.send(MessageTypes.VIDEO_OPEN, { videoId: '...' });
console.log(result.success);  // TypeScript knows the shape!
```

---

## 📋 Refactoring Plan

### Phase 1: Create Type Definitions (Low Risk)
1. Create `src/messaging/MessageTypes.ts`
2. Define all existing message types
3. Add payload and response type maps
4. **Test**: TypeScript compiles

### Phase 2: Create MessageBus (Low Risk)
1. Create `src/messaging/MessageBus.ts`
2. Implement `on()`, `send()`, `sendToTab()`
3. Implement `startListening()` router
4. **Test**: Unit tests for message bus

### Phase 3: Migrate Background Script (Medium Risk)
1. Create `src/messaging/handlers/BackgroundHandlers.ts`
2. Move handlers from `background.ts`
3. Update `background.ts` to use `MessageBus.startListening()`
4. **Test**: Background messages still work

### Phase 4: Migrate Content Script (Medium Risk)
1. Create `src/messaging/handlers/ContentHandlers.ts`
2. Move handlers from `content.ts`
3. Update `content.ts` to register handlers
4. **Test**: Content messages still work

### Phase 5: Migrate Senders (Medium Risk)
1. Update `ShareService.ts` to use `MessageBus.send()`
2. Update other message senders
3. **Test**: All cross-context communication works

### Phase 6: Add Missing Handler
1. Add handler for `NOTES_UPDATED_GLOBALLY`
2. Implement actual refresh logic
3. **Test**: Import updates propagate to open tabs

---

## ⚠️ Risk & Validation Notes

### High Risk Areas
1. **Async response handling** - Must preserve `return true` pattern
2. **Sender context** - Must preserve `sender.tab` access
3. **Error propagation** - Must handle message failures

### Validation Checklist
- [ ] Open video → VIDEO_OPEN sent to background
- [ ] Background sends → LOAD_VIDEO_DATA to content
- [ ] Import notes → NOTES_UPDATED_GLOBALLY broadcasts
- [ ] Request RELOAD_TAB → tab refreshes
- [ ] Content script not ready → graceful failure

### TypeScript Benefits
After migration, these become **compile-time errors**:
```typescript
// Typo in message type:
MessageBus.send('VIDOE_OPEN', {});  // ❌ Error!

// Wrong payload type:
MessageBus.send(MessageTypes.VIDEO_OPEN, { id: '...' });  // ❌ Error!

// Missing payload:
MessageBus.send(MessageTypes.VIDEO_OPEN);  // ❌ Error!
```

---

## 📈 Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Message type locations | 4+ files | 1 file | -75% |
| Type safety | None | Full | 100% coverage |
| Missing handlers | 1+ | 0 | Discoverable |
| Boilerplate per message | ~10 lines | ~3 lines | -70% |
| Handler registration | Scattered | Centralized | Single registry |

---

*Last updated: 2026-01-08*

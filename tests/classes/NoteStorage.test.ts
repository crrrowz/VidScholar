// tests/classes/NoteStorage.test.ts
import { NoteStorage } from '../../src/classes/NoteStorage';
import type { Note, StoredVideoData, Video } from '../../src/types';
import { actions } from '../../src/state/actions';

// Mock chrome.storage.sync
const chromeStorageMock = (() => {
  let store: { [key: string]: any } = {};
  return {
    sync: {
      get: jest.fn(async (keys?: string | string[] | null) => {
        if (keys === null) {
          return Promise.resolve(store);
        }
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: store[keys] });
        }
        if (Array.isArray(keys)) {
          const result: { [key: string]: any } = {};
          keys.forEach(key => {
            if (store[key] !== undefined) {
              result[key] = store[key];
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: jest.fn(async (items: { [key: string]: any }) => {
        store = { ...store, ...items };
        return Promise.resolve();
      }),
      remove: jest.fn(async (keys: string | string[]) => {
        const keysToRemove = Array.isArray(keys) ? keys : [keys];
        keysToRemove.forEach(key => {
          delete store[key];
        });
        return Promise.resolve();
      }),
      clear: jest.fn(async () => {
        store = {};
        return Promise.resolve();
      }),
    },
    // Mock chrome.runtime for sendMessage, though not directly used by NoteStorage.test.ts itself,
    // other modules might call it and it's good practice to mock to avoid errors.
    runtime: {
      sendMessage: jest.fn(() => Promise.resolve()),
    },
  };
})();

// Assign the mock to global.chrome
Object.defineProperty(global, 'chrome', {
  value: chromeStorageMock,
  writable: true,
});

// Mock actions.setVideoGroup as it's called by NoteStorage.loadNotes
jest.mock('../../src/state/actions', () => ({
  actions: {
    setVideoGroup: jest.fn(),
    setNotes: jest.fn(), // Mock setNotes as well, used in deleteVideo
  },
}));

// Mock utils functions used by NoteStorage
jest.mock('../../src/utils/config', () => ({
  __esModule: true,
  default: {
    getStorageConfig: jest.fn(() => ({
      cacheDuration: 300000,
      minRetentionDays: 0,
      maxRetentionDays: 365,
    })),
    getPresets: jest.fn(() => ({
      1: { templates: ['Preset 1 Template A', 'Preset 1 Template B'], name: 'Preset 1' },
    })),
    getIcons: jest.fn(() => ({})), // Add getIcons mock
  },
}));

jest.mock('../../src/utils/video', () => ({
  getCurrentVideoId: jest.fn(() => 'testVideoId'),
  getVideoTitle: jest.fn(() => 'Test Video Title'),
}));

jest.mock('../../src/utils/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../../src/services/LanguageService', () => ({
  languageService: {
    translate: jest.fn((key: string, defaultText?: string) => defaultText || key),
    getCurrentDirection: jest.fn(() => 'ltr'),
    addDirectionListener: jest.fn(),
    removeDirectionListener: jest.fn(),
  },
}));


describe('NoteStorage', () => {
  let noteStorage: NoteStorage;

  beforeEach(async () => {
    // Clear the mock store before each test
    await chromeStorageMock.sync.clear();
    // Reset mocks
    jest.clearAllMocks();

    noteStorage = new NoteStorage();
    // Ensure NoteStorage is initialized
    await noteStorage.initialize();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should save and load notes for a video', async () => {
    const videoId = 'video1';
    const notes: Note[] = [{ timestamp: '00:05', timestampInSeconds: 5, text: 'First note' }];
    await noteStorage.saveNotes(notes, null, videoId);

    const loadedNotes = await noteStorage.loadNotes();
    expect(loadedNotes).toEqual(notes);

    const storedData = await chromeStorageMock.sync.get(`notes_${videoId}`);
    expect(storedData[`notes_${videoId}`].notes).toEqual(notes);
  });

  it('should load saved videos including those with notes', async () => {
    const videoId1 = 'videoA';
    const notes1: Note[] = [{ timestamp: '00:10', timestampInSeconds: 10, text: 'Note A' }];
    const videoData1: StoredVideoData = {
      videoId: videoId1,
      videoTitle: 'Video A Title',
      notes: notes1,
      lastModified: Date.now(),
      group: 'Group1',
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId1}`]: videoData1 });

    const videoId2 = 'videoB';
    const notes2: Note[] = [{ timestamp: '00:20', timestampInSeconds: 20, text: 'Note B' }];
    const videoData2: StoredVideoData = {
      videoId: videoId2,
      videoTitle: 'Video B Title',
      notes: notes2,
      lastModified: Date.now() - 1000, // Older
      group: null,
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId2}`]: videoData2 });

    const loadedVideos = await noteStorage.loadSavedVideos();

    expect(loadedVideos).toHaveLength(2);
    expect(loadedVideos[0].id).toBe(videoId1); // Sorted by lastModified
    expect(loadedVideos[0].notes).toEqual(notes1);
    expect(loadedVideos[1].id).toBe(videoId2);
    expect(loadedVideos[1].notes).toEqual(notes2);
  });

  it('should load saved videos even if they have no notes (after fix)', async () => {
    const videoId1 = 'videoC';
    const notes1: Note[] = []; // No notes
    const videoData1: StoredVideoData = {
      videoId: videoId1,
      videoTitle: 'Video C Title',
      notes: notes1,
      lastModified: Date.now(),
      group: 'GroupX',
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId1}`]: videoData1 });

    const videoId2 = 'videoD';
    const notes2: Note[] = [{ timestamp: '00:30', timestampInSeconds: 30, text: 'Note D' }];
    const videoData2: StoredVideoData = {
      videoId: videoId2,
      videoTitle: 'Video D Title',
      notes: notes2,
      lastModified: Date.now() - 500,
      group: null,
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId2}`]: videoData2 });

    const loadedVideos = await noteStorage.loadSavedVideos();

    expect(loadedVideos).toHaveLength(2);
    expect(loadedVideos[0].id).toBe(videoId1); // Sorted by lastModified
    expect(loadedVideos[0].notes).toEqual([]); // Should still have an empty array
    expect(loadedVideos[1].id).toBe(videoId2);
    expect(loadedVideos[1].notes).toEqual(notes2);

    // Ensure the video with no notes was NOT removed from storage
    const storedData = await chromeStorageMock.sync.get(`notes_${videoId1}`);
    expect(storedData[`notes_${videoId1}`]).toBeDefined();
    expect(storedData[`notes_${videoId1}`].notes).toEqual([]);
  });

  it('should not remove videos from storage if they initially have no notes after loading', async () => {
    const videoId = 'videoE';
    const videoData: StoredVideoData = {
      videoId: videoId,
      videoTitle: 'Video E Title',
      notes: [], // Initially no notes
      lastModified: Date.now(),
      group: null,
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId}`]: videoData });

    const initialStoredData = await chromeStorageMock.sync.get(`notes_${videoId}`);
    expect(initialStoredData[`notes_${videoId}`]).toBeDefined();

    const loadedVideos = await noteStorage.loadSavedVideos();
    expect(loadedVideos).toHaveLength(1);
    expect(loadedVideos[0].id).toBe(videoId);
    expect(loadedVideos[0].notes).toEqual([]);

    // Check again to ensure it was not removed during loadSavedVideos
    const finalStoredData = await chromeStorageMock.sync.get(`notes_${videoId}`);
    expect(finalStoredData[`notes_${videoId}`]).toBeDefined();
  });

  it('should remove videos from storage if they exceed retention days', async () => {
    jest.useFakeTimers();
    const videoId = 'oldVideo';
    const notes: Note[] = [{ timestamp: '00:01', timestampInSeconds: 1, text: 'Old note' }];
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000) - 1000; // Just over 3 days ago

    const videoData: StoredVideoData = {
      videoId: videoId,
      videoTitle: 'Old Video Title',
      notes: notes,
      lastModified: threeDaysAgo,
      group: null,
    };
    await chromeStorageMock.sync.set({ [`notes_${videoId}`]: videoData });

    // Set retention to 3 days
    await noteStorage.setRetentionDays(3);

    // Advance timers past retention
    jest.advanceTimersByTime(4 * 24 * 60 * 60 * 1000); 

    const loadedVideos = await noteStorage.loadSavedVideos();
    expect(loadedVideos).toHaveLength(0);

    const storedData = await chromeStorageMock.sync.get(`notes_${videoId}`);
    expect(storedData[`notes_${videoId}`]).toBeUndefined();
  });

  it('should save and load videos with notes assigned to no group', async () => {
    const videoId = 'videoWithNoGroupNotes';
    const notes: Note[] = [{ timestamp: '00:01', timestampInSeconds: 1, text: 'No group note 1' }];
    const videoTitle = 'Test Video Title'; // Using mocked video title

    // Simulate saving notes for a video with no group
    // This will use the mocked getCurrentVideoId() which returns 'testVideoId'
    // and getVideoTitle() which returns 'Test Video Title'
    // We are overriding videoId here to 'videoWithNoGroupNotes' for this specific test
    await noteStorage.saveNotes(notes, null, videoId);

    // Verify it's saved in storage correctly (group should be undefined)
    const storedData = await chromeStorageMock.sync.get(`notes_${videoId}`);
    expect(storedData[`notes_${videoId}`]).toBeDefined();
    expect(storedData[`notes_${videoId}`].notes).toEqual(notes);
    expect(storedData[`notes_${videoId}`].group).toBeUndefined();
    expect(storedData[`notes_${videoId}`].videoTitle).toBe(videoTitle);

    // Simulate loading all saved videos
    const loadedVideos = await noteStorage.loadSavedVideos();

    // Find the specific video
    const targetVideo = loadedVideos.find(v => v.id === videoId);

    // Assert that the video is found and its notes are correct
    expect(targetVideo).toBeDefined();
    expect(targetVideo?.notes).toEqual(notes);
    expect(targetVideo?.group).toBeUndefined(); // Ensure group is still undefined
  });
});


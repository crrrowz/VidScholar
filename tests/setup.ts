// tests/setup.ts
import '@testing-library/jest-dom';

// Mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.()),
      remove: jest.fn((keys, callback) => callback?.()),
      clear: jest.fn((callback) => callback?.())
    },
    sync: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.())
    }
  },
  runtime: {
    lastError: undefined,
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  }
} as any;

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      digest: jest.fn(),
      importKey: jest.fn(),
      deriveKey: jest.fn()
    }
  }
});

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
};
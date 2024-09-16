// websocketAdapter.js
import WebSocket from 'ws';

if (typeof window === 'undefined') {
  global.WebSocket = WebSocket;
}

// Simulate the window object if it doesn't exist
if (typeof window === 'undefined') {
  global.window = {
    WebSocket: WebSocket,
    // Add any other browser APIs you're using in your main app
  };
}

// If you're using any browser-specific APIs like localStorage, you can mock them here
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: (key) => {
      // Implement a simple in-memory storage
      if (!global.localStorage.storage) global.localStorage.storage = {};
      return global.localStorage.storage[key] || null;
    },
    setItem: (key, value) => {
      if (!global.localStorage.storage) global.localStorage.storage = {};
      global.localStorage.storage[key] = value;
    },
    removeItem: (key) => {
      if (!global.localStorage.storage) return;
      delete global.localStorage.storage[key];
    },
    clear: () => {
      global.localStorage.storage = {};
    }
  };
}

// Add any other browser APIs or global objects you need to mock here
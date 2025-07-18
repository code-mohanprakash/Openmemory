/**
 * Production Configuration for LocalBrain Extension
 */

const CONFIG = {
  // Environment
  ENVIRONMENT: 'production', // 'development' | 'staging' | 'production'
  
  // Debug settings
  DEBUG: false,
  VERBOSE_LOGGING: false,
  
  // Performance settings
  MEMORY_PROCESSING_DELAY: 2000, // ms - delay before processing messages
  MAX_CONCURRENT_OPERATIONS: 3,
  BATCH_SIZE: 10,
  
  // Memory settings
  MAX_MEMORY_SIZE: 100000, // characters
  MAX_MEMORIES_PER_SESSION: 50,
  MAX_TOTAL_MEMORIES: 1000,
  MEMORY_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  // Notification settings
  MAX_NOTIFICATIONS: 2,
  NOTIFICATION_COOLDOWN: 3000, // ms
  DEFAULT_NOTIFICATION_DURATION: 3000, // ms
  
  // Search and relevance
  DEFAULT_RELEVANCE_THRESHOLD: 0.3,
  MAX_SEARCH_RESULTS: 10,
  MIN_CONTENT_LENGTH: 20,
  
  // Platform-specific settings
  PLATFORMS: {
    chatgpt: {
      selectors: {
        userMessage: '[data-message-author-role="user"]',
        assistantMessage: '[data-message-author-role="assistant"]',
        messageContainer: '[data-testid="conversation-turn"]',
        inputField: 'textarea[data-id="root"]',
        sendButton: 'button[data-testid="send-button"]'
      },
      buttonPosition: { top: '20px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '[data-message-author-role="user"]',
        '[data-message-author-role="assistant"]',
        '.markdown'
      ]
    },
    claude: {
      selectors: {
        userMessage: '.font-user-message',
        assistantMessage: '.font-claude-message', 
        messageContainer: '.group\\/conversation-turn',
        inputField: 'textarea[placeholder*="Message"]',
        sendButton: 'button[type="submit"]'
      },
      buttonPosition: { top: '80px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '.font-user-message',
        '.font-claude-message',
        '.markdown'
      ]
    },
    perplexity: {
      selectors: {
        userMessage: '[class*="user"]',
        assistantMessage: '[class*="assistant"]',
        messageContainer: '.conversation-turn',
        inputField: 'textarea[placeholder*="Ask"]',
        sendButton: 'button[type="submit"]'
      },
      buttonPosition: { top: '100px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '[class*="user"]',
        '[class*="assistant"]',
        '.markdown'
      ]
    },
    gemini: {
      selectors: {
        userMessage: '[data-message-author="user"]',
        assistantMessage: '[data-message-author="model"]',
        messageContainer: '[data-message-container]',
        inputField: 'textarea[placeholder*="Message"]',
        sendButton: 'button[aria-label*="Send"]'
      },
      buttonPosition: { top: '20px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '[data-message-author="user"]',
        '[data-message-author="model"]',
        '.markdown'
      ]
    },
    grok: {
      selectors: {
        userMessage: '[data-testid="user-message"]',
        assistantMessage: '[data-testid="assistant-message"]',
        messageContainer: '[data-testid="message-container"]',
        inputField: 'textarea[placeholder*="Message"]',
        sendButton: 'button[type="submit"]'
      },
      buttonPosition: { top: '20px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '.markdown'
      ]
    },
    you: {
      selectors: {
        userMessage: '[class*="user-message"]',
        assistantMessage: '[class*="assistant-message"]',
        messageContainer: '[class*="message-container"]',
        inputField: 'textarea[placeholder*="Ask"]',
        sendButton: 'button[type="submit"]'
      },
      buttonPosition: { top: '20px', right: '20px' },
      observeConfig: { childList: true, subtree: true },
      fallbackSelectors: [
        '[class*="user-message"]',
        '[class*="assistant-message"]',
        '.markdown'
      ]
    }
  },
  
  // Error handling
  ERROR_HANDLING: {
    MAX_ERRORS_PER_SESSION: 10,
    ERROR_REPORTING: false, // Set to true for production telemetry
    AUTO_DISABLE_ON_ERRORS: true,
    ERROR_STORAGE_LIMIT: 50
  },
  
  // Storage settings
  STORAGE: {
    QUOTA_CHECK_INTERVAL: 60000, // 1 minute
    CLEANUP_THRESHOLD: 0.8, // Cleanup when 80% full
    COMPRESSION: true,
    ENCRYPTION: false // Future feature
  },
  
  // Security settings
  SECURITY: {
    ALLOWED_ORIGINS: [
      'https://chat.openai.com',
      'https://claude.ai',
      'https://www.perplexity.ai'
    ],
    CONTENT_FILTERING: true,
    SENSITIVE_DATA_PATTERNS: [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /password\s*[:=]\s*\S+/i, // Password
      /api[_-]?key\s*[:=]\s*\S+/i // API key
    ]
  },
  
  // Feature flags
  FEATURES: {
    AUTO_MEMORY_SAVING: true,
    SMART_SUGGESTIONS: true,
    CONVERSATION_DETECTION: true,
    KEY_FACT_EXTRACTION: true,
    MEMORY_CATEGORIES: true,
    BATCH_OPERATIONS: true,
    EXPORT_IMPORT: false, // Future feature
    CLOUD_SYNC: false // Future feature
  },
  
  // UI/UX settings
  UI: {
    THEME: 'glassmorphic',
    ANIMATIONS: true,
    COMPACT_MODE: false,
    ACCESSIBILITY: true
  },
  
  // Analytics (anonymized)
  ANALYTICS: {
    ENABLED: false,
    TRACK_USAGE: false,
    TRACK_PERFORMANCE: false,
    TRACK_ERRORS: false
  }
};

// Environment-specific overrides
if (CONFIG.ENVIRONMENT === 'development') {
  CONFIG.DEBUG = true;
  CONFIG.VERBOSE_LOGGING = true;
  CONFIG.ERROR_HANDLING.ERROR_REPORTING = false;
  CONFIG.MEMORY_PROCESSING_DELAY = 500; // Faster for development
}

if (CONFIG.ENVIRONMENT === 'staging') {
  CONFIG.DEBUG = true;
  CONFIG.VERBOSE_LOGGING = false;
  CONFIG.ERROR_HANDLING.ERROR_REPORTING = true;
  CONFIG.ANALYTICS.TRACK_ERRORS = true;
}

// Utility functions
CONFIG.utils = {
  isDebug: () => CONFIG.DEBUG,
  
  log: (...args) => {
    if (CONFIG.DEBUG || CONFIG.VERBOSE_LOGGING) {
      console.log('[LocalBrain]', ...args);
    }
  },
  
  warn: (...args) => {
    console.warn('[LocalBrain]', ...args);
  },
  
  error: (...args) => {
    console.error('[LocalBrain]', ...args);
  },
  
  getPlatformConfig: (platform) => {
    return CONFIG.PLATFORMS[platform] || CONFIG.PLATFORMS.chatgpt;
  },
  
  isFeatureEnabled: (feature) => {
    return CONFIG.FEATURES[feature] === true;
  },
  
  isSensitiveContent: (content) => {
    if (!CONFIG.SECURITY.CONTENT_FILTERING) {return false;}
    
    return CONFIG.SECURITY.SENSITIVE_DATA_PATTERNS.some(pattern => 
      pattern.test(content)
    );
  },
  
  validateOrigin: (origin) => {
    return CONFIG.SECURITY.ALLOWED_ORIGINS.includes(origin);
  },
  
  getStorageQuota: async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage,
          percentUsed: (estimate.usage / estimate.quota) * 100
        };
      }
    } catch (error) {
      CONFIG.utils.warn('Could not get storage quota:', error);
    }
    return null;
  }
};

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.PLATFORMS);
Object.freeze(CONFIG.ERROR_HANDLING);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.SECURITY);
Object.freeze(CONFIG.FEATURES);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.ANALYTICS);

// Export configuration
if (typeof window !== 'undefined') {
  window.LocalBrain_CONFIG = CONFIG;
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = CONFIG;
}
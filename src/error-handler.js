/**
 * Production Error Handler for LocalBrain Extension
 */

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorReporting = false; // Set to true for production error reporting
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = 3;
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'Global Error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'Unhandled Promise Rejection');
      event.preventDefault(); // Prevent console logging
    });

    // Override console.error to catch logged errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args.length > 0 && args[0] instanceof Error) {
        this.handleError(args[0], 'Console Error');
      }
      originalConsoleError.apply(console, args);
    };
  }

  handleError(error, context = 'Unknown', metadata = {}) {
    this.errorCount++;

    // Create error report
    const errorReport = {
      message: error?.message || String(error),
      stack: error?.stack || 'No stack trace available',
      context,
      metadata,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      platform: this.detectPlatform(),
      errorCount: this.errorCount
    };

    // Log error locally
    this.logError(errorReport);

    // Attempt recovery for certain error types
    if (this.shouldAttemptRecovery(errorReport)) {
      this.attemptRecovery(errorReport);
    }

    // Rate limit error reporting
    if (this.errorCount <= this.maxErrors) {
      // Store error for potential reporting
      this.storeError(errorReport);
      
      // Send to background script for potential telemetry
      this.notifyBackgroundScript(errorReport);
    }

    // Disable extension if too many errors
    if (this.errorCount > this.maxErrors) {
      this.disableExtension();
    }

    return errorReport;
  }

  shouldAttemptRecovery(errorReport) {
    // Attempt recovery for specific error types
    const recoverableErrors = [
      'DOMException',
      'TypeError',
      'ReferenceError'
    ];
    
    return recoverableErrors.some(errorType => 
      errorReport.message.includes(errorType)
    ) && this.recoveryAttempts < this.maxRecoveryAttempts;
  }

  async attemptRecovery(errorReport) {
    this.recoveryAttempts++;
    console.log(`LocalBrain: Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})`);
    
    try {
      // Platform-specific recovery strategies
      const platform = this.detectPlatform();
      
      switch (platform) {
        case 'chatgpt':
          await this.recoverChatGPT();
          break;
        case 'claude':
          await this.recoverClaude();
          break;
        case 'perplexity':
          await this.recoverPerplexity();
          break;
        default:
          await this.recoverGeneric();
      }
      
      this.showErrorNotification('Extension recovered successfully', 'success', 3000);
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.showErrorNotification('Recovery failed, please refresh the page', 'error', 5000);
    }
  }

  async recoverChatGPT() {
    // ChatGPT-specific recovery
    const selectors = [
      '[data-testid="conversation-turn"]',
      '[data-message-author-role="user"]',
      '[data-message-author-role="assistant"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`LocalBrain: Found ${elements.length} elements with selector: ${selector}`);
        return true;
      }
    }
    
    throw new Error('No ChatGPT elements found');
  }

  async recoverClaude() {
    // Claude-specific recovery
    const selectors = [
      '.group\\/conversation-turn',
      '.font-user-message',
      '.font-claude-message'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`LocalBrain: Found ${elements.length} elements with selector: ${selector}`);
        return true;
      }
    }
    
    throw new Error('No Claude elements found');
  }

  async recoverPerplexity() {
    // Perplexity-specific recovery
    const selectors = [
      '.conversation-turn',
      '[class*="user"]',
      '[class*="assistant"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`LocalBrain: Found ${elements.length} elements with selector: ${selector}`);
        return true;
      }
    }
    
    throw new Error('No Perplexity elements found');
  }

  async recoverGeneric() {
    // Generic recovery - try to reinitialize components
    if (window.LocalBrainIntegration) {
      try {
        await window.LocalBrainIntegration.init();
        return true;
      } catch (error) {
        throw new Error('Generic recovery failed');
      }
    }
    
    throw new Error('No LocalBrain integration found');
  }

  logError(errorReport) {
    console.group('🚨 LocalBrain Error Report');
    console.error('Context:', errorReport.context);
    console.error('Message:', errorReport.message);
    console.error('Stack:', errorReport.stack);
    console.error('Metadata:', errorReport.metadata);
    console.error('Timestamp:', new Date(errorReport.timestamp));
    console.error('Platform:', errorReport.platform);
    console.error('Recovery Attempts:', this.recoveryAttempts);
    console.groupEnd();
  }

  async storeError(errorReport) {
    try {
      const _storageKey = `LocalBrain_error_${errorReport.timestamp}`;
      const errors = await this.getStoredErrors();
      
      // Keep only last 50 errors
      const recentErrors = errors.slice(-49);
      recentErrors.push(errorReport);
      
      await chrome.storage.local.set({
        LocalBrain_errors: recentErrors
      });
    } catch (storageError) {
      console.warn('Failed to store error report:', storageError);
    }
  }

  async getStoredErrors() {
    try {
      const result = await chrome.storage.local.get(['LocalBrain_errors']);
      return result.LocalBrain_errors || [];
    } catch (error) {
      console.warn('Failed to retrieve stored errors:', error);
      return [];
    }
  }

  notifyBackgroundScript(errorReport) {
    try {
      chrome.runtime.sendMessage({
        action: 'error_report',
        error: {
          message: errorReport.message,
          context: errorReport.context,
          timestamp: errorReport.timestamp,
          platform: errorReport.platform,
          recoveryAttempts: this.recoveryAttempts
        }
      });
    } catch (error) {
      console.warn('Failed to notify background script:', error);
    }
  }

  disableExtension() {
    console.error('🛑 LocalBrain: Too many errors detected. Disabling extension.');
    
    try {
      // Remove all extension elements from DOM
      document.querySelectorAll('[class*="LocalBrain"]').forEach(el => {
        el.remove();
      });

      // Disable global integration
      if (window.LocalBrainIntegration) {
        window.LocalBrainIntegration.isEnabled = false;
      }

      // Show user notification
      this.showErrorNotification(
        '🛑 LocalBrain disabled due to errors. Please refresh the page.',
        'error',
        10000
      );

    } catch (error) {
      console.error('Failed to disable extension cleanly:', error);
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {return 'chatgpt';}
    if (hostname.includes('claude.ai')) {return 'claude';}
    if (hostname.includes('perplexity.ai')) {return 'perplexity';}
    if (hostname.includes('gemini.google.com')) {return 'gemini';}
    if (hostname.includes('grok.x.ai')) {return 'grok';}
    if (hostname.includes('you.com')) {return 'you';}
    return 'unknown';
  }

  showErrorNotification(message, type = 'error', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `LocalBrain-notification LocalBrain-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-width: 400px;
      word-wrap: break-word;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }

  // Utility method for safely executing async operations
  async safeAsync(operation, context = 'Unknown Operation') {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
      return null;
    }
  }

  // Utility method for safely executing sync operations
  safeSync(operation, context = 'Unknown Operation', fallback = null) {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  // Get error statistics
  async getErrorStats() {
    const errors = await this.getStoredErrors();
    const last24Hours = errors.filter(error => 
      Date.now() - error.timestamp < 24 * 60 * 60 * 1000
    );

    return {
      totalErrors: errors.length,
      errorsLast24Hours: last24Hours.length,
      currentSessionErrors: this.errorCount,
      recoveryAttempts: this.recoveryAttempts,
      platformErrors: this.groupErrorsByPlatform(errors),
      contextErrors: this.groupErrorsByContext(errors)
    };
  }

  groupErrorsByPlatform(errors) {
    return errors.reduce((acc, error) => {
      acc[error.platform] = (acc[error.platform] || 0) + 1;
      return acc;
    }, {});
  }

  groupErrorsByContext(errors) {
    return errors.reduce((acc, error) => {
      acc[error.context] = (acc[error.context] || 0) + 1;
      return acc;
    }, {});
  }

  // Clear error history (for debugging)
  async clearErrorHistory() {
    try {
      await chrome.storage.local.remove(['LocalBrain_errors']);
      this.errorCount = 0;
      this.recoveryAttempts = 0;
      console.log('LocalBrain: Error history cleared');
    } catch (error) {
      console.error('Failed to clear error history:', error);
    }
  }

  // Reset recovery attempts
  resetRecoveryAttempts() {
    this.recoveryAttempts = 0;
    console.log('LocalBrain: Recovery attempts reset');
  }
}

// Create global error handler instance
if (typeof window !== 'undefined' && !window.LocalBrainErrorHandler) {
  window.LocalBrainErrorHandler = new ErrorHandler();
}


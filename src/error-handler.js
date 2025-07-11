/**
 * Production Error Handler for OpenMemory Extension
 */

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorReporting = false; // Set to true for production error reporting
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

  logError(errorReport) {
    console.group('🚨 OpenMemory Error Report');
    console.error('Context:', errorReport.context);
    console.error('Message:', errorReport.message);
    console.error('Stack:', errorReport.stack);
    console.error('Metadata:', errorReport.metadata);
    console.error('Timestamp:', new Date(errorReport.timestamp));
    console.groupEnd();
  }

  async storeError(errorReport) {
    try {
      const _storageKey = `openmemory_error_${errorReport.timestamp}`;
      const errors = await this.getStoredErrors();
      
      // Keep only last 50 errors
      const recentErrors = errors.slice(-49);
      recentErrors.push(errorReport);
      
      await chrome.storage.local.set({
        openmemory_errors: recentErrors
      });
    } catch (storageError) {
      console.warn('Failed to store error report:', storageError);
    }
  }

  async getStoredErrors() {
    try {
      const result = await chrome.storage.local.get(['openmemory_errors']);
      return result.openmemory_errors || [];
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
          platform: errorReport.platform
        }
      });
    } catch (error) {
      console.warn('Failed to notify background script:', error);
    }
  }

  disableExtension() {
    console.error('🛑 OpenMemory: Too many errors detected. Disabling extension.');
    
    try {
      // Remove all extension elements from DOM
      document.querySelectorAll('[class*="openmemory"]').forEach(el => {
        el.remove();
      });

      // Disable global integration
      if (window.openMemoryIntegration) {
        window.openMemoryIntegration.isEnabled = false;
      }

      // Show user notification
      this.showErrorNotification(
        '🛑 OpenMemory disabled due to errors. Please refresh the page.',
        'error',
        10000
      );

    } catch (error) {
      console.error('Failed to disable extension cleanly:', error);
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chat.openai.com')) {return 'chatgpt';}
    if (hostname.includes('claude.ai')) {return 'claude';}
    if (hostname.includes('perplexity.ai')) {return 'perplexity';}
    return 'unknown';
  }

  showErrorNotification(message, type = 'error', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `openmemory-notification openmemory-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
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
      await chrome.storage.local.remove(['openmemory_errors']);
      this.errorCount = 0;
      console.log('OpenMemory: Error history cleared');
    } catch (error) {
      console.error('Failed to clear error history:', error);
    }
  }
}

// Create global error handler instance
if (typeof window !== 'undefined' && !window.openMemoryErrorHandler) {
  window.openMemoryErrorHandler = new ErrorHandler();
}

// Export for testing
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = ErrorHandler;
}
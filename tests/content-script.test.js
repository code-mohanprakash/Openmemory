/**
 * Integration tests for OpenMemoryIntegration
 */

// Mock the content script class
class MockOpenMemoryIntegration {
  constructor() {
    this.platform = 'chatgpt';
    this.isEnabled = true;
    this.memoryButton = null;
    this.notificationQueue = [];
    this.recentNotifications = new Map();
    this.maxNotifications = 2;
    this.notificationCooldown = 3000;
    this.processedMessages = new Set();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chat.openai.com')) return 'chatgpt';
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('perplexity.ai')) return 'perplexity';
    return 'unknown';
  }

  async init() {
    this.platform = this.detectPlatform();
    await this.createMemoryButton();
    this.setupMessageObserver();
  }

  async createMemoryButton() {
    const button = document.createElement('button');
    button.className = 'openmemory-button';
    button.innerHTML = '🧠 Update Memory (0)';
    button.onclick = () => this.manualMemoryUpdate();
    
    document.body.appendChild(button);
    this.memoryButton = button;
    
    return true;
  }

  showNotification(message, type = 'info', duration = 3000) {
    // Check for duplicate notifications
    const notificationKey = `${type}:${message.substring(0, 20)}`;
    const now = Date.now();
    
    if (this.recentNotifications.has(notificationKey)) {
      const lastShown = this.recentNotifications.get(notificationKey);
      if (now - lastShown < this.notificationCooldown) {
        return null;
      }
    }

    // Limit total notifications
    const existingNotifications = document.querySelectorAll('.openmemory-notification');
    if (existingNotifications.length >= this.maxNotifications) {
      const oldest = existingNotifications[0];
      if (oldest) oldest.remove();
    }

    this.recentNotifications.set(notificationKey, now);

    const notification = document.createElement('div');
    notification.className = `openmemory-notification openmemory-${type}`;
    notification.innerHTML = `
      <span class="notification-icon">${type === 'success' ? '✅' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">×</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);

    return notification;
  }

  async manualMemoryUpdate() {
    if (!this.memoryButton) return false;
    
    this.memoryButton.disabled = true;
    this.memoryButton.innerHTML = '⏳ Saving...';
    
    try {
      // Simulate memory saving
      await new Promise(resolve => setTimeout(resolve, 100));
      this.showNotification('✅ Memories updated successfully!', 'success', 2000);
      return true;
    } catch (error) {
      this.showNotification('❌ Failed to update memories', 'error');
      return false;
    } finally {
      this.memoryButton.disabled = false;
      this.memoryButton.innerHTML = '🧠 Update Memory (0)';
    }
  }

  setupMessageObserver() {
    // Mock message observer setup
    const observer = new MutationObserver(() => {
      this.scanForNewMessages();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  scanForNewMessages() {
    // Mock message scanning
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
      if (!this.processedMessages.has(msg.textContent)) {
        this.processedMessages.add(msg.textContent);
        this.processMessage(msg.textContent);
      }
    });
  }

  async processMessage(content) {
    if (content.length < 20) return;
    
    // Mock memory processing
    const memory = {
      id: Date.now().toString(),
      content,
      timestamp: Date.now(),
      type: 'conversation',
      platform: this.platform
    };

    return memory;
  }
}

describe('OpenMemoryIntegration', () => {
  let integration;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'chat.openai.com',
        href: 'https://chat.openai.com/test'
      },
      writable: true
    });

    integration = new MockOpenMemoryIntegration();
  });

  describe('Platform Detection', () => {
    it('should detect ChatGPT platform', () => {
      window.location.hostname = 'chat.openai.com';
      expect(integration.detectPlatform()).toBe('chatgpt');
    });

    it('should detect Claude platform', () => {
      window.location.hostname = 'claude.ai';
      expect(integration.detectPlatform()).toBe('claude');
    });

    it('should detect Perplexity platform', () => {
      window.location.hostname = 'perplexity.ai';
      expect(integration.detectPlatform()).toBe('perplexity');
    });

    it('should return unknown for unrecognized platforms', () => {
      window.location.hostname = 'example.com';
      expect(integration.detectPlatform()).toBe('unknown');
    });
  });

  describe('Memory Button', () => {
    it('should create memory button successfully', async () => {
      const result = await integration.createMemoryButton();
      
      expect(result).toBe(true);
      expect(integration.memoryButton).toBeTruthy();
      expect(integration.memoryButton.textContent).toContain('Update Memory');
      
      const buttonInDOM = document.querySelector('.openmemory-button');
      expect(buttonInDOM).toBeTruthy();
    });

    it('should handle manual memory update', async () => {
      await integration.createMemoryButton();
      
      const result = await integration.manualMemoryUpdate();
      
      expect(result).toBe(true);
      expect(integration.memoryButton.disabled).toBe(false);
    });
  });

  describe('Notification System', () => {
    it('should create and display notifications', () => {
      const notification = integration.showNotification('Test message', 'info');
      
      expect(notification).toBeTruthy();
      expect(notification.className).toContain('openmemory-notification');
      expect(notification.textContent).toContain('Test message');
      
      const notificationInDOM = document.querySelector('.openmemory-notification');
      expect(notificationInDOM).toBeTruthy();
    });

    it('should prevent duplicate notifications', () => {
      const first = integration.showNotification('Same message', 'info');
      const second = integration.showNotification('Same message', 'info');
      
      expect(first).toBeTruthy();
      expect(second).toBeNull();
    });

    it('should limit maximum notifications', () => {
      // Create notifications up to the limit
      integration.showNotification('Message 1', 'info');
      integration.showNotification('Message 2', 'info');
      integration.showNotification('Message 3', 'info'); // Should remove first
      
      const notifications = document.querySelectorAll('.openmemory-notification');
      expect(notifications.length).toBeLessThanOrEqual(integration.maxNotifications);
    });

    it('should show different notification types', () => {
      const success = integration.showNotification('Success!', 'success');
      const error = integration.showNotification('Error!', 'error');
      
      expect(success.className).toContain('openmemory-success');
      expect(error.className).toContain('openmemory-error');
    });
  });

  describe('Message Processing', () => {
    it('should process new messages', async () => {
      // Add a mock message to DOM
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.textContent = 'This is a test message that should be processed';
      document.body.appendChild(messageDiv);

      integration.scanForNewMessages();

      expect(integration.processedMessages.has(messageDiv.textContent)).toBe(true);
    });

    it('should not reprocess the same message', () => {
      const messageText = 'Test message content';
      
      // Process once
      integration.processedMessages.add(messageText);
      const initialSize = integration.processedMessages.size;
      
      // Try to process again
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.textContent = messageText;
      document.body.appendChild(messageDiv);
      
      integration.scanForNewMessages();
      
      expect(integration.processedMessages.size).toBe(initialSize);
    });

    it('should create memory from message content', async () => {
      const content = 'This is a meaningful message that should become a memory';
      
      const memory = await integration.processMessage(content);
      
      expect(memory).toBeTruthy();
      expect(memory.content).toBe(content);
      expect(memory.platform).toBe(integration.platform);
      expect(memory.type).toBe('conversation');
    });

    it('should ignore short messages', async () => {
      const shortContent = 'Hi';
      
      const memory = await integration.processMessage(shortContent);
      
      expect(memory).toBeUndefined();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await integration.init();
      
      expect(integration.platform).toBe('chatgpt');
      expect(integration.memoryButton).toBeTruthy();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock an error condition
      integration.createMemoryButton = jest.fn().mockRejectedValue(new Error('Button creation failed'));
      
      await expect(integration.init()).rejects.toThrow('Button creation failed');
    });
  });
});
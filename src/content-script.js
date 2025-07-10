/**
 * OpenMemory Content Script
 * Automatically detects and saves key facts from AI conversations
 * Injects relevant memories when starting new conversations
 */

class OpenMemoryIntegration {
  constructor() {
    try {
      this.platform = this.detectPlatform();
      this.isEnabled = true;
      this.lastProcessedMessage = '';
      this.lastDetectedContent = null;
      this.conversationStarted = false;
      this.memoryButton = null;
      this.memoryOverlay = null;
      this.selectedMemories = new Set();
      this.processedMessages = new Set();
      this.isProcessing = false;
      this.messageObserver = null;
      this.periodicCheck = null;
      
      console.log('OpenMemory: Initializing on', this.platform);
      this.init();
    } catch (error) {
      console.error('OpenMemory: Constructor error:', error);
      throw error;
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    const path = window.location.pathname;
    
    // Enhanced platform detection with fallbacks
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
      return 'chatgpt';
    }
    if (hostname.includes('claude.ai')) {
      return 'claude';
    }
    if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) {
      return 'gemini';
    }
    if (hostname.includes('perplexity.ai')) {
      return 'perplexity';
    }
    if (hostname.includes('grok.x.ai') || hostname.includes('x.ai')) {
      return 'grok';
    }
    if (hostname.includes('you.com') && path.includes('search')) {
      return 'you';
    }
    if (hostname.includes('character.ai')) {
      return 'character';
    }
    if (hostname.includes('poe.com')) {
      return 'poe';
    }
    if (hostname.includes('huggingface.co') && path.includes('chat')) {
      return 'huggingface';
    }
    if (hostname.includes('zendesk.com') || hostname.includes('zendeskgov.com')) {
      return 'zendesk';
    }
    
    console.log('OpenMemory: Unknown platform detected:', hostname);
    return 'unknown';
  }

  async init() {
    try {
      // Wait for memory engine to be ready with timeout
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      while (!window.memoryEngine && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.memoryEngine) {
        console.error('OpenMemory: Memory engine failed to load');
        this.showNotification('Memory engine failed to load', 'error');
        return;
      }

      await window.memoryEngine.init();
      
      // Initialize components with error handling
      try {
        this.setupMessageObserver();
      } catch (error) {
        console.error('OpenMemory: Failed to setup message observer:', error);
      }

      try {
        this.injectMemoryButton();
      } catch (error) {
        console.error('OpenMemory: Failed to inject memory button:', error);
      }

      try {
        this.setupKeyboardShortcuts();
      } catch (error) {
        console.error('OpenMemory: Failed to setup keyboard shortcuts:', error);
      }

      try {
        this.setupAutoMemoryDetection();
      } catch (error) {
        console.error('OpenMemory: Failed to setup auto memory detection:', error);
      }
      
      // Auto-inject memories on new conversation
      try {
        this.checkForNewConversation();
      } catch (error) {
        console.error('OpenMemory: Failed to check for new conversation:', error);
      }
      
      console.log('OpenMemory: Ready on', this.platform);

      // Show initialization success (subtle)
      if (this.platform !== 'unknown') {
        setTimeout(() => {
          this.showNotification(`🧠 OpenMemory active on ${this.platform}`, 'info', 2000);
        }, 1000);
      }
    } catch (error) {
      console.error('OpenMemory: Initialization failed:', error);
      this.showNotification('OpenMemory initialization failed', 'error');
    }
  }

  setupMessageObserver() {
    console.log('OpenMemory: Setting up message observer for', this.platform);
    
    try {
      // Debounce function to avoid processing the same content multiple times
      let processingTimeout;
      
      const observer = new MutationObserver((mutations) => {
        try {
          clearTimeout(processingTimeout);
          processingTimeout = setTimeout(() => {
            this.scanForNewMessages();
          }, 500); // Wait 500ms after changes stop
        } catch (error) {
          console.error('OpenMemory: Error in mutation observer:', error);
        }
      });

      // Start observing the conversation area
      const conversationArea = this.getConversationArea();
      if (conversationArea) {
        console.log('OpenMemory: Found conversation area:', conversationArea);
        observer.observe(conversationArea, {
          childList: true,
          subtree: true,
          characterData: true
        });
        
        // Store observer reference for cleanup
        this.messageObserver = observer;
        
        // Also set up a periodic check as fallback
        this.periodicCheck = setInterval(() => {
          try {
            this.scanForNewMessages();
          } catch (error) {
            console.error('OpenMemory: Error in periodic check:', error);
          }
        }, 5000); // Check every 5 seconds
        
      } else {
        console.warn('OpenMemory: No conversation area found, retrying in 2 seconds...');
        // Use a more robust retry mechanism
        this.retrySetupObserver();
      }
    } catch (error) {
      console.error('OpenMemory: Error setting up message observer:', error);
    }
  }

  retrySetupObserver() {
    let retryCount = 0;
    const maxRetries = 10;
    
    const retryInterval = setInterval(() => {
      retryCount++;
      console.log(`OpenMemory: Retry attempt ${retryCount} for message observer setup`);
      
      try {
        const conversationArea = this.getConversationArea();
        if (conversationArea) {
          clearInterval(retryInterval);
          this.setupMessageObserver();
          return;
        }
      } catch (error) {
        console.error('OpenMemory: Error during retry:', error);
      }
      
      if (retryCount >= maxRetries) {
        console.error('OpenMemory: Max retries reached, giving up on message observer setup');
        clearInterval(retryInterval);
      }
    }, 2000);
  }

  // Scan for new messages in the conversation
  scanForNewMessages() {
    try {
      const messages = this.getAllMessages();
      const newMessages = messages.filter(msg => !this.processedMessages.has(msg.id));
      
      newMessages.forEach(message => {
        if (this.platform === 'zendesk') {
          // For Zendesk, we want to capture all relevant content (customer messages, agent responses, internal notes)
          if (message.content && (message.isCustomer || message.isAgent || message.isInternal || message.isTicketTitle || message.isTicketDescription)) {
            console.log('OpenMemory: Found new Zendesk content:', message.content.substring(0, 100) + '...');
            this.processNewContent(message.content);
            this.processedMessages.add(message.id);
          }
        } else if (message.isAI && message.content) {
          console.log('OpenMemory: Found new AI message:', message.content.substring(0, 100) + '...');
          this.processNewContent(message.content);
          this.processedMessages.add(message.id);
        }
      });
    } catch (error) {
      console.error('OpenMemory: Error scanning for messages:', error);
    }
  }

  // Get all messages from the conversation
  getAllMessages() {
    const messages = [];
    
    try {
      if (this.platform === 'chatgpt') {
        // ChatGPT message selectors
        const messageElements = document.querySelectorAll('[data-message-author-role]');
        messageElements.forEach((el, index) => {
          const role = el.getAttribute('data-message-author-role');
          const isAI = role === 'assistant';
          const content = el.textContent?.trim();
          
          if (content && content.length > 20) {
            messages.push({
              id: `${this.platform}-${index}-${content.substring(0, 50)}`,
              content,
              isAI,
              element: el
            });
          }
        });
      } else if (this.platform === 'claude') {
        // Claude message selectors
        const messageElements = document.querySelectorAll('.message, [data-testid*="message"]');
        messageElements.forEach((el, index) => {
          const content = el.textContent?.trim();
          const isAI = !el.querySelector('.human-message, [data-testid*="human"]');
          
          if (content && content.length > 20) {
            messages.push({
              id: `${this.platform}-${index}-${content.substring(0, 50)}`,
              content,
              isAI,
              element: el
            });
          }
        });
      } else if (this.platform === 'zendesk') {
        // Zendesk ticket conversation selectors
        const ticketEvents = document.querySelectorAll('[data-test-id="ticket-conversation-event"], .event, .comment');
        ticketEvents.forEach((el, index) => {
          const content = el.textContent?.trim();
          
          // Check if this is a customer message, agent response, or internal note
          const isCustomerMessage = el.classList.contains('customer') || 
                                   el.querySelector('.avatar-customer') ||
                                   el.querySelector('[data-test-id="customer-avatar"]');
          const isAgentResponse = el.classList.contains('agent') || 
                                 el.querySelector('.avatar-agent') ||
                                 el.querySelector('[data-test-id="agent-avatar"]');
          const isInternalNote = el.classList.contains('internal') || 
                                el.querySelector('.internal-note');
          
          if (content && content.length > 20) {
            messages.push({
              id: `${this.platform}-${index}-${content.substring(0, 50)}`,
              content,
              isAI: false, // Zendesk content is human-generated
              isCustomer: isCustomerMessage,
              isAgent: isAgentResponse,
              isInternal: isInternalNote,
              element: el
            });
          }
        });
        
        // Also capture ticket description and subject
        const ticketTitle = document.querySelector('[data-test-id="ticket-subject"], .ticket-subject, h1');
        const ticketDescription = document.querySelector('[data-test-id="ticket-description"], .ticket-description');
        
        if (ticketTitle && ticketTitle.textContent?.trim()) {
          messages.push({
            id: `${this.platform}-title-${ticketTitle.textContent.substring(0, 50)}`,
            content: `Ticket: ${ticketTitle.textContent.trim()}`,
            isAI: false,
            isTicketTitle: true,
            element: ticketTitle
          });
        }
        
        if (ticketDescription && ticketDescription.textContent?.trim()) {
          messages.push({
            id: `${this.platform}-description-${ticketDescription.textContent.substring(0, 50)}`,
            content: ticketDescription.textContent.trim(),
            isAI: false,
            isTicketDescription: true,
            element: ticketDescription
          });
        }
      } else {
        // Generic message detection
        const possibleSelectors = [
          '.message',
          '[role="message"]',
          '.chat-message',
          '.conversation-turn',
          '.response',
          '.answer'
        ];
        
        for (const selector of possibleSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach((el, index) => {
              const content = el.textContent?.trim();
              if (content && content.length > 20) {
                messages.push({
                  id: `${this.platform}-${index}-${content.substring(0, 50)}`,
                  content,
                  isAI: true, // Assume it's AI for unknown platforms
                  element: el
                });
              }
            });
            break; // Use first successful selector
          }
        }
      }
    } catch (error) {
      console.error('OpenMemory: Error getting messages:', error);
    }
    
    return messages;
  }

  getConversationArea() {
    const selectors = {
      chatgpt: '[role="main"]',
      claude: '.conversation',
      gemini: '.conversation-container',
      perplexity: '.prose',
      grok: '.conversation',
      you: '.chat-messages',
      zendesk: '[data-test-id="ticket-conversation"], .ticket-conversation, .ticket-comments, .workspace-chat'
    };

    const selector = selectors[this.platform] || '[role="main"], .conversation, .chat';
    return document.querySelector(selector);
  }

  async processNewContent(content) {
    if (this.isProcessing) return; // Prevent concurrent processing
    
    // Extract text content if element provided, otherwise use content directly
    const textContent = typeof content === 'string' ? content : content?.textContent?.trim();
    if (!textContent || textContent.length < 20) return;

    // Skip if we already processed this content
    if (textContent === this.lastProcessedMessage) return;
    this.lastProcessedMessage = textContent;

    console.log('OpenMemory: Processing new content:', textContent.substring(0, 100) + '...');
    console.log('OpenMemory: Content length:', textContent.length);

    // Store detected content for manual saving later, but don't auto-save
    if (this.looksLikeAIResponse(textContent)) {
      console.log('OpenMemory: Detected AI response, ready for manual saving');
      this.lastDetectedContent = textContent;
      // Update button to indicate new content is available
      this.updateMemoryButton();
    } else {
      console.log('OpenMemory: Content not recognized as AI response');
    }
  }

  looksLikeAIResponse(content) {
    // For Zendesk, we want to capture all customer service conversations
    if (this.platform === 'zendesk') {
      // For Zendesk, capture meaningful content (not just "Thanks" or "Hi")
      if (content.length < 20) return false;
      
      // Skip very short responses that are likely just greetings
      if (content.length < 50 && content.split(' ').length < 5) return false;
      
      // For Zendesk, most content above 50 characters is worth storing
      return content.length > 50;
    }
    
    // AI responses are typically longer and more informative
    if (content.length < 30) return false;
    
    // Skip very short responses that are likely user messages
    if (content.length < 100 && content.split(' ').length < 10) return false;
    
    // For longer content, it's likely an AI response
    if (content.length > 200) return true;
    
    // Look for characteristics of AI responses
    const aiIndicators = [
      /I can help/i,
      /Here's/i,
      /Based on/i,
      /According to/i,
      /Let me/i,
      /To answer/i,
      /The key/i,
      /Important/i,
      /However/i,
      /Additionally/i,
      /Here are/i,
      /You can/i,
      /This is/i,
      /That's/i,
      /It's/i,
      /There are/i,
      /For example/i,
      /In fact/i,
      /Actually/i,
      /Certainly/i,
      /Of course/i,
      /Sure/i,
      /Yes/i,
      /No/i
    ];

    return aiIndicators.some(pattern => pattern.test(content)) || content.length > 150;
  }

  async extractAndSaveMemories(content) {
    console.log('OpenMemory: Checking if content is worth saving...');
    if (!window.memoryEngine.isWorthSaving(content)) {
      console.log('OpenMemory: Content not worth saving');
      return;
    }

    // Show progress indicator
    const progress = this.showMemoryProgress('Processing memory...');

    try {
      console.log('OpenMemory: Content is worth saving, saving as conversation memory...');
      
      // Save the full response as a conversation memory (will be appended to existing if same topic)
      if (content.length > 50) {
        console.log('OpenMemory: Saving conversation memory');
        const memory = await window.memoryEngine.saveMemory(content, {
          type: 'conversation', 
          platform: this.platform,
          conversation_url: window.location.href
        });

        if (memory) {
          // Show success notification with memory details
          this.showNotification(
            `💭 Memory saved: ${memory.category} | ${memory.summary?.substring(0, 50) || content.substring(0, 50)}...`,
            'memory',
            4000
          );
        }
      }

      // Extract and save key facts only if they're substantial
      const keyFacts = window.memoryEngine.extractKeyFacts(content);
      console.log('OpenMemory: Extracted', keyFacts.length, 'key facts');
      
      let savedFacts = 0;
      // Save key facts as separate memories only if they're significant
      for (const fact of keyFacts) {
        if (fact.length > 30) { // Only save substantial facts
          console.log('OpenMemory: Saving fact:', fact.substring(0, 50) + '...');
          const factMemory = await window.memoryEngine.saveMemory(fact, {
            type: 'extracted_fact',
            platform: this.platform,
            conversation_url: window.location.href
          });
          if (factMemory) savedFacts++;
        }
      }

      // Show summary notification if facts were saved
      if (savedFacts > 0) {
        this.showNotification(`📝 Extracted ${savedFacts} key insights`, 'success', 2000);
      }

      // Update memory button if visible
      this.updateMemoryButton();
      
      console.log('OpenMemory: Memory extraction complete');
    } catch (error) {
      console.error('OpenMemory: Error saving memories:', error);
      this.showNotification('Failed to save memory', 'error');
    } finally {
      // Hide progress indicator
      this.hideMemoryProgress();
    }
  }

  injectMemoryButton() {
    console.log('OpenMemory: Attempting to inject memory button...');
    
    // Remove any existing button first
    const existingButton = document.getElementById('openmemory-button');
    if (existingButton) {
      existingButton.remove();
      console.log('OpenMemory: Removed existing button');
    }
    
    // Ensure we have a body element
    if (!document.body) {
      console.error('OpenMemory: No body element found, cannot inject button');
      return;
    }
    
    try {
      // Create single combined button
      const button = document.createElement('button');
      button.id = 'openmemory-button';
      button.innerHTML = '🔄 Update Memory';
      button.className = 'openmemory-button';
      button.title = 'Click: Update memories | Double-click: View all memories';
      
      // Add platform-specific styling adjustments
      button.style.cssText = `
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        z-index: 999999 !important;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 25px !important;
        padding: 12px 20px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3) !important;
        transition: all 0.3s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        user-select: none !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
      
      let clickTimeout;
      
      // Handle single click (update memories) and double click (view memories)
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (clickTimeout) {
          // Double click detected
          clearTimeout(clickTimeout);
          clickTimeout = null;
          this.showMemoryOverlay(); // Double-click opens memory view
        } else {
          // Single click - wait to see if there's a second click
          clickTimeout = setTimeout(() => {
            this.manualMemoryUpdate(); // Single click updates memories
            clickTimeout = null;
          }, 300); // 300ms delay to detect double-click
        }
      });
      
      // Add hover effects
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
        button.style.background = 'linear-gradient(135deg, #218838 0%, #1ea085 100%)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 15px rgba(40, 167, 69, 0.3)';
        button.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
      });
      
      // Add button to the page with retry logic
      const injectButton = () => {
        if (document.body && !document.getElementById('openmemory-button')) {
          document.body.appendChild(button);
          this.memoryButton = button;
          console.log('OpenMemory: Memory button successfully injected!');
          
          // Update button text with memory count
          this.updateMemoryButton();
          
          // Show confirmation notification
          setTimeout(() => {
            this.showNotification('✅ OpenMemory button loaded successfully!', 'success', 2000);
          }, 500);
          
          return true;
        }
        return false;
      };
      
      // Try to inject immediately
      if (!injectButton()) {
        // If immediate injection fails, wait for body and try again
        let attempts = 0;
        const maxAttempts = 50;
        const retryInterval = setInterval(() => {
          attempts++;
          if (injectButton() || attempts >= maxAttempts) {
            clearInterval(retryInterval);
            if (attempts >= maxAttempts) {
              console.error('OpenMemory: Failed to inject button after maximum attempts');
              this.showNotification('❌ Failed to load OpenMemory button', 'error');
            }
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('OpenMemory: Error creating memory button:', error);
      this.showNotification('❌ Failed to create memory button', 'error');
    }
  }

  async manualMemoryUpdate() {
    try {
      this.showNotification('🔍 Saving memories...', 'info', 2000);
      this.memoryButton.disabled = true;
      const originalText = this.memoryButton.innerHTML;
      this.memoryButton.innerHTML = '⏳ Saving...';
      
      let newMemoriesCount = 0;
      
      // Check if user has selected text to save as structured memory
      const selectedText = window.getSelection().toString().trim();
      if (selectedText && selectedText.length > 20) {
        console.log('OpenMemory: User selected text for memory:', selectedText.substring(0, 100) + '...');
        await this.saveSelectedTextAsStructuredMemory(selectedText);
        newMemoriesCount++;
        
        // Clear selection after saving
        window.getSelection().removeAllRanges();
      } else {
        // No selection - process conversation messages in structured format
        await this.saveConversationAsStructuredMemories();
        newMemoriesCount++;
      }
      
      // Update UI
      this.updateMemoryButton();
      
      if (newMemoriesCount > 0) {
        this.showNotification(`✅ Saved ${newMemoriesCount} new memories!`, 'success', 3000);
      } else {
        this.showNotification('✅ All memories are up to date!', 'info', 2000);
      }
      
    } catch (error) {
      console.error('OpenMemory: Manual update failed:', error);
      this.showNotification('❌ Failed to save memories', 'error');
    } finally {
      this.memoryButton.disabled = false;
      this.updateMemoryButton(); // This will restore the proper text with count
    }
  }

  // Get recent conversation content for manual scanning
  getRecentConversationContent() {
    try {
      // Try to get the most recent AI response
      if (this.platform === 'chatgpt') {
        const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMessages.length > 0) {
          const latest = assistantMessages[assistantMessages.length - 1];
          return latest.textContent?.trim();
        }
      } else if (this.platform === 'claude') {
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
          const latest = messages[messages.length - 1];
          if (!latest.querySelector('.human-message')) {
            return latest.textContent?.trim();
          }
        }
      } else {
        // Generic approach - get the last large text block
        const textNodes = document.querySelectorAll('p, div, span');
        for (let i = textNodes.length - 1; i >= 0; i--) {
          const content = textNodes[i].textContent?.trim();
          if (content && content.length > 100) {
            return content;
          }
        }
      }
    } catch (error) {
      console.error('OpenMemory: Error getting recent content:', error);
    }
    return null;
  }

  updateMemoryButton() {
    if (!this.memoryButton) return;
    
    window.memoryEngine.getMemoryStats().then(stats => {
      this.memoryButton.innerHTML = `🔄 Update Memory (${stats.total})`;
    }).catch(error => {
      console.error('OpenMemory: Failed to get memory stats:', error);
      this.memoryButton.innerHTML = '🔄 Update Memory';
    });
  }

  // Save user-selected text as a structured memory
  async saveSelectedTextAsStructuredMemory(selectedText) {
    try {
      // Try to determine if this is user input or AI output based on context
      const parentElement = window.getSelection().getRangeAt(0).commonAncestorContainer.parentElement;
      const isUserMessage = this.isUserMessage(parentElement);
      
      if (isUserMessage) {
        // This is user input - try to find the corresponding AI response
        const correspondingAI = this.findCorrespondingAIResponse(parentElement);
        if (correspondingAI) {
          await this.saveStructuredMemory(selectedText, correspondingAI);
        } else {
          // Save as user input only
          await this.saveStructuredMemory(selectedText, null);
        }
      } else {
        // This is likely AI output - try to find the corresponding user input
        const correspondingUser = this.findCorrespondingUserInput(parentElement);
        if (correspondingUser) {
          await this.saveStructuredMemory(correspondingUser, selectedText);
        } else {
          // Save as AI output only
          await this.saveStructuredMemory(null, selectedText);
        }
      }
      
      this.showNotification('✅ Structured memory saved!', 'success', 3000);
    } catch (error) {
      console.error('OpenMemory: Error saving selected text:', error);
      this.showNotification('❌ Failed to save selected text', 'error');
    }
  }

  // Save conversation messages as structured user-AI pairs
  async saveConversationAsStructuredMemories() {
    try {
      const messages = this.getAllMessages();
      const conversationPairs = this.extractConversationPairs(messages);
      
      let savedCount = 0;
      for (const pair of conversationPairs) {
        if (!this.processedMessages.has(pair.id)) {
          await this.saveStructuredMemory(pair.userInput, pair.aiOutput);
          this.processedMessages.add(pair.id);
          savedCount++;
        }
      }
      
      if (savedCount > 0) {
        this.showNotification(`✅ Saved ${savedCount} conversation pairs!`, 'success', 3000);
      } else {
        this.showNotification('✅ All conversations up to date!', 'info', 2000);
      }
    } catch (error) {
      console.error('OpenMemory: Error saving conversation:', error);
      this.showNotification('❌ Failed to save conversation', 'error');
    }
  }

  // Save memory in structured key-value format
  async saveStructuredMemory(userInput, aiOutput) {
    const structuredContent = {
      user: userInput || '[User input not captured]',
      ai_output: aiOutput || '[AI response not captured]',
      timestamp: Date.now(),
      platform: this.platform
    };

    const memory = await window.memoryEngine.saveMemory(JSON.stringify(structuredContent, null, 2), {
      type: 'structured_conversation',
      platform: this.platform,
      conversation_url: window.location.href,
      structured: true,
      userInput: userInput,
      aiOutput: aiOutput
    });

    return memory;
  }

  // Helper functions for structured memory detection
  isUserMessage(element) {
    // Platform-specific detection for user messages
    const userIndicators = {
      'chatgpt': ['user-message', 'text-base', 'user'],
      'claude': ['human', 'user-message'],
      'gemini': ['user-message', 'user'],
      'zendesk': ['user', 'customer', 'requester']
    };

    const indicators = userIndicators[this.platform] || userIndicators['chatgpt'];
    
    // Check element and its parents for user message indicators
    let current = element;
    while (current && current !== document.body) {
      const className = current.className || '';
      const role = current.getAttribute('data-message-author-role') || current.getAttribute('role') || '';
      
      if (indicators.some(indicator => 
        className.includes(indicator) || 
        role.includes(indicator) ||
        current.textContent.trim().startsWith('You:')
      )) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  findCorrespondingAIResponse(userElement) {
    // Find the next AI response after this user message
    let current = userElement;
    while (current && current.nextElementSibling) {
      current = current.nextElementSibling;
      if (!this.isUserMessage(current) && current.textContent.trim().length > 20) {
        return current.textContent.trim();
      }
    }
    return null;
  }

  findCorrespondingUserInput(aiElement) {
    // Find the previous user input before this AI response
    let current = aiElement;
    while (current && current.previousElementSibling) {
      current = current.previousElementSibling;
      if (this.isUserMessage(current) && current.textContent.trim().length > 5) {
        return current.textContent.trim();
      }
    }
    return null;
  }

  extractConversationPairs(messages) {
    const pairs = [];
    let currentUserInput = null;
    
    for (const message of messages) {
      if (!message.isAI && message.content) {
        // This is a user message
        currentUserInput = message.content;
      } else if (message.isAI && message.content && currentUserInput) {
        // This is an AI response, pair it with the last user input
        pairs.push({
          id: `${message.id}_pair`,
          userInput: currentUserInput,
          aiOutput: message.content,
          timestamp: message.timestamp || Date.now()
        });
        currentUserInput = null; // Reset for next pair
      }
    }
    
    return pairs;
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+M or Cmd+M to inject memories
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        this.injectMemories();
      }
    });
  }

  setupAutoMemoryDetection() {
    console.log('OpenMemory: Setting up automatic memory detection...');
    
    // Track current input and its content
    let currentInput = null;
    let lastContent = '';
    let typingTimer;
    let autoSuggestionsShown = false;
    
    // Monitor input fields for typing
    document.addEventListener('focusin', (e) => {
      const target = e.target;
      if (this.isInputField(target)) {
        currentInput = target;
        lastContent = this.getInputValue(target);
        autoSuggestionsShown = false;
        console.log('OpenMemory: Monitoring input field for auto-suggestions');
      }
    });
    
    // Monitor typing and detect when user pauses
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (this.isInputField(target) && target === currentInput) {
        clearTimeout(typingTimer);
        
        // Wait for user to pause typing (1.5 seconds)
        typingTimer = setTimeout(async () => {
          const currentContent = this.getInputValue(target);
          
          // Only check if content is substantial and changed
          if (currentContent.length > 10 && currentContent !== lastContent && !autoSuggestionsShown) {
            console.log('OpenMemory: Analyzing user input for relevant memories:', currentContent.substring(0, 50) + '...');
            await this.analyzeAndSuggestMemories(target, currentContent);
            autoSuggestionsShown = true;
          }
          
          lastContent = currentContent;
        }, 1500); // 1.5 second delay after user stops typing
      }
    });
    
    // Reset when user focuses away
    document.addEventListener('focusout', (e) => {
      clearTimeout(typingTimer);
      if (currentInput === e.target) {
        currentInput = null;
        autoSuggestionsShown = false;
      }
    });
  }

  isInputField(element) {
    if (!element) return false;
    
    // Check for common input fields
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT' && ['text', 'search'].includes(element.type)) return true;
    if (element.contentEditable === 'true') return true;
    
    // Platform-specific checks
    const platformSelectors = {
      'chatgpt': ['[data-testid="textbox"]', '#prompt-textarea'],
      'claude': ['[contenteditable="true"]'],
      'gemini': ['[contenteditable="true"]', '.ql-editor'],
      'perplexity': ['textarea', '[contenteditable="true"]'],
      'zendesk': ['[data-test-id="omnichannel-text-input"]', '.editor'],
      'grok': ['textarea', '[contenteditable="true"]']
    };
    
    const selectors = platformSelectors[this.platform] || [];
    return selectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  }

  getInputValue(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    if (element.contentEditable === 'true') {
      return element.textContent || '';
    }
    return '';
  }

  async analyzeAndSuggestMemories(inputElement, userQuery) {
    try {
      // Get relevant memories for the user's query
      const relevantMemories = await window.memoryEngine.getRelevantMemories(userQuery, 3);
      
      if (relevantMemories.length === 0) {
        console.log('OpenMemory: No relevant memories found for query');
        return;
      }
      
      console.log('OpenMemory: Found', relevantMemories.length, 'relevant memories for auto-suggestion');
      
      // Show auto-suggestion notification
      this.showAutoSuggestionNotification(relevantMemories, inputElement, userQuery);
      
    } catch (error) {
      console.error('OpenMemory: Error analyzing user input for memories:', error);
    }
  }

  showAutoSuggestionNotification(memories, inputElement, userQuery) {
    // Remove any existing auto-suggestion
    const existingSuggestion = document.querySelector('.openmemory-auto-suggestion');
    if (existingSuggestion) existingSuggestion.remove();
    
    // Create auto-suggestion UI
    const suggestion = document.createElement('div');
    suggestion.className = 'openmemory-auto-suggestion';
    suggestion.style.cssText = `
      position: fixed;
      top: 200px;
      right: 20px;
      width: 380px;
      background: rgba(59, 130, 246, 0.95);
      backdrop-filter: blur(15px);
      border: 1px solid rgba(147, 197, 253, 0.3);
      border-radius: 16px;
      padding: 20px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 12px 32px rgba(59, 130, 246, 0.4);
      z-index: 999999;
      animation: slideInRight 0.4s ease;
      max-height: 400px;
      overflow-y: auto;
    `;
    
    suggestion.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
        <div style="background: rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 8px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
          🧠
        </div>
        <div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">Smart Memory Assistant</div>
          <div style="font-size: 11px; opacity: 0.8;">Found ${memories.length} relevant memories from your past conversations</div>
        </div>
        <button class="auto-suggestion-close" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-left: auto;">×</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">💡 <strong>Suggestion:</strong> These memories might be helpful for your question:</div>
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 8px; font-size: 11px; font-style: italic;">"${userQuery.substring(0, 80)}${userQuery.length > 80 ? '...' : ''}"</div>
      </div>
      
      <div class="memory-previews" style="margin-bottom: 16px;">
        ${memories.map((memory, index) => `
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
            <div style="font-weight: 500; margin-bottom: 4px; color: #e0e7ff;">${memory.category || 'General'} • ${this.formatDate(memory.timestamp)}</div>
            <div style="opacity: 0.9;">${memory.summary || memory.content.substring(0, 100)}${memory.content.length > 100 ? '...' : ''}</div>
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button class="auto-inject-btn" style="flex: 1; background: rgba(34, 197, 94, 0.9); border: none; color: white; border-radius: 8px; padding: 10px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
          ✨ Auto-Include Memories
        </button>
        <button class="maybe-later-btn" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; border-radius: 8px; padding: 10px 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
          Maybe Later
        </button>
      </div>
      
      <div style="margin-top: 12px; font-size: 9px; opacity: 0.7; text-align: center;">
        💡 Tip: Disable auto-suggestions in settings if you prefer manual control
      </div>
    `;
    
    // Add event listeners
    const closeBtn = suggestion.querySelector('.auto-suggestion-close');
    const autoInjectBtn = suggestion.querySelector('.auto-inject-btn');
    const maybeLaterBtn = suggestion.querySelector('.maybe-later-btn');
    
    closeBtn.addEventListener('click', () => suggestion.remove());
    maybeLaterBtn.addEventListener('click', () => suggestion.remove());
    
    autoInjectBtn.addEventListener('click', async () => {
      // Add smooth loading state
      autoInjectBtn.innerHTML = '⏳ Including memories...';
      autoInjectBtn.disabled = true;
      
      // Auto-inject the memories
      await this.autoInjectMemories(memories, inputElement, userQuery);
      
      // Show success and remove
      autoInjectBtn.innerHTML = '✅ Memories included!';
      setTimeout(() => suggestion.remove(), 2000);
    });
    
    // Add hover effects
    autoInjectBtn.addEventListener('mouseenter', () => {
      autoInjectBtn.style.background = 'rgba(34, 197, 94, 1)';
      autoInjectBtn.style.transform = 'translateY(-1px)';
    });
    autoInjectBtn.addEventListener('mouseleave', () => {
      autoInjectBtn.style.background = 'rgba(34, 197, 94, 0.9)';
      autoInjectBtn.style.transform = 'translateY(0)';
    });
    
    document.body.appendChild(suggestion);
    
    // Auto-remove after 15 seconds if no interaction
    setTimeout(() => {
      if (document.contains(suggestion)) {
        suggestion.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => suggestion.remove(), 300);
      }
    }, 15000);
  }

  async autoInjectMemories(memories, inputElement, userQuery) {
    try {
      // Create context-aware memory injection
      const memoryContext = memories.map(memory => 
        `[From ${memory.source || 'previous conversation'} - ${this.formatDate(memory.timestamp)}]: ${memory.content}`
      ).join('\n\n');
      
      const contextualPrompt = `Context from my previous conversations that might be relevant:

${memoryContext}

Current question: ${userQuery}`;
      
      // Inject into input field
      const currentValue = this.getInputValue(inputElement);
      const newValue = currentValue + '\n\n' + contextualPrompt;
      
      this.setInputValue(inputElement, newValue);
      
      // Show success notification
      this.showNotification(`✨ Auto-included ${memories.length} relevant memories from your past conversations`, 'success', 4000);
      
      console.log('OpenMemory: Auto-injected memories successfully');
      
    } catch (error) {
      console.error('OpenMemory: Error auto-injecting memories:', error);
      this.showNotification('❌ Failed to auto-include memories', 'error');
    }
  }

  setInputValue(element, value) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
      element.textContent = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Focus and position cursor at end
    element.focus();
    if (element.setSelectionRange) {
      element.setSelectionRange(value.length, value.length);
    }
  }

  async injectMemories() {
    const input = this.getCurrentInput();
    if (!input) {
      this.showNotification('No input field found', 'error');
      return;
    }

    const currentText = this.getInputText(input);
    const relevantMemories = await window.memoryEngine.getRelevantMemories(currentText, 3);
    
    if (relevantMemories.length === 0) {
      this.showNotification('No relevant memories found', 'info');
      return;
    }

    // Format memories for injection
    const memoryText = this.formatMemoriesForInjection(relevantMemories);
    const newText = memoryText + (currentText ? '\n\n' + currentText : '');
    
    this.setInputText(input, newText);
    this.showNotification(`Injected ${relevantMemories.length} relevant memories`, 'success');
  }

  async injectSpecificMemories(memories) {
    console.log('OpenMemory: Injecting specific memories:', memories);
    const input = this.getCurrentInput();
    if (!input) {
      this.showNotification('No input field found', 'error');
      return;
    }

    if (!memories || memories.length === 0) {
      this.showNotification('No memories to inject', 'info');
      return;
    }

    const currentText = this.getInputText(input);
    const memoryText = this.formatMemoriesForInjection(memories);
    const newText = memoryText + (currentText ? '\n\n' + currentText : '');
    
    this.setInputText(input, newText);
    this.showNotification(`Injected ${memories.length} selected memories`, 'success');
  }

  formatMemoriesForInjection(memories) {
    const memoryTexts = memories.map(m => m.content).join('\n• ');
    return `[Context from my previous conversations:\n• ${memoryTexts}]\n\n`;
  }

  getCurrentInput() {
    // Platform-specific selectors for better accuracy
    const platformSelectors = {
      'chatgpt': [
        'textarea[data-id]',
        '#prompt-textarea',
        'textarea[placeholder*="message" i]',
        '.ProseMirror'
      ],
      'claude': [
        '.ProseMirror',
        'textarea[placeholder*="talk" i]',
        '[contenteditable="true"]',
        'textarea'
      ],
      'gemini': [
        'textarea[placeholder*="enter" i]',
        'textarea[aria-label*="message" i]',
        '.ql-editor',
        'textarea'
      ],
      'perplexity': [
        'textarea[placeholder*="ask" i]',
        'textarea[placeholder*="follow" i]',
        'textarea'
      ],
      'grok': [
        'textarea[placeholder*="ask" i]',
        'textarea[placeholder*="message" i]',
        'textarea'
      ]
    };

    // Try platform-specific selectors first
    const platformSpecific = platformSelectors[this.platform] || [];
    
    // Combine with generic selectors
    const allSelectors = [
      ...platformSpecific,
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="type" i]',
      'textarea[placeholder*="search" i]',
      '.ProseMirror',
      '[contenteditable="true"]',
      'textarea:not([readonly]):not([disabled])',
      'input[type="text"]:not([readonly]):not([disabled])'
    ];

    // Remove duplicates while preserving order
    const uniqueSelectors = [...new Set(allSelectors)];

    for (const selector of uniqueSelectors) {
      try {
        const input = document.querySelector(selector);
        if (input && this.isVisible(input) && this.isInteractable(input)) {
          return input;
        }
      } catch (error) {
        console.warn('OpenMemory: Invalid selector:', selector, error);
      }
    }
    
    // Fallback: find any focused input
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'TEXTAREA' || focused.tagName === 'INPUT' || focused.contentEditable === 'true')) {
      if (this.isVisible(focused) && this.isInteractable(focused)) {
        return focused;
      }
    }
    
    return null;
  }

  isInteractable(element) {
    return !element.disabled && 
           !element.readOnly && 
           element.style.display !== 'none' &&
           element.style.visibility !== 'hidden' &&
           !element.closest('[aria-hidden="true"]');
  }

  isVisible(element) {
    return element.offsetParent !== null && 
           window.getComputedStyle(element).display !== 'none';
  }

  getInputText(input) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      return input.value;
    } else if (input.contentEditable === 'true') {
      return input.textContent || input.innerText;
    }
    return '';
  }

  setInputText(input, text) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.contentEditable === 'true') {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Focus the input
    input.focus();
  }

  checkForNewConversation() {
    // Check if this is a new conversation that could benefit from memory injection
    // This happens automatically on most platforms
    setTimeout(async () => {
      if (this.platform === 'chatgpt' || this.platform === 'perplexity' || this.platform === 'gemini' || this.platform === 'grok') {
        const input = this.getCurrentInput();
        if (input && this.getInputText(input).trim().length === 0) {
          // New conversation detected - auto-inject relevant memories if available
          const recentMemories = await window.memoryEngine.getRelevantMemories('', 2);
          if (recentMemories.length > 0) {
            this.showMemoryHint(recentMemories.length);
          }
        }
      }
    }, 2000);
  }

  showMemoryHint(count) {
    const hint = document.createElement('div');
    hint.className = 'openmemory-hint';
    hint.innerHTML = `💡 I found ${count} relevant memories from your past conversations. Press Ctrl+M to include them.`;
    
    document.body.appendChild(hint);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (hint.parentNode) {
        hint.remove();
      }
    }, 5000);
  }

  showNotification(message, type = 'info', duration = 3000) {
    // Calculate vertical position based on existing notifications
    const existingNotifications = document.querySelectorAll('.openmemory-notification');
    let topOffset = this.getBaseNotificationTop();
    
    // Stack notifications vertically with 8px spacing
    existingNotifications.forEach((notif, index) => {
      const notifHeight = notif.offsetHeight || 60; // Approximate height
      topOffset += notifHeight + 8; // 8px spacing between notifications
    });
    
    const notification = document.createElement('div');
    notification.className = `openmemory-notification openmemory-${type}`;
    
    // Set dynamic top position
    notification.style.top = `${topOffset}px`;
    
    // Add icon based on type
    const icons = {
      'success': '✅',
      'error': '❌', 
      'info': 'ℹ️',
      'warning': '⚠️',
      'memory': '🧠'
    };
    
    notification.innerHTML = `
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">×</button>
    `;
    
    // Add close functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
      this.repositionNotifications();
    });
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fadeout');
        setTimeout(() => {
          notification.remove();
          this.repositionNotifications();
        }, 300);
      }
    }, duration);

    return notification;
  }

  // Get the base top position for notifications based on platform
  getBaseNotificationTop() {
    const platformOffsets = {
      'chatgpt': 140,
      'claude': 80,
      'perplexity': 100,
      'zendesk': 160,
      'default': 140
    };
    
    return platformOffsets[this.platform] || platformOffsets.default;
  }

  // Reposition all notifications after one is removed
  repositionNotifications() {
    const notifications = document.querySelectorAll('.openmemory-notification');
    let topOffset = this.getBaseNotificationTop();
    
    notifications.forEach((notif, index) => {
      notif.style.top = `${topOffset}px`;
      const notifHeight = notif.offsetHeight || 60;
      topOffset += notifHeight + 8; // 8px spacing
    });
  }

  // Show memory capture progress
  showMemoryProgress(message) {
    const existing = document.querySelector('.openmemory-progress');
    if (existing) existing.remove();

    // Calculate position below notifications
    const notifications = document.querySelectorAll('.openmemory-notification');
    let topOffset = this.getBaseNotificationTop();
    
    notifications.forEach((notif) => {
      const notifHeight = notif.offsetHeight || 60;
      topOffset += notifHeight + 8;
    });
    
    // Add some extra space for progress indicator
    topOffset += 8;

    const progress = document.createElement('div');
    progress.className = 'openmemory-progress';
    progress.style.top = `${topOffset}px`;
    progress.innerHTML = `
      <div class="progress-content">
        <div class="progress-spinner"></div>
        <span class="progress-message">${message}</span>
      </div>
    `;
    
    document.body.appendChild(progress);
    return progress;
  }

  hideMemoryProgress() {
    const progress = document.querySelector('.openmemory-progress');
    if (progress) {
      progress.classList.add('fadeout');
      setTimeout(() => progress.remove(), 300);
    }
  }


  async showMemoryOverlay() {
    if (this.memoryOverlay) {
      this.memoryOverlay.remove();
    }

    const memories = await window.memoryEngine.getAllMemories();
    this.createMemoryOverlay(memories);
  }

  createMemoryOverlay(memories) {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'openmemory-overlay';
    overlay.innerHTML = `
      <div class="openmemory-panel">
        <div class="panel-header">
          <h2>🧠 All Memories (${memories.length})</h2>
          <div class="header-controls">
            <input type="text" class="search-input" placeholder="🔍 Search memories..." />
            <button class="close-btn">✕</button>
          </div>
        </div>
        
        <div class="panel-content">
          <div class="memory-actions">
            <button class="btn-primary" id="inject-selected">Inject Selected (${this.selectedMemories.size})</button>
            <button class="btn-secondary" id="select-all">Select All</button>
            <button class="btn-secondary" id="clear-selection">Clear Selection</button>
          </div>
          
          <div class="memories-list">
            ${memories.length === 0 ? 
              '<div class="no-memories">No memories found</div>' :
              memories.map((memory, index) => this.createMemoryCard(memory, index)).join('')
            }
          </div>
        </div>
      </div>
    `;

    // Add overlay to page
    document.body.appendChild(overlay);
    this.memoryOverlay = overlay;

    // Setup overlay event listeners
    this.setupOverlayEventListeners(overlay, memories);

    // Add entrance animation
    setTimeout(() => overlay.classList.add('visible'), 10);
  }

  createMemoryCard(memory, index) {
    const isSelected = this.selectedMemories.has(index);
    const truncatedContent = memory.content.length > 200 ? 
      memory.content.substring(0, 200) + '...' : memory.content;
    
    return `
      <div class="memory-card ${isSelected ? 'selected' : ''}" data-index="${index}">
        <div class="memory-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''} />
        </div>
        <div class="memory-content">
          <div class="memory-text">${truncatedContent}</div>
          <div class="memory-meta">
            <span class="memory-type">${this.getMemoryTypeIcon(memory.type)} ${memory.type || 'memory'}</span>
            <span class="memory-platform">${this.getPlatformIcon(memory.platform)} ${memory.platform}</span>
            <span class="memory-date">${this.formatDate(memory.timestamp)}</span>
          </div>
        </div>
        <div class="memory-preview-btn" title="Preview full content">👁️</div>
      </div>
    `;
  }

  getMemoryTypeIcon(type) {
    const icons = {
      'extracted_fact': '🧠',
      'ai_response': '💬',
      'user_note': '📝',
      'memory': '💭',
      'structured_conversation': '🗣️'
    };
    return icons[type] || '💭';
  }

  getPlatformIcon(platform) {
    const icons = {
      'chatgpt': '🤖',
      'claude': '🎭', 
      'perplexity': '🔍',
      'gemini': '✨',
      'grok': '🚀'
    };
    return icons[platform] || '🌐';
  }

  formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  setupOverlayEventListeners(overlay, memories) {
    // Close button
    overlay.querySelector('.close-btn').addEventListener('click', () => {
      this.closeMemoryOverlay();
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeMemoryOverlay();
      }
    });

    // Search functionality
    const searchInput = overlay.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
      this.filterMemories(e.target.value, memories);
    });

    // Memory card selection
    overlay.querySelectorAll('.memory-card').forEach((card, index) => {
      const checkbox = card.querySelector('input[type="checkbox"]');
      
      checkbox.addEventListener('change', (e) => {
        this.toggleMemorySelection(index, e.target.checked);
        this.updateSelectionUI();
      });

      card.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && !e.target.classList.contains('memory-preview-btn')) {
          checkbox.checked = !checkbox.checked;
          this.toggleMemorySelection(index, checkbox.checked);
          this.updateSelectionUI();
        }
      });
    });

    // Action buttons
    overlay.querySelector('#inject-selected').addEventListener('click', () => {
      this.injectSelectedMemories(memories);
    });

    overlay.querySelector('#select-all').addEventListener('click', () => {
      this.selectAllMemories(memories.length);
    });

    overlay.querySelector('#clear-selection').addEventListener('click', () => {
      this.clearSelection();
    });

    // Preview buttons
    overlay.querySelectorAll('.memory-preview-btn').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showMemoryPreview(memories[index]);
      });
    });
  }

  toggleMemorySelection(index, isSelected) {
    if (isSelected) {
      this.selectedMemories.add(index);
    } else {
      this.selectedMemories.delete(index);
    }
  }

  updateSelectionUI() {
    if (this.memoryOverlay) {
      const injectBtn = this.memoryOverlay.querySelector('#inject-selected');
      injectBtn.textContent = `Inject Selected (${this.selectedMemories.size})`;
      injectBtn.disabled = this.selectedMemories.size === 0;

      // Update card styles
      this.memoryOverlay.querySelectorAll('.memory-card').forEach((card, index) => {
        card.classList.toggle('selected', this.selectedMemories.has(index));
      });
    }
  }

  selectAllMemories(totalCount) {
    for (let i = 0; i < totalCount; i++) {
      this.selectedMemories.add(i);
    }
    
    // Update checkboxes
    this.memoryOverlay.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = true;
    });
    
    this.updateSelectionUI();
  }

  clearSelection() {
    this.selectedMemories.clear();
    
    // Update checkboxes
    this.memoryOverlay.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    this.updateSelectionUI();
  }

  async injectSelectedMemories(memories) {
    if (this.selectedMemories.size === 0) {
      this.showNotification('No memories selected', 'info');
      return;
    }

    const selectedMemoriesArray = Array.from(this.selectedMemories).map(index => memories[index]);
    
    const input = this.getCurrentInput();
    if (!input) {
      this.showNotification('No input field found', 'error');
      return;
    }

    const currentText = this.getInputText(input);
    const memoryText = this.formatMemoriesForInjection(selectedMemoriesArray);
    const newText = memoryText + (currentText ? '\n\n' + currentText : '');
    
    this.setInputText(input, newText);
    this.showNotification(`Injected ${this.selectedMemories.size} selected memories`, 'success');
    this.closeMemoryOverlay();
  }

  filterMemories(searchTerm, memories) {
    const memoriesContainer = this.memoryOverlay.querySelector('.memories-list');
    const cards = memoriesContainer.querySelectorAll('.memory-card');

    cards.forEach((card, index) => {
      const memory = memories[index];
      const matchesSearch = memory.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           memory.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           memory.platform?.toLowerCase().includes(searchTerm.toLowerCase());
      
      card.style.display = matchesSearch ? 'flex' : 'none';
    });
  }

  showMemoryPreview(memory) {
    // Create a simple preview modal
    const preview = document.createElement('div');
    preview.className = 'memory-preview-modal';
    preview.innerHTML = `
      <div class="preview-content">
        <div class="preview-header">
          <h3>Memory Preview</h3>
          <button class="close-preview">✕</button>
        </div>
        <div class="preview-body">
          <div class="preview-text">${memory.content}</div>
          <div class="preview-meta">
            <div><strong>Type:</strong> ${this.getMemoryTypeIcon(memory.type)} ${memory.type || 'memory'}</div>
            <div><strong>Platform:</strong> ${this.getPlatformIcon(memory.platform)} ${memory.platform}</div>
            <div><strong>Date:</strong> ${this.formatDate(memory.timestamp)}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(preview);

    // Close preview
    preview.querySelector('.close-preview').addEventListener('click', () => {
      preview.remove();
    });

    preview.addEventListener('click', (e) => {
      if (e.target === preview) {
        preview.remove();
      }
    });

    setTimeout(() => preview.classList.add('visible'), 10);
  }

  closeMemoryOverlay() {
    if (this.memoryOverlay) {
      this.memoryOverlay.classList.remove('visible');
      setTimeout(() => {
        this.memoryOverlay.remove();
        this.memoryOverlay = null;
      }, 300);
    }
  }

  // Cleanup method to prevent memory leaks
  cleanup() {
    try {
      if (this.messageObserver) {
        this.messageObserver.disconnect();
        this.messageObserver = null;
      }
      if (this.periodicCheck) {
        clearInterval(this.periodicCheck);
        this.periodicCheck = null;
      }
      if (this.memoryButton) {
        this.memoryButton.remove();
        this.memoryButton = null;
      }
      if (this.memoryOverlay) {
        this.memoryOverlay.remove();
        this.memoryOverlay = null;
      }
      console.log('OpenMemory: Cleanup completed');
    } catch (error) {
      console.error('OpenMemory: Error during cleanup:', error);
    }
  }
}

// Global message listener setup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('OpenMemory: Global message listener received:', message);
  if (message.action === 'inject_memories') {
    if (window.openMemoryIntegration) {
      window.openMemoryIntegration.injectMemories();
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized'});
    }
  } else if (message.action === 'inject_selected_memories') {
    if (window.openMemoryIntegration && message.memories) {
      window.openMemoryIntegration.injectSpecificMemories(message.memories);
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized or no memories provided'});
    }
  } else if (message.action === 'show_memory_overlay') {
    if (window.openMemoryIntegration) {
      window.openMemoryIntegration.showMemoryOverlay();
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized'});
    }
  }
  return true; // Keep the message channel open for async response
});

// Add debugging and improved initialization
console.log('OpenMemory: Content script loaded');

function initializeOpenMemory() {
  console.log('OpenMemory: Starting initialization process...');
  console.log('OpenMemory: Current URL:', window.location.href);
  console.log('OpenMemory: Document ready state:', document.readyState);
  console.log('OpenMemory: Body available:', !!document.body);
  
  try {
    // Show initialization start indicator
    if (document.body) {
      const initDiv = document.createElement('div');
      initDiv.id = 'openmemory-init-indicator';
      initDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007bff;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        z-index: 999999;
        font-family: sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      initDiv.textContent = 'OpenMemory: Loading...';
      document.body.appendChild(initDiv);
      
      // Remove indicator after 3 seconds
      setTimeout(() => {
        const indicator = document.getElementById('openmemory-init-indicator');
        if (indicator) indicator.remove();
      }, 3000);
    }
    
    console.log('OpenMemory: Creating integration instance...');
    window.openMemoryIntegration = new OpenMemoryIntegration();
    console.log('OpenMemory: Integration created successfully');
    console.log('OpenMemory: Platform detected:', window.openMemoryIntegration.platform);
    
  } catch (error) {
    console.error('OpenMemory: Failed to initialize:', error);
    console.error('OpenMemory: Error stack:', error.stack);
    
    // Show a visible error notification
    if (document.body) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 999999;
        font-family: sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 15px rgba(255,68,68,0.3);
        max-width: 300px;
      `;
      errorDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">OpenMemory: Failed to load</div>
        <div style="font-size: 12px; opacity: 0.9;">Error: ${error.message}</div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Check console for details</div>
      `;
      document.body.appendChild(errorDiv);
      
      setTimeout(() => errorDiv.remove(), 8000);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOpenMemory);
} else {
  // DOM is already ready
  if (document.body) {
    initializeOpenMemory();
  } else {
    // Wait for body to be available
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        obs.disconnect();
        initializeOpenMemory();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.openMemoryIntegration) {
    window.openMemoryIntegration.cleanup();
  }
});
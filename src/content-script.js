/**
 * LocalBrain Content Script
 * Automatically detects and saves key facts from AI conversations
 * Injects relevant memories when starting new conversations
 */

class LocalBrainIntegration {
  constructor() {
    try {
      this.platform = this.detectPlatform();
      this.isEnabled = true;
      this.lastProcessedMessage = '';
      this.lastDetectedContent = null;
      this.pendingMemories = null;
      this.pendingQuery = null;
      this.conversationStarted = false;
      this.memoryButton = null;
      this.memoryOverlay = null;
      this.selectedMemories = new Set();
      this.processedMessages = new Set();
      this.isProcessing = false;
      this.isDragging = false;
      this.messageObserver = null;
      this.periodicCheck = null;
      
      // Notification rate limiting
      this.notificationQueue = [];
      this.recentNotifications = new Map();
      this.maxNotifications = 2;
      this.notificationCooldown = 3000; // 3 seconds between similar notifications
      
      console.log('LocalBrain: Initializing on', this.platform);
      this.init();
    } catch (error) {
      console.error('LocalBrain: Constructor error:', error);
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
    
    console.log('LocalBrain: Unknown platform detected:', hostname);
    return 'unknown';
  }

  async init() {
    try {
      // Initialize backend integration
      if (window.BackendIntegration) {
        window.backendIntegration = new window.BackendIntegration();
        console.log('LocalBrain: Backend integration initialized');
      } else {
        console.warn('LocalBrain: Backend integration not available');
      }
      
      // Wait for memory engine to be ready with timeout
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      while (!window.memoryEngine && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.memoryEngine) {
        console.error('LocalBrain: Memory engine failed to load');
        this.showNotification('Memory engine failed to load', 'error');
        return;
      }

      await window.memoryEngine.init();
      
      // Initialize components with error handling
      try {
        this.setupMessageObserver();
      } catch (error) {
        console.error('LocalBrain: Failed to setup message observer:', error);
      }

      try {
        this.injectMemoryButton();
      } catch (error) {
        console.error('LocalBrain: Failed to inject memory button:', error);
      }

      try {
        this.setupKeyboardShortcuts();
      } catch (error) {
        console.error('LocalBrain: Failed to setup keyboard shortcuts:', error);
      }

      try {
        this.setupAutoMemoryDetection();
      } catch (error) {
        console.error('LocalBrain: Failed to setup auto memory detection:', error);
      }
      
      // Auto-inject memories on new conversation
      try {
        this.checkForNewConversation();
      } catch (error) {
        console.error('LocalBrain: Failed to check for new conversation:', error);
      }
      
      console.log('LocalBrain: Ready on', this.platform);

      // Removed platform activation notification
    } catch (error) {
      console.error('LocalBrain: Initialization failed:', error);
      this.showNotification('LocalBrain initialization failed', 'error');
    }
  }

  setupMessageObserver() {
    console.log('LocalBrain: Setting up message observer for', this.platform);
    
    try {
      // Debounce function to avoid processing the same content multiple times
      let processingTimeout;
      
      const observer = new MutationObserver((_mutations) => {
        try {
          clearTimeout(processingTimeout);
          processingTimeout = setTimeout(() => {
            this.scanForNewMessages();
          }, 500); // Wait 500ms after changes stop
        } catch (error) {
          console.error('LocalBrain: Error in mutation observer:', error);
        }
      });

      // Start observing the conversation area
      const conversationArea = this.getConversationArea();
      if (conversationArea) {
        console.log('LocalBrain: Found conversation area:', conversationArea);
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
            console.error('LocalBrain: Error in periodic check:', error);
          }
        }, 5000); // Check every 5 seconds
        
      } else {
        console.warn('LocalBrain: No conversation area found, retrying in 2 seconds...');
        // Use a more robust retry mechanism
        this.retrySetupObserver();
      }
    } catch (error) {
      console.error('LocalBrain: Error setting up message observer:', error);
    }
  }

  retrySetupObserver() {
    let retryCount = 0;
    const maxRetries = 10;
    
    const retryInterval = setInterval(() => {
      retryCount++;
      console.log(`LocalBrain: Retry attempt ${retryCount} for message observer setup`);
      
      try {
        const conversationArea = this.getConversationArea();
        if (conversationArea) {
          clearInterval(retryInterval);
          this.setupMessageObserver();
          return;
        }
      } catch (error) {
        console.error('LocalBrain: Error during retry:', error);
      }
      
      if (retryCount >= maxRetries) {
        console.error('LocalBrain: Max retries reached, giving up on message observer setup');
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
            console.log('LocalBrain: Found new Zendesk content:', message.content.substring(0, 100) + '...');
            this.processNewContent(message.content);
            this.processedMessages.add(message.id);
          }
        } else if (message.isAI && message.content) {
          console.log('LocalBrain: Found new AI message:', message.content.substring(0, 100) + '...');
          this.processNewContent(message.content);
          this.processedMessages.add(message.id);
        }
      });
    } catch (error) {
      console.error('LocalBrain: Error scanning for messages:', error);
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
      console.error('LocalBrain: Error getting messages:', error);
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
    if (this.isProcessing) {return;} // Prevent concurrent processing
    
    // Extract text content if element provided, otherwise use content directly
    const textContent = typeof content === 'string' ? content : content?.textContent?.trim();
    if (!textContent || textContent.length < 20) {return;}

    // Skip if we already processed this content
    if (textContent === this.lastProcessedMessage) {return;}
    this.lastProcessedMessage = textContent;

    console.log('LocalBrain: Processing new content:', textContent.substring(0, 100) + '...');
    console.log('LocalBrain: Content length:', textContent.length);

    // Check if this is an AI response and enhance it with memory if we have a pending query
    if (this.looksLikeAIResponse(textContent)) {
      console.log('LocalBrain: Detected AI response, checking for memory enhancement');
      this.lastDetectedContent = textContent;
      
      // Check if we have a pending query with memories to enhance the response
      if (this.pendingQuery && (Date.now() - this.pendingQuery.timestamp < 30000)) { // 30 second window
        console.log('LocalBrain: Enhancing AI response with memory context');
        this.enhanceAIResponse(content, this.pendingQuery);
        this.pendingQuery = null; // Clear after use
      }
      
      // Update button to indicate new content is available
      this.updateMemoryButton();
    } else {
      console.log('LocalBrain: Content not recognized as AI response');
    }
  }

  looksLikeAIResponse(content) {
    // For Zendesk, we want to capture all customer service conversations
    if (this.platform === 'zendesk') {
      // For Zendesk, capture meaningful content (not just "Thanks" or "Hi")
      if (content.length < 20) {return false;}
      
      // Skip very short responses that are likely just greetings
      if (content.length < 50 && content.split(' ').length < 5) {return false;}
      
      // For Zendesk, most content above 50 characters is worth storing
      return content.length > 50;
    }
    
    // AI responses are typically longer and more informative
    if (content.length < 30) {return false;}
    
    // Skip very short responses that are likely user messages
    if (content.length < 100 && content.split(' ').length < 10) {return false;}
    
    // For longer content, it's likely an AI response
    if (content.length > 200) {return true;}
    
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

  async extractAndSaveMemories(content, suppressNotifications = false) {
    console.log('LocalBrain: Checking if content is worth saving...');
    if (!window.memoryEngine.isWorthSaving(content)) {
      console.log('LocalBrain: Content not worth saving');
      return;
    }

    // Show progress indicator only if not suppressing notifications
    const _progress = suppressNotifications ? null : this.showMemoryProgress('Processing memory...');

    try {
      console.log('LocalBrain: Content is worth saving, saving as conversation memory...');
      
      let memory = null;
      // Save the full response as a conversation memory (will be appended to existing if same topic)
      if (content.length > 50) {
        console.log('LocalBrain: Saving conversation memory');
        memory = await window.memoryEngine.saveMemory(content, {
          type: 'conversation', 
          platform: this.platform,
          conversation_url: window.location.href
        });

        // Memory will be confirmed in the summary below
      }

      // Extract and save key facts only if they're substantial
      const keyFacts = window.memoryEngine.extractKeyFacts(content);
      console.log('LocalBrain: Extracted', keyFacts.length, 'key facts');
      
      let savedFacts = 0;
      // Save key facts as separate memories only if they're significant
      for (const fact of keyFacts) {
        if (fact.length > 30) { // Only save substantial facts
          console.log('LocalBrain: Saving fact:', fact.substring(0, 50) + '...');
          const factMemory = await window.memoryEngine.saveMemory(fact, {
            type: 'extracted_fact',
            platform: this.platform,
            conversation_url: window.location.href
          });
          if (factMemory) {savedFacts++;}
        }
      }

      // Show consolidated summary notification only if not suppressing
      if (!suppressNotifications) {
        const totalSaved = (memory ? 1 : 0) + savedFacts;
        if (totalSaved > 0) {
          if (memory && savedFacts > 0) {
            this.showNotification(`💭 Saved conversation + ${savedFacts} insights`, 'success', 2000);
          } else if (memory) {
            this.showNotification('💭 Conversation saved', 'success', 2000);
          } else if (savedFacts > 0) {
            this.showNotification(`📝 Extracted ${savedFacts} key insights`, 'success', 2000);
          }
        }
      }

      // Update memory button if visible
      this.updateMemoryButton();
      
      console.log('LocalBrain: Memory extraction complete');
    } catch (error) {
      console.error('LocalBrain: Error saving memories:', error);
      if (!suppressNotifications) {
        this.showNotification('Failed to save memory', 'error');
      }
    } finally {
      // Hide progress indicator only if it was shown
      if (!suppressNotifications) {
        this.hideMemoryProgress();
      }
    }
  }

  injectMemoryButton() {
    console.log('LocalBrain: Attempting to inject memory button...');
    
    // Remove any existing button first
    const existingButton = document.getElementById('LocalBrain-button');
    if (existingButton) {
      existingButton.remove();
      console.log('LocalBrain: Removed existing button');
    }
    
    // Ensure we have a body element
    if (!document.body) {
      console.error('LocalBrain: No body element found, cannot inject button');
      return;
    }
    
    try {
      // Create single combined button
      const button = document.createElement('button');
      button.id = 'LocalBrain-button';
      button.innerHTML = '🧠';
      button.className = 'LocalBrain-button';
      button.title = 'Click: Update memories | Double-click: View all memories | Drag to move';
      
      // Get saved position or use default
      const savedPosition = this.getSavedButtonPosition();
      
      // Add platform-specific styling adjustments
      button.style.cssText = `
        position: fixed !important;
        top: ${savedPosition.top}px !important;
        left: ${savedPosition.left}px !important;
        z-index: 999999 !important;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(147, 51, 234, 0.8) 50%, rgba(59, 130, 246, 0.8) 100%) !important;
        color: rgba(255, 255, 255, 0.9) !important;
        border: none !important;
        border-radius: 50% !important;
        width: 48px !important;
        height: 48px !important;
        font-size: 20px !important;
        font-weight: 600 !important;
        cursor: grab !important;
        box-shadow: 
          0 4px 20px rgba(59, 130, 246, 0.2),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 0 0 2px rgba(147, 51, 234, 0.1),
          inset 0 1px 3px rgba(255, 255, 255, 0.2),
          inset 0 -1px 3px rgba(0, 0, 0, 0.05) !important;
        transition: all 0.3s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        user-select: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        visibility: visible !important;
        opacity: 1 !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.15)) !important;
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
      
      // Add drag functionality
      this.setupButtonDrag(button);
      
      // Add hover effects
      button.addEventListener('mouseenter', () => {
        if (!this.isDragging) {
          button.style.transform = 'translateY(-2px) scale(1.1)';
          button.style.boxShadow = `
            0 6px 20px rgba(59, 130, 246, 0.3),
            0 0 0 2px rgba(255, 255, 255, 0.15),
            0 0 0 3px rgba(147, 51, 234, 0.15),
            inset 0 1px 4px rgba(255, 255, 255, 0.25),
            inset 0 -1px 4px rgba(0, 0, 0, 0.08)
          `;
          button.style.background = 'linear-gradient(135deg, rgba(37, 99, 235, 0.9) 0%, rgba(126, 34, 206, 0.9) 50%, rgba(37, 99, 235, 0.9) 100%)';
          button.style.filter = 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.25))';
        }
      });
      
      button.addEventListener('mouseleave', () => {
        if (!this.isDragging) {
          button.style.transform = 'translateY(0) scale(1)';
          button.style.boxShadow = `
            0 4px 20px rgba(59, 130, 246, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.1),
            0 0 0 2px rgba(147, 51, 234, 0.1),
            inset 0 1px 3px rgba(255, 255, 255, 0.2),
            inset 0 -1px 3px rgba(0, 0, 0, 0.05)
          `;
          button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(147, 51, 234, 0.8) 50%, rgba(59, 130, 246, 0.8) 100%)';
          button.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.15))';
        }
      });
      
      // Add button to the page with retry logic
      const injectButton = () => {
        if (document.body && !document.getElementById('LocalBrain-button')) {
          document.body.appendChild(button);
          this.memoryButton = button;
          console.log('LocalBrain: Memory button successfully injected!');
          
          // Update button text with memory count
          this.updateMemoryButton();
          
          // Removed button loading notification
          
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
              console.error('LocalBrain: Failed to inject button after maximum attempts');
              this.showNotification('❌ Failed to load LocalBrain button', 'error');
            }
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('LocalBrain: Error creating memory button:', error);
      this.showNotification('❌ Failed to create memory button', 'error');
    }
  }

  async manualMemoryUpdate() {
    try {
      // Show single centered memory update popup
      this.showMemoryUpdatePopup();
      
      this.memoryButton.disabled = true;
      // Store original button state
      this.memoryButton.innerHTML = '⏳ Saving...';
      
      let newMemoriesCount = 0;
      
      // Check if user has selected text to save as structured memory
      const selectedText = window.getSelection().toString().trim();
      if (selectedText && selectedText.length > 20) {
        console.log('LocalBrain: User selected text for memory:', selectedText.substring(0, 100) + '...');
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
      
      // Hide the memory update popup after completion with a delay
      setTimeout(() => {
        this.hideMemoryUpdatePopup();
      }, 2000);
      
    } catch (error) {
      console.error('LocalBrain: Manual update failed:', error);
      this.hideMemoryUpdatePopup();
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
      console.error('LocalBrain: Error getting recent content:', error);
    }
    return null;
  }

  updateMemoryButton() {
    if (!this.memoryButton) {return;}
    
    window.memoryEngine.getMemoryStats().then(stats => {
      this.memoryButton.innerHTML = `🧠`;
      this.memoryButton.title = `Click: Update memories | Double-click: View all memories | Drag to move | Memories: ${stats.total}`;
    }).catch(error => {
      console.error('LocalBrain: Failed to get memory stats:', error);
      this.memoryButton.innerHTML = '🧠';
      this.memoryButton.title = 'Click: Update memories | Double-click: View all memories | Drag to move';
    });
  }

  getSavedButtonPosition() {
    try {
      const saved = localStorage.getItem('LocalBrain-button-position');
      if (saved) {
        const position = JSON.parse(saved);
        // Ensure position is within viewport bounds
        const maxX = window.innerWidth - 70; // Button width + padding
        const maxY = window.innerHeight - 70; // Button height + padding
        return {
          top: Math.max(20, Math.min(position.top, maxY)),
          left: Math.max(20, Math.min(position.left, maxX))
        };
      }
    } catch (error) {
      console.error('LocalBrain: Error loading button position:', error);
    }
    // Default position - right side below popup area
    return { top: 200, left: window.innerWidth - 80 };
  }

  saveButtonPosition(top, left) {
    try {
      localStorage.setItem('LocalBrain-button-position', JSON.stringify({ top, left }));
    } catch (error) {
      console.error('LocalBrain: Error saving button position:', error);
    }
  }

  setupButtonDrag(button) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    const handleMouseDown = (e) => {
      // Only start dragging on left mouse button
      if (e.button !== 0) return;
      
      isDragging = true;
      this.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(button.style.left);
      startTop = parseInt(button.style.top);
      
      button.style.cursor = 'grabbing';
      button.style.transform = 'scale(1.15)';
      button.style.boxShadow = `
        0 8px 25px rgba(59, 130, 246, 0.4),
        0 0 0 2px rgba(255, 255, 255, 0.2),
        0 0 0 4px rgba(147, 51, 234, 0.2),
        inset 0 2px 6px rgba(255, 255, 255, 0.3),
        inset 0 -2px 6px rgba(0, 0, 0, 0.08)
      `;
      button.style.filter = 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.3))';
      
      // Prevent text selection during drag
      e.preventDefault();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      
      // Constrain to viewport bounds
      const maxX = window.innerWidth - button.offsetWidth - 20;
      const maxY = window.innerHeight - button.offsetHeight - 20;
      
      newLeft = Math.max(20, Math.min(newLeft, maxX));
      newTop = Math.max(20, Math.min(newTop, maxY));
      
      button.style.left = newLeft + 'px';
      button.style.top = newTop + 'px';
    };
    
    const handleMouseUp = () => {
      if (!isDragging) return;
      
      isDragging = false;
      this.isDragging = false;
      
      button.style.cursor = 'grab';
      button.style.transform = 'translateY(0) scale(1)';
      button.style.boxShadow = `
        0 4px 20px rgba(59, 130, 246, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        0 0 0 2px rgba(147, 51, 234, 0.1),
        inset 0 1px 3px rgba(255, 255, 255, 0.2),
        inset 0 -1px 3px rgba(0, 0, 0, 0.05)
      `;
      button.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.15))';
      
      // Save the new position
      const newLeft = parseInt(button.style.left);
      const newTop = parseInt(button.style.top);
      this.saveButtonPosition(newTop, newLeft);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    button.addEventListener('mousedown', handleMouseDown);
    
    // Prevent dragging on double-click
    button.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // Save user-selected text as a structured memory
  async saveSelectedTextAsStructuredMemory(selectedText) {
    try {
      console.log('LocalBrain: Saving selected text as structured memory');
      
      const memory = await window.memoryEngine.saveMemory(selectedText, {
        type: 'user_selected',
        platform: this.platform,
        conversation_url: window.location.href
      });

      if (memory) {
        console.log('LocalBrain: Structured memory saved successfully');
        // Don't show notification here - will be handled by manualMemoryUpdate
      }
      
    } catch (error) {
      console.error('LocalBrain: Error saving selected text:', error);
      // Don't show notification here - will be handled by manualMemoryUpdate
    }
  }

  // Save conversation messages as structured user-AI pairs
  async saveConversationAsStructuredMemories() {
    try {
      console.log('LocalBrain: Saving conversation as structured memories');
      
      const content = this.getRecentConversationContent();
      if (!content || content.length < 50) {
        console.log('LocalBrain: No substantial conversation content to save');
        return;
      }

      // Save with suppressed notifications since this is called during manual update
      await this.extractAndSaveMemories(content, true);
      
    } catch (error) {
      console.error('LocalBrain: Error saving conversation:', error);
      // Don't show notification here - will be handled by manualMemoryUpdate
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
      // Ctrl+M or Cmd+M to inject memories (Openmemory style)
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        this.injectMemories();
      }
      
      // Additional shortcuts for other features
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        this.showMemoryOverlay();
      }
      
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.saveConversationAsStructuredMemories();
      }
      
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        this.showHelp();
      }
      
      if (e.key === 'Escape') {
        this.closeAllOverlays();
      }
    });
    
    console.log('LocalBrain: Keyboard shortcuts enabled');
  }

  showHelp() {
    const helpText = `
LocalBrain Keyboard Shortcuts:
• Ctrl+Shift+M: Show memory overlay
• Ctrl+Shift+S: Save current conversation
• Ctrl+Shift+I: Inject memories
• Ctrl+Shift+H: Show this help
• Escape: Close overlays
    `;
    
    this.showNotification(helpText, 'info', 8000);
  }

  closeAllOverlays() {
    // Close memory overlay
    const overlay = document.querySelector('.LocalBrain-overlay');
    if (overlay) {
      overlay.remove();
    }

    // Close notifications
    document.querySelectorAll('.LocalBrain-notification').forEach(notification => {
      notification.remove();
    });

    // Hide progress indicators
    document.querySelectorAll('.LocalBrain-progress').forEach(progress => {
      progress.remove();
    });
  }

  // Enhanced loading states
  showLoadingState(message = 'Processing...') {
    this.hideLoadingState(); // Remove any existing loading states
    
    const loadingEl = document.createElement('div');
    loadingEl.className = 'LocalBrain-loading';
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    loadingEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100000;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      backdrop-filter: blur(10px);
    `;

    const spinner = loadingEl.querySelector('.loading-spinner');
    spinner.style.cssText = `
      width: 24px;
      height: 24px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    const messageEl = loadingEl.querySelector('.loading-message');
    messageEl.style.cssText = `
      font-size: 14px;
      font-weight: 500;
      text-align: center;
    `;

    document.body.appendChild(loadingEl);
    this.currentLoadingState = loadingEl;
  }

  hideLoadingState() {
    if (this.currentLoadingState) {
      this.currentLoadingState.remove();
      this.currentLoadingState = null;
    }
  }

  // Enhanced progress tracking
  showProgress(progress, total, message = 'Processing memories...') {
    const percentage = Math.round((progress / total) * 100);
    
    if (!this.progressElement) {
      this.progressElement = document.createElement('div');
      this.progressElement.className = 'LocalBrain-progress';
      this.progressElement.innerHTML = `
        <div class="progress-content">
          <div class="progress-spinner"></div>
          <div class="progress-message">${message}</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      `;
      
      this.progressElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 100001;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px 20px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        min-width: 300px;
      `;

      const progressBar = this.progressElement.querySelector('.progress-bar');
      progressBar.style.cssText = `
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin-top: 8px;
        overflow: hidden;
      `;

      const progressFill = this.progressElement.querySelector('.progress-fill');
      progressFill.style.cssText = `
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 2px;
        transition: width 0.3s ease;
        width: ${percentage}%;
      `;

      document.body.appendChild(this.progressElement);
    } else {
      const progressFill = this.progressElement.querySelector('.progress-fill');
      const messageEl = this.progressElement.querySelector('.progress-message');
      
      progressFill.style.width = `${percentage}%`;
      messageEl.textContent = `${message} (${progress}/${total})`;
    }
  }

  hideProgress() {
    if (this.progressElement) {
      this.progressElement.remove();
      this.progressElement = null;
    }
  }

  // Enhanced memory injection with progress
  async injectMemoriesWithProgress() {
    try {
      this.showProgress(0, 100, 'Preparing memories...');
      
      const memories = await window.memoryEngine.getRelevantMemories('', 10);
      if (memories.length === 0) {
        this.hideProgress();
        this.showNotification('No memories found to inject', 'info');
        return;
      }

      this.showProgress(25, 100, 'Formatting memories...');
      const formattedMemories = this.formatMemoriesForInjection(memories);
      
      this.showProgress(50, 100, 'Finding input field...');
      const inputElement = this.getCurrentInput();
      if (!inputElement) {
        this.hideProgress();
        this.showNotification('No input field found', 'error');
        return;
      }

      // Debug the input field
      this.debugInputField(inputElement);

      this.showProgress(75, 100, 'Injecting memories...');
      const currentValue = this.getInputText(inputElement);
      console.log('LocalBrain: Current value in input:', currentValue);
      
      const newValue = currentValue + '\n\n' + formattedMemories;
      console.log('LocalBrain: About to set new value:', newValue.substring(0, 200) + '...');
      
      this.setInputText(inputElement, newValue);
      
      // Verify the text was set
      setTimeout(() => {
        const afterValue = this.getInputText(inputElement);
        console.log('LocalBrain: Value after injection:', afterValue.substring(0, 200) + '...');
      }, 500);
      
      this.showProgress(100, 100, 'Memories injected successfully!');
      
      setTimeout(() => {
        this.hideProgress();
        this.showMemoryInjectedPopup();
      }, 1000);

    } catch (error) {
      this.hideProgress();
      console.error('Memory injection failed:', error);
      this.showNotification('Failed to inject memories', 'error');
    }
  }

  // Enhanced memory saving with progress
  async saveMemoriesWithProgress(memories) {
    try {
      this.showProgress(0, memories.length, 'Saving memories...');
      
      let savedCount = 0;
      for (const memory of memories) {
        await window.memoryEngine.saveMemory(memory.content, memory.metadata);
        savedCount++;
        this.showProgress(savedCount, memories.length, `Saving memory ${savedCount}/${memories.length}...`);
      }
      
      this.showProgress(memories.length, memories.length, 'Memories saved successfully!');
      
      setTimeout(() => {
        this.hideProgress();
        this.showNotification(`Saved ${savedCount} memories`, 'success');
      }, 1000);

    } catch (error) {
      this.hideProgress();
      console.error('Memory saving failed:', error);
      this.showNotification('Failed to save memories', 'error');
    }
  }

  // Enhanced notification system
  showEnhancedNotification(message, type = 'info', duration = 3000, actions = []) {
    const notification = document.createElement('div');
    notification.className = `LocalBrain-notification LocalBrain-${type}`;
    
    let html = `
      <div class="notification-icon">${this.getNotificationIcon(type)}</div>
      <div class="notification-message">${message}</div>
      <button class="notification-close">×</button>
    `;

    if (actions.length > 0) {
      html += '<div class="notification-actions">';
      actions.forEach(action => {
        html += `<button class="notification-action" data-action="${action.key}">${action.label}</button>`;
      });
      html += '</div>';
    }

    notification.innerHTML = html;
    
    // Add enhanced styling
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      max-width: 400px;
      padding: 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: slideInRight 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Add action button styling
    const actionButtons = notification.querySelectorAll('.notification-action');
    actionButtons.forEach(button => {
      button.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.3)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
      });
    });

    document.body.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);

    return notification;
  }

  getNotificationIcon(type) {
    const icons = {
      'success': '✓',
      'error': '✗',
      'warning': '⚠',
      'info': 'ℹ',
      'memory': '💾'
    };
    return icons[type] || icons.info;
  }

  setupAutoMemoryDetection() {
    console.log('LocalBrain: Setting up automatic memory detection...');
    
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
        lastContent = this.getInputText(target);
        autoSuggestionsShown = false;
        console.log('LocalBrain: Monitoring input field for auto-suggestions');
      }
    });
    
    // Monitor typing and detect when user pauses
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (this.isInputField(target) && target === currentInput) {
        clearTimeout(typingTimer);
        
        // Wait for user to pause typing (1 second for faster response)
        typingTimer = setTimeout(async () => {
          const currentContent = this.getInputText(target);
          
          // Only check if content is substantial and changed, and looks like a question
          if (currentContent.length > 5 && currentContent !== lastContent && !autoSuggestionsShown && this.looksLikeQuestion(currentContent)) {
            console.log('LocalBrain: Preparing memories for potential injection:', currentContent.substring(0, 50) + '...');
            
            // Store the user query for potential response enhancement
            const relevantMemories = await window.memoryEngine.getRelevantMemories(currentContent, 5);
            if (relevantMemories.length > 0) {
              console.log('LocalBrain: Found relevant memories, preparing for response enhancement');
              
              // Store the query and memories for response enhancement
              this.pendingQuery = {
                userQuery: currentContent,
                memories: relevantMemories,
                timestamp: Date.now()
              };
              
              // Show subtle indicator
              this.showNotification(`🧠 ${relevantMemories.length} relevant memories found`, 'info', 2000);
            }
            
            autoSuggestionsShown = true;
          }
          
          lastContent = currentContent;
        }, 1000); // 1 second delay after user stops typing for faster response
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
    
    // Intercept form submissions and Enter key presses to inject memories
    this.setupSubmissionInterceptor();
  }

  setupSubmissionInterceptor() {
    // Intercept Enter key presses in input fields
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target;
        if (this.isInputField(target) && this.pendingMemories && this.pendingMemories.inputElement === target) {
          e.preventDefault();
          this.injectMemoriesAndSubmit(target);
          return false;
        }
      }
    }, true); // Use capture phase to intercept before other handlers
    
    // Intercept submit button clicks
    document.addEventListener('click', (e) => {
      const target = e.target;
      // More comprehensive button detection for different platforms
      const isSubmitButton = target.matches([
        '[data-testid="send-button"]', // ChatGPT
        'button[type="submit"]',
        '.send-button',
        '[aria-label*="Send"]',
        '[aria-label*="submit"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
        '.submit-button',
        '[data-send-button]',
        'button:has(svg)', // Many platforms use SVG icons in send buttons
        'button[class*="send"]',
        'button[class*="submit"]'
      ].join(', '));
      
      // Also check parent elements in case of nested button structures
      let buttonElement = target;
      if (!isSubmitButton) {
        buttonElement = target.closest('button, [role="button"]');
        if (buttonElement) {
          const isParentSubmitButton = buttonElement.matches([
            '[data-testid="send-button"]',
            'button[type="submit"]',
            '[aria-label*="Send"]',
            '[aria-label*="submit"]'
          ].join(', '));
          if (isParentSubmitButton && this.pendingMemories) {
            e.preventDefault();
            e.stopPropagation();
            console.log('LocalBrain: Intercepted submit button (parent):', buttonElement);
            this.injectMemoriesAndSubmit(this.pendingMemories.inputElement);
            return false;
          }
        }
      }
      
      if (isSubmitButton && this.pendingMemories) {
        e.preventDefault();
        e.stopPropagation();
        console.log('LocalBrain: Intercepted submit button:', target);
        this.injectMemoriesAndSubmit(this.pendingMemories.inputElement);
        return false;
      }
    }, true); // Use capture phase
  }

  async injectMemoriesAndSubmit(inputElement) {
    try {
      if (!this.pendingMemories) {return;}
      
      const { userQuery, memories } = this.pendingMemories;
      
      // Format memories for injection
      const memoryContext = this.formatMemoriesForAutoInjection(memories);
      
      // Create enhanced query with memory context
      const enhancedQuery = `${userQuery}\n\n[Context from my previous conversations: ${memoryContext}]`;
      
      // Inject the enhanced query
      this.setInputText(inputElement, enhancedQuery);
      
      // Show centered injection popup instead of notification
      this.showMemoryInjectedPopup();
      
      // Submit after a brief delay to ensure the value is set
      setTimeout(() => {
        this.submitNormally(inputElement);
      }, 100);
      
      // Clear pending memories
      this.pendingMemories = null;
      
    } catch (error) {
      console.error('LocalBrain: Error injecting memories before submit:', error);
      // Fall back to normal submission
      this.submitNormally(inputElement);
    }
  }

  submitNormally(inputElement) {
    // Simulate normal submission
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: false
    });
    
    inputElement.dispatchEvent(enterEvent);
  }

  showSmartMemoryPrompt(inputElement, memories, userQuery) {
    // Remove any existing prompt
    const existing = document.querySelector('.LocalBrain-smart-prompt');
    if (existing) {existing.remove();}

    // Create smart prompt overlay
    const prompt = document.createElement('div');
    prompt.className = 'LocalBrain-smart-prompt';
    prompt.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      width: 350px;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(15px);
      border: 2px solid #3b82f6;
      border-radius: 16px;
      padding: 16px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out;
    `;

    prompt.innerHTML = `
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="font-size: 20px; margin-right: 8px;">🧠</div>
        <div style="font-weight: 600; color: #1f2937;">Found Relevant Memories</div>
        <button onclick="this.closest('.LocalBrain-smart-prompt').remove()" 
                style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer; color: #6b7280;">×</button>
      </div>
      
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
        I found ${memories.length} relevant memories from your previous conversations:
      </div>
      
      <div style="max-height: 120px; overflow-y: auto; margin-bottom: 12px;">
        ${memories.map(memory => {
    let displayText = '';
    try {
      const parsed = JSON.parse(memory.content);
      if (parsed.user && parsed.ai_output) {
        displayText = `💬 ${parsed.ai_output.substring(0, 80)}...`;
      } else {
        displayText = memory.content.substring(0, 80) + '...';
      }
    } catch (e) {
      displayText = memory.content.substring(0, 80) + '...';
    }
          
    return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 6px; font-size: 12px; line-height: 1.4;">
              ${displayText}
            </div>
          `;
  }).join('')}
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button id="include-memories" style="flex: 1; background: #3b82f6; color: white; border: none; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 500; cursor: pointer;">
          ✨ Include & Send
        </button>
        <button id="send-without" style="flex: 1; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Send Without
        </button>
      </div>
    `;

    document.body.appendChild(prompt);

    // Add event listeners
    prompt.querySelector('#include-memories').addEventListener('click', () => {
      this.includeMemoriesAndSend(inputElement, userQuery, memories);
      prompt.remove();
    });

    prompt.querySelector('#send-without').addEventListener('click', () => {
      this.sendWithoutMemories(inputElement);
      prompt.remove();
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (document.contains(prompt)) {
        prompt.remove();
      }
    }, 15000);
  }

  async includeMemoriesAndSend(inputElement, userQuery, memories) {
    try {
      // Format memories for injection
      const memoryContext = this.formatMemoriesForAutoInjection(memories);
      
      // Create enhanced query with memory context
      const enhancedQuery = `${userQuery}\n\n[Context from my previous conversations: ${memoryContext}]`;
      
      // Set the enhanced query
      this.setInputText(inputElement, enhancedQuery);
      
      // Show notification
      this.showNotification(`🧠 Added ${memories.length} memories to your question`, 'success', 2000);
      
      // Submit after a brief delay
      setTimeout(() => {
        this.submitNormally(inputElement);
      }, 500);
      
    } catch (error) {
      console.error('LocalBrain: Error including memories:', error);
    }
  }

  sendWithoutMemories(inputElement) {
    // Just submit without any memory context
    this.submitNormally(inputElement);
  }

  async enhanceAIResponse(responseElement, queryData) {
    try {
      const { userQuery, memories } = queryData;
      
      // Get the current AI response text
      const currentResponse = responseElement.textContent || responseElement.innerText || '';
      
      // Check if the response indicates the AI doesn't know something
      const unknownIndicators = [
        /i don't know/i,
        /i don't have access/i,
        /i don't have information/i,
        /i cannot/i,
        /i am not aware/i,
        /i don't recall/i,
        /no information about/i,
        /don't have data/i,
        /not in my knowledge/i
      ];
      
      const indicatesUnknown = unknownIndicators.some(pattern => pattern.test(currentResponse));
      
      if (indicatesUnknown || currentResponse.length < 100) {
        console.log('LocalBrain: AI response indicates lack of knowledge, enhancing with memories');
        
        // Create enhanced response with memory context
        const memoryContext = this.formatMemoriesForResponse(memories);
        const enhancedResponse = this.createEnhancedResponse(userQuery, currentResponse, memoryContext);
        
        // Replace the AI response content
        this.replaceAIResponse(responseElement, enhancedResponse);
        
        this.showNotification(`🧠 Enhanced response with ${memories.length} memories`, 'success', 3000);
      }
      
    } catch (error) {
      console.error('LocalBrain: Error enhancing AI response:', error);
    }
  }

  formatMemoriesForResponse(memories) {
    return memories.map(memory => {
      try {
        const parsed = JSON.parse(memory.content);
        if (parsed.user && parsed.ai_output) {
          return parsed.ai_output;
        }
      } catch (e) {
        // Not JSON, return raw content
      }
      return memory.content;
    }).join(' ');
  }

  createEnhancedResponse(_userQuery, originalResponse, memoryContext) {
    // Create a natural response that incorporates the memory
    const enhancedResponse = `Based on our previous conversations, I can help with that! ${memoryContext}
    
${originalResponse.includes('don\'t know') || originalResponse.includes('don\'t have') ? '' : originalResponse}`;
    
    return enhancedResponse;
  }

  replaceAIResponse(responseElement, newContent) {
    try {
      // Different platforms have different structures
      if (responseElement.textContent !== undefined) {
        responseElement.textContent = newContent;
      } else if (responseElement.innerText !== undefined) {
        responseElement.innerText = newContent;
      } else if (responseElement.innerHTML !== undefined) {
        responseElement.innerHTML = newContent.replace(/\n/g, '<br>');
      }
      
      // Trigger any necessary events
      const event = new Event('input', { bubbles: true });
      responseElement.dispatchEvent(event);
      
    } catch (error) {
      console.error('LocalBrain: Error replacing AI response:', error);
    }
  }

  isInputField(element) {
    if (!element) {return false;}
    
    // Check for common input fields
    if (element.tagName === 'TEXTAREA') {return true;}
    if (element.tagName === 'INPUT' && ['text', 'search'].includes(element.type)) {return true;}
    if (element.contentEditable === 'true') {return true;}
    
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




  formatMemoriesForAutoInjection(memories) {
    return memories.map(memory => {
      try {
        // Check if it's a structured conversation memory
        const parsed = JSON.parse(memory.content);
        if (parsed.user && parsed.ai_output) {
          return `Q: ${parsed.user} A: ${parsed.ai_output}`;
        }
      } catch (e) {
        // Not JSON, treat as regular memory
      }
      
      // Regular memory format
      const preview = memory.content.length > 100 
        ? memory.content.substring(0, 100) + '...' 
        : memory.content;
      return preview;
    }).join('; ');
  }



  looksLikeQuestion(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Question words and patterns
    const questionPatterns = [
      /^(what|who|where|when|why|how|which|whose|whom)\b/,
      /\?$/,
      /^(do|does|did|can|could|will|would|should|is|are|was|were|have|has|had)\s/,
      /\b(tell me|show me|explain|describe|what about|how about|do you know|remember|recall)\b/,
      /\b(like|prefer|favorite|favourite|best|worst|recommend)\b/
    ];
    
    return questionPatterns.some(pattern => pattern.test(lowerText));
  }

  showAutoSuggestionNotification(memories, inputElement, userQuery) {
    // Remove any existing auto-suggestion
    const existingSuggestion = document.querySelector('.LocalBrain-auto-suggestion');
    if (existingSuggestion) {existingSuggestion.remove();}
    
    // Create auto-suggestion UI
    const suggestion = document.createElement('div');
    suggestion.className = 'LocalBrain-auto-suggestion';
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
        ${memories.map((memory, _index) => `
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
      const currentValue = this.getInputText(inputElement);
      const newValue = currentValue + '\n\n' + contextualPrompt;
      
      this.setInputText(inputElement, newValue);
      
      // Show centered injection popup instead of notification
      this.showMemoryInjectedPopup();
      
      console.log('LocalBrain: Auto-injected memories successfully');
      
    } catch (error) {
      console.error('LocalBrain: Error auto-injecting memories:', error);
      this.showNotification('❌ Failed to auto-include memories', 'error');
    }
  }

  // Duplicate method removed - using the one defined earlier

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
    this.showMemoryInjectedPopup();
  }

  async injectSpecificMemories(memories) {
    console.log('LocalBrain: Injecting specific memories:', memories);
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
    
    // Show centered injection popup instead of notification
    this.showMemoryInjectedPopup();
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
        console.warn('LocalBrain: Invalid selector:', selector, error);
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

  // Debug function to help identify input field issues
  debugInputField(input) {
    if (!input) {
      console.log('LocalBrain: No input field provided for debugging');
      return;
    }
    
    console.log('LocalBrain: === INPUT FIELD DEBUG INFO ===');
    console.log('Tag name:', input.tagName);
    console.log('Type:', input.type);
    console.log('Placeholder:', input.placeholder);
    console.log('Value:', input.value);
    console.log('Text content:', input.textContent);
    console.log('Inner text:', input.innerText);
    console.log('Content editable:', input.contentEditable);
    console.log('Disabled:', input.disabled);
    console.log('Read only:', input.readOnly);
    console.log('Visible:', this.isVisible(input));
    console.log('Interactable:', this.isInteractable(input));
    console.log('Dimensions:', input.offsetWidth, 'x', input.offsetHeight);
    console.log('Area:', input.offsetWidth * input.offsetHeight);
    console.log('Classes:', input.className);
    console.log('ID:', input.id);
    console.log('Aria label:', input.getAttribute('aria-label'));
    console.log('Data attributes:', Object.keys(input.dataset));
    console.log('=== END DEBUG INFO ===');
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
    hint.className = 'LocalBrain-hint';
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
    // Check if similar notification was shown recently
    const notificationKey = `${type}:${message.substring(0, 20)}`;
    const now = Date.now();
    
    if (this.recentNotifications.has(notificationKey)) {
      const lastShown = this.recentNotifications.get(notificationKey);
      if (now - lastShown < this.notificationCooldown) {
        console.log('LocalBrain: Skipping duplicate notification:', message);
        return null;
      }
    }
    
    // Limit total number of notifications
    const existingNotifications = document.querySelectorAll('.LocalBrain-notification');
    if (existingNotifications.length >= this.maxNotifications) {
      // Remove oldest notification
      const oldest = existingNotifications[0];
      if (oldest) {
        oldest.remove();
        this.repositionNotifications();
      }
    }
    
    // Record this notification
    this.recentNotifications.set(notificationKey, now);
    
    // Calculate vertical position based on existing notifications
    const remainingNotifications = document.querySelectorAll('.LocalBrain-notification');
    let topOffset = this.getBaseNotificationTop();
    
    // Stack notifications vertically with 8px spacing
    remainingNotifications.forEach((notif, _index) => {
      const notifHeight = notif.offsetHeight || 60; // Approximate height
      topOffset += notifHeight + 8; // 8px spacing between notifications
    });
    
    const notification = document.createElement('div');
    notification.className = `LocalBrain-notification LocalBrain-${type}`;
    
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
    const notifications = document.querySelectorAll('.LocalBrain-notification');
    let topOffset = this.getBaseNotificationTop();
    
    notifications.forEach((notif, _index) => {
      notif.style.top = `${topOffset}px`;
      const notifHeight = notif.offsetHeight || 60;
      topOffset += notifHeight + 8; // 8px spacing
    });
  }

  // Memory progress methods
  showMemoryProgress(message) {
    const progressEl = document.createElement('div');
    progressEl.className = 'LocalBrain-progress';
    progressEl.innerHTML = `
      <div class="progress-content">
        <div class="progress-spinner"></div>
        <div class="progress-message">${message}</div>
      </div>
    `;
    
    progressEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100001;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px 20px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      min-width: 300px;
    `;

    const spinner = progressEl.querySelector('.progress-spinner');
    spinner.style.cssText = `
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    document.body.appendChild(progressEl);
    return progressEl;
  }

  hideMemoryProgress() {
    const progressEl = document.querySelector('.LocalBrain-progress');
    if (progressEl) {
      progressEl.remove();
    }
  }

  // Memory update popup methods
  showMemoryUpdatePopup() {
    const popup = document.createElement('div');
    popup.className = 'LocalBrain-memory-update';
    popup.innerHTML = `
      <div class="memory-update-content">
        <div class="memory-update-icon">💾</div>
        <div class="memory-update-text">Memory saved!</div>
      </div>
    `;
    
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100002;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      text-align: center;
    `;
    
    document.body.appendChild(popup);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      popup.remove();
    }, 2000);
    
    return popup;
  }

  hideMemoryUpdatePopup() {
    const popup = document.querySelector('.LocalBrain-memory-update');
    if (popup) {
      popup.remove();
    }
  }

  // Enhanced memory injection with progress
  async injectMemoriesWithProgress() {
    try {
      this.showProgress(0, 100, 'Preparing memories...');
      
      const memories = await window.memoryEngine.getRelevantMemories('', 10);
      if (memories.length === 0) {
        this.hideProgress();
        this.showNotification('No memories found to inject', 'info');
        return;
      }

      this.showProgress(25, 100, 'Formatting memories...');
      const formattedMemories = this.formatMemoriesForInjection(memories);
      
      this.showProgress(50, 100, 'Finding input field...');
      const inputElement = this.getCurrentInput();
      if (!inputElement) {
        this.hideProgress();
        this.showNotification('No input field found', 'error');
        return;
      }

      // Debug the input field
      this.debugInputField(inputElement);

      this.showProgress(75, 100, 'Injecting memories...');
      const currentValue = this.getInputText(inputElement);
      console.log('LocalBrain: Current value in input:', currentValue);
      
      const newValue = currentValue + '\n\n' + formattedMemories;
      console.log('LocalBrain: About to set new value:', newValue.substring(0, 200) + '...');
      
      this.setInputText(inputElement, newValue);
      
      // Verify the text was set
      setTimeout(() => {
        const afterValue = this.getInputText(inputElement);
        console.log('LocalBrain: Value after injection:', afterValue.substring(0, 200) + '...');
      }, 500);
      
      this.showProgress(100, 100, 'Memories injected successfully!');
      
      setTimeout(() => {
        this.hideProgress();
        this.showMemoryInjectedPopup();
      }, 1000);

    } catch (error) {
      this.hideProgress();
      console.error('Memory injection failed:', error);
      this.showNotification('Failed to inject memories', 'error');
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
    overlay.className = 'LocalBrain-overlay';
    overlay.innerHTML = `
      <div class="LocalBrain-panel">
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
            <button class="btn-danger" id="delete-selected">Delete Selected</button>
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
    document.body.appendChild(overlay);
    this.memoryOverlay = overlay;
    this.setupOverlayEventListeners(overlay, memories);
    setTimeout(() => overlay.classList.add('visible'), 10);
  }

  createMemoryCard(memory, index) {
    const isSelected = this.selectedMemories.has(index);
    const truncatedContent = memory.content.length > 200 ? 
      memory.content.substring(0, 200) + '...' : memory.content;
    return `
      <div class="memory-card${isSelected ? ' selected' : ''}" data-index="${index}" style="display: flex; align-items: flex-start; gap: 12px;">
        <div class="memory-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''} />
        </div>
        <div class="memory-content" style="flex: 1;">
          <div class="memory-text">${truncatedContent}</div>
          <div class="memory-meta">
            <span class="memory-type">${this.getMemoryTypeIcon(memory.type)} ${memory.type || 'memory'}</span>
            <span class="memory-platform">${this.getPlatformIcon(memory.platform)} ${memory.platform}</span>
            <span class="memory-date">${this.formatDate(memory.timestamp)}</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 40px; margin-left: 8px;">
          <button class="memory-preview-btn" title="Preview full content" style="background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; border-radius: 4px; transition: background 0.2s ease;">👁️</button>
          <button class="memory-delete-btn" title="Delete this memory" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #e11d48; padding: 4px; border-radius: 4px; transition: background 0.2s ease;">🗑️</button>
        </div>
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
    if (!timestamp) {return 'Unknown';}
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {return 'Today';}
    if (diffDays === 1) {return 'Yesterday';}
    if (diffDays < 7) {return `${diffDays}d ago`;}
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

    // Add after preview buttons setup
    overlay.querySelectorAll('.memory-delete-btn').forEach((btn, index) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const memory = memories[index];
        if (confirm('Delete this memory?')) {
          await window.memoryEngine.deleteMemory(memory.id);
          this.showNotification('Memory deleted', 'success', 1500);
          this.showMemoryOverlay(); // Refresh overlay
        }
      });
    });
    // Delete selected
    overlay.querySelector('#delete-selected').addEventListener('click', async () => {
      if (this.selectedMemories.size === 0) return;
      if (!confirm(`Delete ${this.selectedMemories.size} selected memories?`)) return;
      const idsToDelete = Array.from(this.selectedMemories).map(idx => memories[idx]?.id).filter(Boolean);
      for (const id of idsToDelete) {
        await window.memoryEngine.deleteMemory(id);
      }
      this.showNotification('Selected memories deleted', 'success', 1500);
      this.showMemoryOverlay(); // Refresh overlay
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
    try {
      console.log('LocalBrain: Injecting selected memories, count:', this.selectedMemories.size);
      
      if (this.selectedMemories.size === 0) {
        this.showNotification('No memories selected', 'info');
        return;
      }

      const selectedMemoriesArray = Array.from(this.selectedMemories).map(index => memories[index]);
      console.log('LocalBrain: Selected memories:', selectedMemoriesArray);
      
      // Use the working getCurrentInput function
      const input = this.getCurrentInput();
      console.log('LocalBrain: Found input field:', input);
      
      if (!input) {
        this.showNotification('No input field found', 'error');
        return;
      }

      const currentText = this.getInputText(input);
      console.log('LocalBrain: Current input text:', currentText);
      
      const memoryText = this.formatMemoriesForInjection(selectedMemoriesArray);
      console.log('LocalBrain: Formatted memory text:', memoryText);
      
      const newText = memoryText + (currentText ? '\n\n' + currentText : '');
      console.log('LocalBrain: New text to set:', newText);
      
      // Use the working setInputText function
      this.setInputText(input, newText);
      
      // Show unified popup
      this.showMemoryInjectedPopup();
      
      this.closeMemoryOverlay();
      
    } catch (error) {
      console.error('LocalBrain: Error injecting selected memories:', error);
      this.showNotification('Failed to inject memories: ' + error.message, 'error');
    }
  }

  findChatInput() {
    console.log('LocalBrain: Finding chat input...');
    
    // Method 1: Try focused element first
    if (document.activeElement && this.isValidChatInput(document.activeElement)) {
      console.log('LocalBrain: Using focused element:', document.activeElement);
      return document.activeElement;
    }
    
    // Method 2: Try ALL textareas on the page (most aggressive)
    const allTextareas = document.querySelectorAll('textarea');
    console.log('LocalBrain: All textareas found:', allTextareas.length);
    
    // Filter and sort by size (largest first)
    const validTextareas = Array.from(allTextareas)
      .filter(el => this.isValidChatInput(el))
      .sort((a, b) => {
        const areaA = a.offsetWidth * a.offsetHeight;
        const areaB = b.offsetWidth * b.offsetHeight;
        return areaB - areaA; // Largest first
      });
    
    if (validTextareas.length > 0) {
      console.log('LocalBrain: Using largest valid textarea:', validTextareas[0]);
      return validTextareas[0];
    }
    
    // Method 3: Try any input field
    const allInputs = document.querySelectorAll('input[type="text"], input[type="search"]');
    console.log('LocalBrain: All inputs found:', allInputs.length);
    
    const validInputs = Array.from(allInputs)
      .filter(el => this.isValidChatInput(el))
      .sort((a, b) => {
        const areaA = a.offsetWidth * a.offsetHeight;
        const areaB = b.offsetWidth * b.offsetHeight;
        return areaB - areaA; // Largest first
      });
    
    if (validInputs.length > 0) {
      console.log('LocalBrain: Using largest valid input:', validInputs[0]);
      return validInputs[0];
    }
    
    // Method 4: Try contenteditable elements
    const contentEditables = document.querySelectorAll('[contenteditable="true"]');
    console.log('LocalBrain: Contenteditable elements found:', contentEditables.length);
    
    const validContentEditables = Array.from(contentEditables)
      .filter(el => this.isValidChatInput(el))
      .sort((a, b) => {
        const areaA = a.offsetWidth * a.offsetHeight;
        const areaB = b.offsetWidth * b.offsetHeight;
        return areaB - areaA; // Largest first
      });
    
    if (validContentEditables.length > 0) {
      console.log('LocalBrain: Using largest contenteditable:', validContentEditables[0]);
      return validContentEditables[0];
    }
    
    console.log('LocalBrain: No chat input found');
    return null;
  }

  isValidChatInput(element) {
    if (!element) return false;
    
    console.log('LocalBrain: Validating element:', element.tagName, element);
    
    // Must be visible
    if (!this.isVisible(element)) {
      console.log('LocalBrain: Element not visible');
      return false;
    }
    
    // Must have some size
    if (element.offsetWidth < 50 || element.offsetHeight < 20) {
      console.log('LocalBrain: Element too small:', element.offsetWidth, 'x', element.offsetHeight);
      return false;
    }
    
    // Skip obvious search inputs (but be less strict)
    const text = (element.placeholder || element.getAttribute('aria-label') || element.title || '').toLowerCase();
    if (text.includes('search for') || text.includes('find files') || text.includes('lookup')) {
      console.log('LocalBrain: Element appears to be search:', text);
      return false;
    }
    
    // Accept textarea, input, or contenteditable
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable) {
      console.log('LocalBrain: Element is valid input type');
      return true;
    }
    
    console.log('LocalBrain: Element type not supported:', element.tagName);
    return false;
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

  showMemoryInjectedPopup() {
    const popup = document.createElement('div');
    popup.className = 'LocalBrain-injection-popup';
    popup.innerHTML = `
      <div class="injection-content">
        <div class="injection-icon">🧠</div>
        <div class="injection-message">Memories added</div>
      </div>
    `;
    
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100002;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px 16px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideInRight 0.3s ease;
      max-width: 200px;
    `;
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(popup);
    
    // Auto-remove after 2 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
          popup.remove();
          style.remove();
        }, 300);
      }
    }, 2000);
  }

  highlightChatAreas() {
    // Find and highlight potential chat input areas
    const textareas = document.querySelectorAll('textarea:not([readonly]):not([disabled])');
    const inputs = document.querySelectorAll('input[type="text"]:not([readonly]):not([disabled])');
    
    const allInputs = [...textareas, ...inputs];
    console.log('LocalBrain: Highlighting potential chat areas:', allInputs.length);
    
    allInputs.forEach((input, index) => {
      if (!this.isVisible(input)) return;
      
      const originalBorder = input.style.border;
      const originalBoxShadow = input.style.boxShadow;
      
      // Add a subtle highlight
      input.style.border = '2px solid rgba(59, 130, 246, 0.6)';
      input.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.3)';
      
      // Add click handler to help user select the right input
      const clickHandler = () => {
        console.log('LocalBrain: User clicked on highlighted input:', input);
        this.showNotification('Input selected! Now try injecting memories again.', 'success');
        
        // Remove highlight and click handler
        input.style.border = originalBorder;
        input.style.boxShadow = originalBoxShadow;
        input.removeEventListener('click', clickHandler);
      };
      
      input.addEventListener('click', clickHandler);
      
      // Remove highlight after 5 seconds
      setTimeout(() => {
        input.style.border = originalBorder;
        input.style.boxShadow = originalBoxShadow;
        input.removeEventListener('click', clickHandler);
      }, 5000);
    });
    
    // Show instruction notification
    this.showNotification('Click on the highlighted chat input area, then try injecting memories again.', 'info', 5000);
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
      console.log('LocalBrain: Cleanup completed');
    } catch (error) {
      console.error('LocalBrain: Error during cleanup:', error);
    }
  }

  // Helper: Format memories for injection
  formatMemoriesForInjection(memories) {
    const memoryTexts = memories.map(m => m.content).join('\n• ');
    return `[Context from my previous conversations:\n• ${memoryTexts}]\n\n`;
  }

  // Helper: Get the current input field (textarea or input)



  isVisible(element) {
    return element.offsetParent !== null && 
           window.getComputedStyle(element).display !== 'none';
  }

  isChatInput(element) {
    if (!element) return false;
    
    // Check if it's a search field
    const placeholder = (element.placeholder || '').toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const className = (element.className || '').toLowerCase();
    
    if (placeholder.includes('search') || ariaLabel.includes('search') || className.includes('search')) {
      return false;
    }
    
    return true;
  }



}

// Global message listener setup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('LocalBrain: Global message listener received:', message);
  if (message.action === 'inject_memories') {
    if (window.LocalBrainIntegration) {
      window.LocalBrainIntegration.injectMemories();
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized'});
    }
  } else if (message.action === 'inject_selected_memories') {
    if (window.LocalBrainIntegration && message.memories) {
      window.LocalBrainIntegration.injectSpecificMemories(message.memories);
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized or no memories provided'});
    }
  } else if (message.action === 'show_memory_overlay') {
    if (window.LocalBrainIntegration) {
      window.LocalBrainIntegration.showMemoryOverlay();
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized'});
    }
  } else if (message.action === 'inject_memories_with_progress') {
    if (window.LocalBrainIntegration) {
      window.LocalBrainIntegration.injectMemoriesWithProgress();
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'Extension not initialized'});
    }
  }
  return true; // Keep the message channel open for async response
});

// Add debugging and improved initialization
console.log('LocalBrain: Content script loaded');

function initializeLocalBrain() {
  console.log('LocalBrain: Starting initialization process...');
  console.log('LocalBrain: Current URL:', window.location.href);
  console.log('LocalBrain: Document ready state:', document.readyState);
  console.log('LocalBrain: Body available:', !!document.body);
  
  try {
    // Show initialization start indicator
    if (document.body) {
      const initDiv = document.createElement('div');
      initDiv.id = 'LocalBrain-init-indicator';
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
      initDiv.textContent = 'LocalBrain: Loading...';
      document.body.appendChild(initDiv);
      
      // Remove indicator after 3 seconds
      setTimeout(() => {
        const indicator = document.getElementById('LocalBrain-init-indicator');
        if (indicator) {indicator.remove();}
      }, 3000);
    }
    
    console.log('LocalBrain: Creating integration instance...');
    window.LocalBrainIntegration = new LocalBrainIntegration();
    console.log('LocalBrain: Integration created successfully');
    console.log('LocalBrain: Platform detected:', window.LocalBrainIntegration.platform);
    
  } catch (error) {
    console.error('LocalBrain: Failed to initialize:', error);
    console.error('LocalBrain: Error stack:', error.stack);
    
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
        <div style="font-weight: bold; margin-bottom: 4px;">LocalBrain: Failed to load</div>
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
  document.addEventListener('DOMContentLoaded', initializeLocalBrain);
} else {
  // DOM is already ready
  if (document.body) {
    initializeLocalBrain();
  } else {
    // Wait for body to be available
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.body) {
        obs.disconnect();
        initializeLocalBrain();
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
  if (window.LocalBrainIntegration) {
    window.LocalBrainIntegration.cleanup();
  }
});
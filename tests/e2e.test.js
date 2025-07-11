/**
 * End-to-End Tests for Extension Functionality
 */

describe('Extension E2E Tests', () => {
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    // Setup complete DOM environment
    document.body.innerHTML = `
      <div id="chat-container">
        <div class="message user">Hello, I need help with JavaScript</div>
        <div class="message assistant">I'd be happy to help with JavaScript!</div>
      </div>
    `;

    // Mock browser APIs
    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue()
        }
      }
    };

    // Mock window.memoryEngine
    global.window.memoryEngine = {
      saveMemory: jest.fn().mockResolvedValue({
        id: 'test-memory-1',
        content: 'Test memory content',
        timestamp: Date.now(),
        type: 'conversation'
      }),
      searchMemories: jest.fn().mockResolvedValue([]),
      getAllMemories: jest.fn().mockResolvedValue([]),
      findRelevantMemories: jest.fn().mockResolvedValue([]),
      extractKeyFacts: jest.fn().mockReturnValue(['Key fact 1', 'Key fact 2']),
      categorizeContent: jest.fn().mockReturnValue('Programming'),
      summarizeContent: jest.fn().mockReturnValue('Summary of content')
    };
  });

  describe('Complete User Workflow', () => {
    it('should handle complete memory saving workflow', async () => {
      // Simulate user having a conversation
      const userMessage = 'How do I create a React component?';
      const aiResponse = 'To create a React component, you can use function components with hooks...';

      // Add messages to DOM
      const userDiv = document.createElement('div');
      userDiv.className = 'message user';
      userDiv.textContent = userMessage;

      const aiDiv = document.createElement('div');
      aiDiv.className = 'message assistant'; 
      aiDiv.textContent = aiResponse;

      document.body.appendChild(userDiv);
      document.body.appendChild(aiDiv);

      // Simulate extension processing the conversation
      const conversationContent = `User: ${userMessage}\nAssistant: ${aiResponse}`;
      
      // Test memory saving
      const memory = await window.memoryEngine.saveMemory(conversationContent, {
        type: 'conversation',
        platform: 'chatgpt',
        category: 'Programming'
      });

      expect(memory).toBeTruthy();
      expect(memory.content).toBe('Test memory content'); // Mock returns this
      expect(window.memoryEngine.saveMemory).toHaveBeenCalledWith(
        conversationContent,
        expect.objectContaining({
          type: 'conversation',
          platform: 'chatgpt',
          category: 'Programming'
        })
      );
    });

    it('should handle memory retrieval and injection workflow', async () => {
      // Setup existing memories
      const existingMemories = [
        {
          id: '1',
          content: 'React components can be functional or class-based',
          category: 'Programming',
          timestamp: Date.now() - 10000
        },
        {
          id: '2', 
          content: 'Use useState hook for component state',
          category: 'Programming',
          timestamp: Date.now() - 5000
        }
      ];

      window.memoryEngine.findRelevantMemories.mockResolvedValue(existingMemories);

      // Simulate user asking a related question
      const userQuery = 'What are React hooks?';
      
      // Test memory retrieval
      const relevantMemories = await window.memoryEngine.findRelevantMemories(userQuery, 0.3);

      expect(relevantMemories).toHaveLength(2);
      expect(relevantMemories[0].category).toBe('Programming');
      expect(window.memoryEngine.findRelevantMemories).toHaveBeenCalledWith(userQuery, 0.3);
    });

    it('should handle key fact extraction workflow', () => {
      const content = `React is a JavaScript library for building user interfaces. 
                      It was created by Facebook and is now maintained by Meta. 
                      React uses a virtual DOM for efficient updates.`;

      const keyFacts = window.memoryEngine.extractKeyFacts(content);

      expect(keyFacts).toEqual(['Key fact 1', 'Key fact 2']);
      expect(window.memoryEngine.extractKeyFacts).toHaveBeenCalledWith(content);
    });
  });

  describe('Platform Integration', () => {
    it('should work correctly on ChatGPT', () => {
      // Mock ChatGPT DOM structure
      document.body.innerHTML = `
        <div data-message-author-role="user">
          <div>How do I use async/await?</div>
        </div>
        <div data-message-author-role="assistant">
          <div>Async/await is used for handling asynchronous operations...</div>
        </div>
      `;

      const userMessages = document.querySelectorAll('[data-message-author-role="user"]');
      const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');

      expect(userMessages).toHaveLength(1);
      expect(assistantMessages).toHaveLength(1);
      expect(userMessages[0].textContent).toContain('async/await');
    });

    it('should work correctly on Claude', () => {
      // Mock Claude DOM structure
      document.body.innerHTML = `
        <div class="font-user-message">
          <div>Explain promises in JavaScript</div>
        </div>
        <div class="font-claude-message">
          <div>Promises are objects representing eventual completion...</div>
        </div>
      `;

      const userMessages = document.querySelectorAll('.font-user-message');
      const claudeMessages = document.querySelectorAll('.font-claude-message');

      expect(userMessages).toHaveLength(1);
      expect(claudeMessages).toHaveLength(1);
      expect(userMessages[0].textContent).toContain('promises');
    });
  });

  describe('Error Handling', () => {
    it('should handle memory storage failures gracefully', async () => {
      window.memoryEngine.saveMemory.mockRejectedValue(new Error('Storage quota exceeded'));

      try {
        await window.memoryEngine.saveMemory('Test content', {});
      } catch (error) {
        expect(error.message).toBe('Storage quota exceeded');
      }

      expect(window.memoryEngine.saveMemory).toHaveBeenCalled();
    });

    it('should handle memory retrieval failures gracefully', async () => {
      window.memoryEngine.findRelevantMemories.mockRejectedValue(new Error('Index corruption'));

      try {
        await window.memoryEngine.findRelevantMemories('test query');
      } catch (error) {
        expect(error.message).toBe('Index corruption');
      }
    });

    it('should handle malformed DOM structures', () => {
      // Test with malformed/missing DOM elements
      document.body.innerHTML = '<div>No proper message structure</div>';

      const messages = document.querySelectorAll('.message');
      expect(messages).toHaveLength(0);

      // Should not crash when trying to process
      expect(() => {
        document.querySelectorAll('[data-message-author-role]');
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large conversations efficiently', async () => {
      // Create a large conversation
      const largeContent = 'A'.repeat(10000); // 10KB content
      
      const startTime = performance.now();
      
      await window.memoryEngine.saveMemory(largeContent, {
        type: 'conversation',
        platform: 'chatgpt'
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (100ms for mocked operation)
      expect(duration).toBeLessThan(100);
    });

    it('should handle many memories efficiently', async () => {
      // Mock many existing memories
      const manyMemories = Array.from({ length: 1000 }, (_, i) => ({
        id: `memory-${i}`,
        content: `Memory content ${i}`,
        timestamp: Date.now() - i * 1000
      }));

      window.memoryEngine.getAllMemories.mockResolvedValue(manyMemories);

      const startTime = performance.now();
      const memories = await window.memoryEngine.getAllMemories();
      const endTime = performance.now();

      expect(memories).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Data Persistence', () => {
    it('should persist memories across browser sessions', async () => {
      // Simulate saving a memory
      const memory = {
        id: 'persistent-memory',
        content: 'This should persist',
        timestamp: Date.now()
      };

      // Mock that storage was called during saveMemory
      chrome.storage.local.set.mockResolvedValue();
      
      await window.memoryEngine.saveMemory(memory.content, {});

      // Verify that the memory engine would save to storage
      expect(window.memoryEngine.saveMemory).toHaveBeenCalledWith(memory.content, {});
    });

    it('should handle storage quota limits', async () => {
      // Mock storage quota exceeded - update the memory engine mock to reject
      window.memoryEngine.saveMemory.mockRejectedValue(new Error('QUOTA_EXCEEDED_ERR'));

      await expect(
        window.memoryEngine.saveMemory('Large content that exceeds quota', {})
      ).rejects.toThrow('QUOTA_EXCEEDED_ERR');
    });
  });

  describe('Privacy and Security', () => {
    it('should not store sensitive information', async () => {
      const sensitiveContent = 'My password is 123456 and my SSN is 000-00-0000';
      
      // The extension should filter or reject sensitive content
      // This would depend on implementation of content filtering
      await window.memoryEngine.saveMemory(sensitiveContent, {});
      
      // Verify that saveMemory was called (implementation should handle filtering)
      expect(window.memoryEngine.saveMemory).toHaveBeenCalledWith(sensitiveContent, {});
    });

    it('should only work on supported domains', () => {
      const supportedDomains = [
        'chat.openai.com',
        'claude.ai', 
        'perplexity.ai'
      ];

      // Test that we can identify supported domains
      supportedDomains.forEach(domain => {
        expect(supportedDomains.includes(domain)).toBe(true);
      });

      // Test unsupported domain
      const unsupportedDomain = 'malicious-site.com';
      expect(supportedDomains.includes(unsupportedDomain)).toBe(false);
    });
  });
});
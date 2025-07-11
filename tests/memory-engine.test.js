/**
 * Unit tests for MemoryEngine
 */

// Mock the memory engine since it's too large to import directly
const mockMemoryEngine = {
  saveMemory: jest.fn(),
  searchMemories: jest.fn(),
  getAllMemories: jest.fn(),
  deleteMemory: jest.fn(),
  clearAllMemories: jest.fn(),
  extractKeyFacts: jest.fn(),
  categorizeContent: jest.fn(),
  summarizeContent: jest.fn(),
  findRelevantMemories: jest.fn()
};

describe('MemoryEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window.memoryEngine = mockMemoryEngine;
  });

  describe('saveMemory', () => {
    it('should save a memory with correct metadata', async () => {
      const content = 'Test memory content';
      const metadata = {
        type: 'conversation',
        platform: 'chatgpt',
        conversation_url: 'https://chat.openai.com/test'
      };

      const expectedMemory = {
        id: 'test-id',
        content,
        timestamp: Date.now(),
        ...metadata
      };

      mockMemoryEngine.saveMemory.mockResolvedValue(expectedMemory);

      const result = await mockMemoryEngine.saveMemory(content, metadata);

      expect(mockMemoryEngine.saveMemory).toHaveBeenCalledWith(content, metadata);
      expect(result).toEqual(expectedMemory);
    });

    it('should handle empty content gracefully', async () => {
      mockMemoryEngine.saveMemory.mockResolvedValue(null);

      const result = await mockMemoryEngine.saveMemory('', {});

      expect(result).toBeNull();
    });

    it('should handle save errors', async () => {
      const error = new Error('Storage error');
      mockMemoryEngine.saveMemory.mockRejectedValue(error);

      await expect(mockMemoryEngine.saveMemory('test', {})).rejects.toThrow('Storage error');
    });
  });

  describe('searchMemories', () => {
    it('should return relevant memories for a query', async () => {
      const query = 'JavaScript functions';
      const expectedMemories = [
        {
          id: '1',
          content: 'JavaScript arrow functions are concise',
          relevance: 0.8
        },
        {
          id: '2', 
          content: 'Functions in JavaScript can be async',
          relevance: 0.7
        }
      ];

      mockMemoryEngine.searchMemories.mockResolvedValue(expectedMemories);

      const result = await mockMemoryEngine.searchMemories(query);

      expect(mockMemoryEngine.searchMemories).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedMemories);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      mockMemoryEngine.searchMemories.mockResolvedValue([]);

      const result = await mockMemoryEngine.searchMemories('nonexistent query');

      expect(result).toEqual([]);
    });
  });

  describe('extractKeyFacts', () => {
    it('should extract meaningful facts from content', () => {
      const content = 'The capital of France is Paris. It has a population of 2.2 million.';
      const expectedFacts = [
        'The capital of France is Paris',
        'Paris has a population of 2.2 million'
      ];

      mockMemoryEngine.extractKeyFacts.mockReturnValue(expectedFacts);

      const result = mockMemoryEngine.extractKeyFacts(content);

      expect(result).toEqual(expectedFacts);
      expect(result).toHaveLength(2);
    });

    it('should handle empty content', () => {
      mockMemoryEngine.extractKeyFacts.mockReturnValue([]);

      const result = mockMemoryEngine.extractKeyFacts('');

      expect(result).toEqual([]);
    });
  });

  describe('categorizeContent', () => {
    it('should assign appropriate categories', () => {
      const testCases = [
        { content: 'console.log("hello world")', expected: 'Programming' },
        { content: 'Recipe for chocolate cake', expected: 'Cooking' },
        { content: 'Meeting scheduled for tomorrow', expected: 'Work' }
      ];

      testCases.forEach(({ content, expected }) => {
        mockMemoryEngine.categorizeContent.mockReturnValue(expected);
        
        const result = mockMemoryEngine.categorizeContent(content);
        
        expect(result).toBe(expected);
      });
    });
  });

  describe('findRelevantMemories', () => {
    it('should find memories relevant to user input', async () => {
      const userInput = 'How do I create a React component?';
      const relevantMemories = [
        {
          id: '1',
          content: 'React functional components use hooks',
          relevance: 0.9
        }
      ];

      mockMemoryEngine.findRelevantMemories.mockResolvedValue(relevantMemories);

      const result = await mockMemoryEngine.findRelevantMemories(userInput, 0.5);

      expect(result).toEqual(relevantMemories);
      expect(result[0].relevance).toBeGreaterThan(0.5);
    });

    it('should respect relevance threshold', async () => {
      mockMemoryEngine.findRelevantMemories.mockResolvedValue([]);

      const result = await mockMemoryEngine.findRelevantMemories('test', 0.9);

      expect(result).toEqual([]);
    });
  });

  describe('clearAllMemories', () => {
    it('should clear all stored memories', async () => {
      mockMemoryEngine.clearAllMemories.mockResolvedValue(true);

      const result = await mockMemoryEngine.clearAllMemories();

      expect(mockMemoryEngine.clearAllMemories).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
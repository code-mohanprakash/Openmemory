/**
 * LocalBrain Engine - Local AI Memory Management
 * Stores and retrieves memories locally using Chrome storage
 */

class MemoryEngine {
  constructor() {
    this.memories = [];
    this.initialized = false;
    this.maxMemories = 1000; // Limit to prevent storage overflow
    this.pageSize = 50; // Pagination for large datasets
    this.currentPage = 0;
    this.searchCache = new Map(); // Cache search results
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async init() {
    if (this.initialized) {return;}
    
    try {
      const result = await chrome.storage.local.get(['LocalBrain_data']);
      this.memories = result.LocalBrain_data || [];
      this.initialized = true;
      console.log('LocalBrain: Loaded', this.memories.length, 'memories');
      
      // Clean up old memories if needed
      await this.cleanupOldMemories();
    } catch (error) {
      console.error('LocalBrain: Failed to load memories:', error);
      this.memories = [];
      this.initialized = true;
    }
  }

  async saveMemory(content, metadata = {}) {
    await this.init();
    
    // Use backend integration if available, otherwise fallback to local processing
    let category, summary, tags;
    
    if (window.backendIntegration) {
      try {
        category = await window.backendIntegration.categorizeContent(content);
        summary = await window.backendIntegration.generateSummary(content);
        tags = await window.backendIntegration.extractTags(content);
      } catch (error) {
        console.warn('LocalBrain: Backend processing failed, using fallback:', error);
        category = this.categorizeContent(content);
        summary = this.generateSummary(content);
        tags = this.extractTags(content);
      }
    } else {
      category = this.categorizeContent(content);
      summary = this.generateSummary(content);
      tags = this.extractTags(content);
    }
    
    const memory = {
      id: Date.now() + Math.random(),
      content: content.trim(),
      timestamp: Date.now(),
      source: window.location.hostname,
      url: window.location.href,
      conversationId: this.getCurrentConversationId(),
      category: category,
      summary: summary,
      tags: tags,
      ...metadata
    };

    // Check for duplicates
    if (this.isDuplicate(memory)) {
      console.log('LocalBrain: Skipping duplicate memory');
      return null;
    }

    // Check if we should append to existing conversation memory
    const existingConversation = this.findActiveConversation(memory);
    if (existingConversation) {
      // Append to existing conversation
      existingConversation.content += '\n\n' + memory.content;
      existingConversation.timestamp = Date.now(); // Update timestamp
      existingConversation.lastUpdated = Date.now();
      existingConversation.category = this.categorizeContent(existingConversation.content); // Re-categorize
      existingConversation.summary = this.generateSummary(existingConversation.content); // Re-summarize
      existingConversation.tags = this.extractTags(existingConversation.content); // Re-extract tags
      await this.persist();
      console.log('LocalBrain: Appended to existing conversation:', existingConversation.content.substring(0, 50) + '...');
      return existingConversation;
    }

    // Create new memory
    this.memories.unshift(memory);
    
    // Limit memory count
    if (this.memories.length > this.maxMemories) {
      this.memories = this.memories.slice(0, this.maxMemories);
    }

    // Clear search cache when new memory is added
    this.searchCache.clear();

    await this.persist();
    console.log('LocalBrain: Saved new memory:', memory.content.substring(0, 50) + '...');
    return memory;
  }

  // Enhanced duplicate detection with fuzzy matching
  isDuplicate(newMemory) {
    return this.memories.some(memory => 
      memory.content === newMemory.content || 
      this.calculateSimilarity(memory.content, newMemory.content) > 0.85 // Lowered threshold for better detection
    );
  }

  calculateSimilarity(text1, text2) {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  // Enhanced memory retrieval with pagination
  async getRelevantMemories(query, limit = 5, page = 0) {
    await this.init();
    
    if (!query || query.trim().length < 3) {
      const start = page * this.pageSize;
      const end = start + limit;
      return this.memories.slice(start, end);
    }

    // Check cache first
    const cacheKey = `${query}_${limit}_${page}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.results;
    }

    // Use TF-IDF for better relevance scoring
    const scored = this.calculateTFIDFScores(query, this.memories);

    const results = scored
      .filter(memory => memory.score > 0.05) // Lower threshold for TF-IDF
      .sort((a, b) => b.score - a.score)
      .slice(page * limit, (page + 1) * limit);

    // Cache results
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    return results;
  }

  // Get memories with pagination
  async getMemoriesPage(page = 0, filters = {}) {
    await this.init();
    
    let filteredMemories = this.memories;
    
    // Apply filters
    if (filters.category) {
      filteredMemories = filteredMemories.filter(m => m.category === filters.category);
    }
    if (filters.platform) {
      filteredMemories = filteredMemories.filter(m => m.source.includes(filters.platform));
    }
    if (filters.dateFrom) {
      filteredMemories = filteredMemories.filter(m => m.timestamp >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filteredMemories = filteredMemories.filter(m => m.timestamp <= filters.dateTo);
    }
    if (filters.tags && filters.tags.length > 0) {
      filteredMemories = filteredMemories.filter(m => 
        m.tags && filters.tags.some(tag => m.tags.includes(tag))
      );
    }

    const start = page * this.pageSize;
    const end = start + this.pageSize;
    
    return {
      memories: filteredMemories.slice(start, end),
      total: filteredMemories.length,
      page,
      totalPages: Math.ceil(filteredMemories.length / this.pageSize)
    };
  }

  // TF-IDF Implementation for better memory relevance scoring
  calculateTFIDFScores(query, memories) {
    if (memories.length === 0) {return [];}

    const queryTerms = this.preprocessText(query);
    const documents = memories.map(memory => ({
      ...memory,
      terms: this.preprocessText(memory.content + ' ' + (memory.summary || '') + ' ' + (memory.tags || []).join(' '))
    }));

    // Calculate TF-IDF scores for each memory
    return documents.map(doc => ({
      ...doc,
      score: this.calculateDocumentScore(queryTerms, doc.terms, documents)
    }));
  }

  // Preprocess text: tokenize, lowercase, remove stopwords, stem
  preprocessText(text) {
    if (!text) {return [];}
    
    // Tokenize and clean
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Remove common stopwords
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
      'what', 'where', 'when', 'why', 'how', 'which', 'who', 'whom', 'whose',
      'if', 'then', 'else', 'so', 'because', 'since', 'while', 'during', 'before', 'after',
      'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
      'once', 'here', 'there', 'everywhere', 'anywhere', 'somewhere', 'nowhere',
      'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'now'
    ]);

    return words.filter(word => !stopwords.has(word));
  }

  // Calculate TF-IDF score for a document against query terms
  calculateDocumentScore(queryTerms, docTerms, allDocuments) {
    let score = 0;
    const docTermCounts = this.getTermFrequencies(docTerms);
    const docLength = docTerms.length;

    queryTerms.forEach(queryTerm => {
      // Term Frequency (TF) - normalized by document length
      const tf = (docTermCounts[queryTerm] || 0) / Math.max(docLength, 1);
      
      // Inverse Document Frequency (IDF)
      const idf = this.calculateIDF(queryTerm, allDocuments);
      
      // TF-IDF score
      score += tf * idf;
    });

    // Normalize by query length and add category bonus
    score = score / Math.max(queryTerms.length, 1);
    
    return score;
  }

  // Calculate term frequencies in a document
  getTermFrequencies(terms) {
    const frequencies = {};
    terms.forEach(term => {
      frequencies[term] = (frequencies[term] || 0) + 1;
    });
    return frequencies;
  }

  // Calculate Inverse Document Frequency for a term
  calculateIDF(term, documents) {
    const documentsWithTerm = documents.filter(doc => 
      doc.terms.includes(term)
    ).length;
    
    if (documentsWithTerm === 0) {return 0;}
    
    // IDF = log(total_documents / documents_containing_term)
    return Math.log(documents.length / documentsWithTerm);
  }

  // Legacy method for backward compatibility
  calculateRelevanceScore(content, queryWords) {
    const contentWords = content.toLowerCase().split(/\s+/);
    let score = 0;
    
    queryWords.forEach(word => {
      const wordCount = contentWords.filter(cw => cw.includes(word)).length;
      score += wordCount;
    });
    
    return score / queryWords.length;
  }

  async getMemoryStats() {
    await this.init();
    
    const categories = {};
    const platforms = {};
    const tags = {};
    
    this.memories.forEach(memory => {
      // Count categories
      categories[memory.category] = (categories[memory.category] || 0) + 1;
      
      // Count platforms
      platforms[memory.source] = (platforms[memory.source] || 0) + 1;
      
      // Count tags
      if (memory.tags) {
        memory.tags.forEach(tag => {
          tags[tag] = (tags[tag] || 0) + 1;
        });
      }
    });

    return {
      total: this.memories.length,
      categories,
      platforms,
      tags,
      recent: this.memories.slice(0, 5),
      averageLength: this.memories.reduce((sum, m) => sum + m.content.length, 0) / Math.max(this.memories.length, 1)
    };
  }

  async getAllMemories() {
    await this.init();
    return this.memories;
  }

  async clearAllMemories() {
    this.memories = [];
    this.searchCache.clear();
    await this.persist();
  }

  async deleteMemory(id) {
    this.memories = this.memories.filter(m => m.id !== id);
    this.searchCache.clear();
    await this.persist();
  }

  async persist() {
    try {
      await chrome.storage.local.set({ LocalBrain_data: this.memories });
    } catch (error) {
      console.error('LocalBrain: Failed to persist memories:', error);
    }
  }

  // Enhanced key facts extraction
  async extractKeyFacts(content) {
    // Use backend integration if available for more accurate fact extraction
    if (window.backendIntegration) {
      try {
        return await window.backendIntegration.extractFacts(content);
      } catch (error) {
        console.warn('LocalBrain: Backend fact extraction failed, using fallback:', error);
      }
    }
    
    // Fallback to local logic
    const facts = [];
    
    // Extract numbered lists
    const numberedMatches = content.match(/\d+\.\s+([^.\n]+)/g);
    if (numberedMatches) {
      facts.push(...numberedMatches.map(match => match.replace(/^\d+\.\s+/, '')));
    }
    
    // Extract bullet points
    const bulletMatches = content.match(/[-•*]\s+([^.\n]+)/g);
    if (bulletMatches) {
      facts.push(...bulletMatches.map(match => match.replace(/^[-•*]\s+/, '')));
    }
    
    // Extract sentences with key phrases
    const sentences = content.split(/[.!?]+/);
    const keyPhrases = ['important', 'key', 'note', 'remember', 'essential', 'critical'];
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && keyPhrases.some(phrase => 
        trimmed.toLowerCase().includes(phrase)
      )) {
        facts.push(trimmed);
      }
    });
    
    return facts.slice(0, 5); // Limit to 5 facts
  }

  // Enhanced content worthiness check
  async isWorthSaving(content) {
    if (!content || content.length < 20) {return false;}
    
    // Use backend integration if available for more accurate assessment
    if (window.backendIntegration) {
      try {
        return await window.backendIntegration.isWorthSaving(content);
      } catch (error) {
        console.warn('LocalBrain: Backend worth-saving check failed, using fallback:', error);
      }
    }
    
    // Fallback to local logic
    // Check for AI response patterns
    const aiPatterns = [
      /here's|here is/i,
      /i can help/i,
      /let me explain/i,
      /based on/i,
      /according to/i,
      /in summary/i,
      /to answer your question/i
    ];
    
    const hasAIPattern = aiPatterns.some(pattern => pattern.test(content));
    
    // Check for structured content
    const hasStructure = /^\s*[-•*]\s|^\s*\d+\.\s|:\s*$/.test(content);
    
    // Check for code blocks
    const hasCode = /```[\s\S]*```|`[^`]+`/.test(content);
    
    // Check for URLs
    const hasURLs = /https?:\/\/[^\s]+/.test(content);
    
    // Check for technical terms
    const technicalTerms = /api|function|class|method|algorithm|database|server|client|framework|library/i;
    const hasTechnicalContent = technicalTerms.test(content);
    
    return hasAIPattern || hasStructure || hasCode || hasURLs || hasTechnicalContent || content.length > 100;
  }

  getCurrentConversationId() {
    // Generate conversation ID based on URL and timestamp
    const url = window.location.href;
    const timestamp = Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute windows
    return `${url}_${timestamp}`;
  }

  findActiveConversation(newMemory) {
    const currentTime = Date.now();
    const timeWindow = 30 * 60 * 1000; // 30 minutes
    
    return this.memories.find(memory => {
      // Check if memory is from same conversation and recent
      const timeDiff = currentTime - memory.timestamp;
      const sameConversation = memory.conversationId === newMemory.conversationId;
      const isRecent = timeDiff < timeWindow;
      
      return sameConversation && isRecent;
    });
  }

  isSimilarTopic(content1, content2) {
    const getKeywords = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 10);
    };
    
    const keywords1 = getKeywords(content1);
    const keywords2 = getKeywords(content2);
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    return commonKeywords.length >= 2;
  }

  shouldGroupInSameConversation(content1, content2) {
    const getKeywords = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 10);
    };
    
    const keywords1 = getKeywords(content1);
    const keywords2 = getKeywords(content2);
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    const similarity = commonKeywords.length / Math.max(keywords1.length, keywords2.length);
    
    return similarity > 0.3; // 30% keyword overlap
  }

  // Enhanced categorization
  categorizeContent(content) {
    const text = content.toLowerCase();
    
    if (text.includes('code') || text.includes('function') || text.includes('api') || /```[\s\S]*```/.test(content)) {
      return 'code';
    }
    if (text.includes('error') || text.includes('bug') || text.includes('fix') || text.includes('issue')) {
      return 'troubleshooting';
    }
    if (text.includes('how to') || text.includes('tutorial') || text.includes('guide') || text.includes('step')) {
      return 'how-to';
    }
    if (text.includes('explain') || text.includes('what is') || text.includes('definition')) {
      return 'explanation';
    }
    if (text.includes('compare') || text.includes('difference') || text.includes('vs')) {
      return 'comparison';
    }
    if (text.includes('best') || text.includes('recommend') || text.includes('suggest')) {
      return 'recommendation';
    }
    if (text.includes('example') || text.includes('sample') || text.includes('instance')) {
      return 'example';
    }

    return 'general';
  }

  // Enhanced summary generation
  generateSummary(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) {return content.substring(0, 100);}
    
    // Take first 2-3 sentences or first 150 characters
    const summary = sentences.slice(0, 3).join('. ');
    return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
  }

  // Extract tags from content
  extractTags(content) {
    const tags = [];
    const text = content.toLowerCase();
    
    // Extract hashtags
    const hashtags = content.match(/#[\w]+/g) || [];
    tags.push(...hashtags.map(tag => tag.substring(1)));
    
    // Extract technical terms
    const technicalTerms = [
      'javascript', 'python', 'react', 'node', 'api', 'database', 'server', 'client',
      'html', 'css', 'sql', 'git', 'docker', 'aws', 'cloud', 'security', 'performance'
    ];
    
    technicalTerms.forEach(term => {
      if (text.includes(term)) {
        tags.push(term);
      }
    });
    
    return [...new Set(tags)]; // Remove duplicates
  }

  // Enhanced search with filters
  async searchMemories(query, filters = {}) {
    await this.init();
    
    if (!query && Object.keys(filters).length === 0) {
      return this.getMemoriesPage(0, filters);
    }
    
    let results = this.memories;
    
    // Apply text search
    if (query) {
      const queryTerms = query.toLowerCase().split(/\s+/);
      results = results.filter(memory => {
        const content = (memory.content + ' ' + (memory.summary || '') + ' ' + (memory.tags || []).join(' ')).toLowerCase();
        return queryTerms.some(term => content.includes(term));
      });
    }

    // Apply filters
    if (filters.category) {
      results = results.filter(m => m.category === filters.category);
    }
    if (filters.platform) {
      results = results.filter(m => m.source.includes(filters.platform));
    }
    if (filters.dateFrom) {
      results = results.filter(m => m.timestamp >= filters.dateFrom);
    }
    if (filters.dateTo) {
      results = results.filter(m => m.timestamp <= filters.dateTo);
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(m => 
        m.tags && filters.tags.some(tag => m.tags.includes(tag))
      );
    }
    
    // Sort by relevance or date
    if (query) {
      const scored = this.calculateTFIDFScores(query, results);
      results = scored.sort((a, b) => b.score - a.score);
    } else {
      results = results.sort((a, b) => b.timestamp - a.timestamp);
    }

    return {
      memories: results,
      total: results.length,
      query,
      filters
    };
  }

  // Export memories in different formats
  async exportMemories(format = 'json') {
    await this.init();
    
    switch (format) {
      case 'json':
      return JSON.stringify(this.memories, null, 2);
      case 'csv':
      return this.exportToCSV();
      case 'text':
      return this.exportToText();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportToCSV() {
    const headers = ['id', 'content', 'timestamp', 'source', 'url', 'category', 'summary', 'tags'];
    const csvRows = [headers.join(',')];
    
    this.memories.forEach(memory => {
      const row = headers.map(header => {
        let value = memory[header] || '';
        if (Array.isArray(value)) {
          value = value.join(';');
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  exportToText() {
    return this.memories.map(memory => {
      return `=== Memory ${memory.id} ===
Date: ${new Date(memory.timestamp).toISOString()}
Source: ${memory.source}
Category: ${memory.category}
Tags: ${(memory.tags || []).join(', ')}
URL: ${memory.url}

${memory.content}

${memory.summary ? `Summary: ${memory.summary}` : ''}

`;
    }).join('\n');
  }

  // Import memories
  async importMemories(jsonData, merge = true) {
    try {
      const importedMemories = JSON.parse(jsonData);
      
      if (!Array.isArray(importedMemories)) {
        throw new Error('Invalid import format: expected array of memories');
      }

      if (merge) {
        // Merge with existing memories, avoiding duplicates
        const existingIds = new Set(this.memories.map(m => m.id));
        const newMemories = importedMemories.filter(m => !existingIds.has(m.id));
        this.memories = [...newMemories, ...this.memories];
      } else {
        // Replace existing memories
        this.memories = importedMemories;
      }

      // Clear cache
      this.searchCache.clear();

      await this.persist();
      return {
        imported: importedMemories.length,
        total: this.memories.length
      };
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import memories: ' + error.message);
    }
  }

  // Get memory analytics
  async getMemoryAnalytics() {
    await this.init();
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    
    const recent = this.memories.filter(m => now - m.timestamp < oneDay);
    const weekly = this.memories.filter(m => now - m.timestamp < oneWeek);
    const monthly = this.memories.filter(m => now - m.timestamp < oneMonth);
    
    const categories = {};
    const platforms = {};
    const tags = {};

    this.memories.forEach(memory => {
      categories[memory.category] = (categories[memory.category] || 0) + 1;
      platforms[memory.source] = (platforms[memory.source] || 0) + 1;
      
      if (memory.tags) {
        memory.tags.forEach(tag => {
          tags[tag] = (tags[tag] || 0) + 1;
        });
      }
    });
    
    return {
      total: this.memories.length,
      recent: recent.length,
      weekly: weekly.length,
      monthly: monthly.length,
      categories,
      platforms,
      tags,
      averageLength: this.memories.reduce((sum, m) => sum + m.content.length, 0) / Math.max(this.memories.length, 1),
      topCategories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topPlatforms: Object.entries(platforms).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topTags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 10)
    };
  }

  // Clean up old memories
  async cleanupOldMemories() {
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    const now = Date.now();
    
    const originalCount = this.memories.length;
    this.memories = this.memories.filter(memory => 
      now - memory.timestamp < maxAge
    );
    
    const removedCount = originalCount - this.memories.length;
    if (removedCount > 0) {
      console.log(`LocalBrain: Cleaned up ${removedCount} old memories`);
      await this.persist();
    }
  }

  // Delete memory by ID
  async deleteMemoryById(id) {
    const index = this.memories.findIndex(m => m.id === id);
    if (index !== -1) {
      this.memories.splice(index, 1);
      this.searchCache.clear();
      await this.persist();
      return true;
    }
    return false;
  }

  // Update memory
  async updateMemory(id, updates) {
    const memory = this.memories.find(m => m.id === id);
    if (memory) {
      Object.assign(memory, updates);
      memory.lastUpdated = Date.now();
      this.searchCache.clear();
      await this.persist();
      return memory;
    }
    return null;
  }

  // Deduplicate memories
  async deduplicateMemories() {
    const seen = new Set();
    const duplicates = [];
    
    this.memories = this.memories.filter(memory => {
      const signature = this.createMemorySignature(memory);
      if (seen.has(signature)) {
        duplicates.push(memory);
        return false;
      }
      seen.add(signature);
      return true;
    });

    if (duplicates.length > 0) {
      console.log(`LocalBrain: Removed ${duplicates.length} duplicate memories`);
      this.searchCache.clear();
      await this.persist();
    }

    return duplicates.length;
  }

  createMemorySignature(memory) {
    // Create a signature for duplicate detection
    const content = memory.content.toLowerCase().replace(/\s+/g, ' ').trim();
    const source = memory.source;
    return `${source}:${content.substring(0, 100)}`;
  }
}

// Create global instance
window.memoryEngine = new MemoryEngine();
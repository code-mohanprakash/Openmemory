/**
 * LocalBrain Backend Integration
 * Handles communication with Python backend for high-accuracy NLP processing
 */

class BackendIntegration {
  constructor() {
    this.backendUrl = 'http://localhost:5001';
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.fallbackMode = false;
    
    console.log('LocalBrain: Backend integration initialized');
    this.checkConnection();
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.backendUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log('LocalBrain: Backend connected successfully', data);
        return true;
      } else {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('LocalBrain: Backend connection failed:', error.message);
      this.isConnected = false;
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`LocalBrain: Retrying backend connection (${this.connectionRetries}/${this.maxRetries})`);
        setTimeout(() => this.checkConnection(), this.retryDelay);
      } else {
        console.warn('LocalBrain: Backend unavailable, using fallback mode');
        this.fallbackMode = true;
      }
      return false;
    }
  }

  async processContent(content) {
    if (!this.isConnected || this.fallbackMode) {
      console.log('LocalBrain: Using fallback processing');
      return this.fallbackProcessContent(content);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/process-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('LocalBrain: Backend processed content successfully');
        return result.result;
      } else {
        throw new Error(`Backend processing failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend processing error:', error);
      return this.fallbackProcessContent(content);
    }
  }

  async categorizeContent(content) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackCategorizeContent(content);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        return result.category;
      } else {
        throw new Error(`Backend categorization failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend categorization error:', error);
      return this.fallbackCategorizeContent(content);
    }
  }

  async generateSummary(content, maxLength = 150) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackGenerateSummary(content, maxLength);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content, max_length: maxLength })
      });

      if (response.ok) {
        const result = await response.json();
        return result.summary;
      } else {
        throw new Error(`Backend summarization failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend summarization error:', error);
      return this.fallbackGenerateSummary(content, maxLength);
    }
  }

  async extractTags(content) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackExtractTags(content);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/extract-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        return result.tags;
      } else {
        throw new Error(`Backend tag extraction failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend tag extraction error:', error);
      return this.fallbackExtractTags(content);
    }
  }

  async searchMemories(query, memories, limit = 5) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackSearchMemories(query, memories, limit);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/search-memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, memories, limit })
      });

      if (response.ok) {
        const result = await response.json();
        return result.results;
      } else {
        throw new Error(`Backend memory search failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend memory search error:', error);
      return this.fallbackSearchMemories(query, memories, limit);
    }
  }

  async extractFacts(content) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackExtractFacts(content);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/extract-facts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        return result.facts;
      } else {
        throw new Error(`Backend fact extraction failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend fact extraction error:', error);
      return this.fallbackExtractFacts(content);
    }
  }

  async isWorthSaving(content) {
    if (!this.isConnected || this.fallbackMode) {
      return this.fallbackIsWorthSaving(content);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/is-worth-saving`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        return result.worth_saving;
      } else {
        throw new Error(`Backend worth-saving check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('LocalBrain: Backend worth-saving check error:', error);
      return this.fallbackIsWorthSaving(content);
    }
  }

  // Fallback methods using existing JavaScript logic
  fallbackProcessContent(content) {
    console.log('LocalBrain: Using fallback content processing');
    
    return {
      worth_saving: this.fallbackIsWorthSaving(content),
      category: this.fallbackCategorizeContent(content),
      summary: this.fallbackGenerateSummary(content),
      tags: this.fallbackExtractTags(content),
      facts: this.fallbackExtractFacts(content),
      processing_time: 0.1
    };
  }

  fallbackCategorizeContent(content) {
    const text = content.toLowerCase();
    
    if (text.includes('code') || text.includes('function') || text.includes('api') || /```[\s\S]*```/.test(content)) {
      return { category: 'code', confidence: 0.8 };
    }
    if (text.includes('error') || text.includes('bug') || text.includes('fix') || text.includes('issue')) {
      return { category: 'troubleshooting', confidence: 0.8 };
    }
    if (text.includes('how to') || text.includes('tutorial') || text.includes('guide') || text.includes('step')) {
      return { category: 'how-to', confidence: 0.8 };
    }
    if (text.includes('explain') || text.includes('what is') || text.includes('definition')) {
      return { category: 'explanation', confidence: 0.8 };
    }
    if (text.includes('compare') || text.includes('difference') || text.includes('vs')) {
      return { category: 'comparison', confidence: 0.8 };
    }
    if (text.includes('best') || text.includes('recommend') || text.includes('suggest')) {
      return { category: 'recommendation', confidence: 0.8 };
    }
    if (text.includes('example') || text.includes('sample') || text.includes('instance')) {
      return { category: 'example', confidence: 0.8 };
    }

    return { category: 'general', confidence: 0.5 };
  }

  fallbackGenerateSummary(content, maxLength = 150) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) {
      return content.substring(0, maxLength);
    }
    
    const summary = sentences.slice(0, 3).join('. ');
    return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary;
  }

  fallbackExtractTags(content) {
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
    
    return [...new Set(tags)];
  }

  fallbackSearchMemories(query, memories, limit = 5) {
    if (!query || !memories) return [];
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = memories.map(memory => {
      const content = (memory.content + ' ' + (memory.summary || '') + ' ' + (memory.tags || []).join(' ')).toLowerCase();
      const score = queryTerms.reduce((total, term) => {
        return total + (content.includes(term) ? 1 : 0);
      }, 0) / queryTerms.length;
      
      return { ...memory, score };
    });
    
    return scored
      .filter(memory => memory.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  fallbackExtractFacts(content) {
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
    
    return facts.slice(0, 5);
  }

  fallbackIsWorthSaving(content) {
    if (!content || content.length < 20) return false;
    
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

  // Utility methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      fallbackMode: this.fallbackMode,
      backendUrl: this.backendUrl
    };
  }

  async reconnect() {
    console.log('LocalBrain: Attempting to reconnect to backend...');
    this.connectionRetries = 0;
    this.fallbackMode = false;
    return await this.checkConnection();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackendIntegration;
} else {
  // Browser environment
  window.BackendIntegration = BackendIntegration;
} 
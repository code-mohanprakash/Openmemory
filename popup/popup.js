/**
 * LocalBrain Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  await detectAndApplyPlatformTheme();
  await loadMemoryStats();
  setupEventListeners();
  setupAdvancedFeatures();
});

async function detectAndApplyPlatformTheme() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    const hostname = new URL(tab.url).hostname;
    const platformIcon = document.getElementById('platform-icon');
    const platformName = document.getElementById('platform-name');
    
    // Platform configurations
    const platforms = {
      'chat.openai.com': { name: 'ChatGPT', icon: chrome.runtime.getURL('icons/openai.png') },
      'chatgpt.com': { name: 'ChatGPT', icon: chrome.runtime.getURL('icons/openai.png') },
      'claude.ai': { name: 'Claude', icon: chrome.runtime.getURL('icons/claude.png') },
      'gemini.google.com': { name: 'Gemini', icon: chrome.runtime.getURL('icons/google.png') },
      'perplexity.ai': { name: 'Perplexity', icon: chrome.runtime.getURL('icons/perplexity.png') },
      'grok.x.ai': { name: 'Grok', icon: chrome.runtime.getURL('icons/grok.png') },
      'you.com': { name: 'You.com', icon: chrome.runtime.getURL('icons/openai.png') }
    };
    
    const platform = Object.keys(platforms).find(key => hostname.includes(key));
    
    if (platform) {
      const config = platforms[platform];
      platformIcon.src = config.icon;
      platformName.textContent = config.name;
      document.body.className = platform.replace('.', '-');
    } else {
      platformIcon.src = chrome.runtime.getURL('icons/openai.png');
      platformName.textContent = 'Universal AI Memory';
      document.body.className = 'default';
    }
    
    // Apply platform-specific theme
    const container = document.querySelector('.container');
    if (container) {
      container.setAttribute('data-platform', platform || 'default');
    }
    
  } catch (error) {
    console.error('Failed to detect platform:', error);
  }
}

async function loadMemoryStats() {
  try {
    const result = await chrome.storage.local.get(['LocalBrain_data']);
    const memories = result.LocalBrain_data || [];
    
    document.getElementById('total-memories').textContent = memories.length;
    document.getElementById('status').textContent = 'Active';
    
    // Get current tab to show current site
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const hostname = new URL(tab.url).hostname;
      const platformNames = {
        'chat.openai.com': 'ChatGPT',
        'chatgpt.com': 'ChatGPT',
        'claude.ai': 'Claude',
        'gemini.google.com': 'Gemini',
        'perplexity.ai': 'Perplexity',
        'grok.x.ai': 'Grok',
        'you.com': 'You.com'
      };
      
      const platformName = platformNames[hostname] || hostname;
      document.getElementById('current-site').textContent = platformName;
    }

    // Load analytics if available
    await loadMemoryAnalytics();
  } catch (error) {
    console.error('Failed to load memory stats:', error);
    document.getElementById('status').textContent = 'Error';
  }
}

async function loadMemoryAnalytics() {
  try {
    const result = await chrome.storage.local.get(['LocalBrain_data']);
    const memories = result.LocalBrain_data || [];
    
    if (memories.length === 0) return;

    // Calculate analytics
    const categories = {};
    const platforms = {};
    const tags = {};
    
    memories.forEach(memory => {
      categories[memory.category] = (categories[memory.category] || 0) + 1;
      platforms[memory.source] = (platforms[memory.source] || 0) + 1;
      
      if (memory.tags) {
        memory.tags.forEach(tag => {
          tags[tag] = (tags[tag] || 0) + 1;
        });
      }
    });

    // Update analytics display if elements exist
    const analyticsContainer = document.getElementById('analytics-container');
    if (analyticsContainer) {
      const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
      const topPlatform = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0];
      const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];

      analyticsContainer.innerHTML = `
        <div class="analytics-item">
          <span class="analytics-label">Top Category:</span>
          <span class="analytics-value">${topCategory ? topCategory[0] : 'None'}</span>
        </div>
        <div class="analytics-item">
          <span class="analytics-label">Top Platform:</span>
          <span class="analytics-value">${topPlatform ? topPlatform[0] : 'None'}</span>
        </div>
        <div class="analytics-item">
          <span class="analytics-label">Top Tag:</span>
          <span class="analytics-value">${topTag ? topTag[0] : 'None'}</span>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

function setupEventListeners() {
  // Inject memories button
  document.getElementById('inject-memories').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a supported platform
      const hostname = new URL(tab.url).hostname;
      const supportedPlatforms = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'grok.x.ai', 'you.com'];
      
      if (!supportedPlatforms.some(platform => hostname.includes(platform))) {
        showStatus('Please use on a supported AI platform', 'error');
        return;
      }
      
      // Add retry logic for inject memories
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'inject_memories_with_progress' });
          showStatus('Memories injected!', 'success');
          return;
        } catch (error) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Retry ${retryCount}/${maxRetries} for injecting memories...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Inject memories error:', error);
      showStatus('Failed to inject memories. Please refresh the page and try again.', 'error');
    }
  });
  
  // View all memories button
  document.getElementById('view-all').addEventListener('click', async () => {
    console.log('View All button clicked');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // Check if we're on a supported platform
      const hostname = new URL(tab.url).hostname;
      const supportedPlatforms = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'grok.x.ai', 'you.com'];
      
      if (!supportedPlatforms.some(platform => hostname.includes(platform))) {
        showStatus('Please use on a supported AI platform', 'error');
        return;
      }
      
      // Add retry logic for view all memories
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log('Sending show_memory_overlay message to content script');
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'show_memory_overlay' });
          console.log('Response from content script:', response);
          
          // Don't close popup immediately, wait a bit
          setTimeout(() => {
            window.close();
          }, 100);
          return;
        } catch (error) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Retry ${retryCount}/${maxRetries} for showing memory overlay...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('View all memories error:', error);
      showStatus('Failed to open memories view. Please refresh the page and try again.', 'error');
    }
  });
  
  // Clear all memories button
  document.getElementById('clear-all').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all memories? This action cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.set({ LocalBrain_data: [] });
      await loadMemoryStats();
      showStatus('All memories cleared', 'success');
    } catch (error) {
      showStatus('Failed to clear memories', 'error');
    }
  });
}

function setupAdvancedFeatures() {
  // Export button
  const exportBtn = document.getElementById('export-memories');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const result = await chrome.storage.local.get(['LocalBrain_data']);
        const memories = result.LocalBrain_data || [];
        
        if (memories.length === 0) {
          showStatus('No memories to export', 'warning');
          return;
        }

        const dataStr = JSON.stringify(memories, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `localbrain-memories-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        showStatus(`Exported ${memories.length} memories`, 'success');
      } catch (error) {
        console.error('Export failed:', error);
        showStatus('Failed to export memories', 'error');
      }
    });
  }

  // Import button
  const importBtn = document.getElementById('import-memories');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const memories = JSON.parse(text);
          
          if (!Array.isArray(memories)) {
            throw new Error('Invalid file format');
          }

          const result = await chrome.storage.local.get(['LocalBrain_data']);
          const existingMemories = result.LocalBrain_data || [];
          
          // Merge memories, avoiding duplicates
          const existingIds = new Set(existingMemories.map(m => m.id));
          const newMemories = memories.filter(m => !existingIds.has(m.id));
          
          const allMemories = [...newMemories, ...existingMemories];
          await chrome.storage.local.set({ LocalBrain_data: allMemories });
          
          await loadMemoryStats();
          showStatus(`Imported ${newMemories.length} new memories`, 'success');
        } catch (error) {
          console.error('Import failed:', error);
          showStatus('Failed to import memories. Please check the file format.', 'error');
        }
      };
      
      input.click();
    });
  }

  // Analytics button
  const analyticsBtn = document.getElementById('show-analytics');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', async () => {
      try {
        const result = await chrome.storage.local.get(['LocalBrain_data']);
        const memories = result.LocalBrain_data || [];
        
        if (memories.length === 0) {
          showStatus('No memories to analyze', 'warning');
          return;
        }

        // Calculate analytics
        const categories = {};
        const platforms = {};
        const tags = {};
        
        memories.forEach(memory => {
          categories[memory.category] = (categories[memory.category] || 0) + 1;
          platforms[memory.source] = (platforms[memory.source] || 0) + 1;
          
          if (memory.tags) {
            memory.tags.forEach(tag => {
              tags[tag] = (tags[tag] || 0) + 1;
            });
          }
        });

        const analyticsText = `
Memory Analytics:
• Total: ${memories.length}
• Categories: ${Object.keys(categories).length}
• Platforms: ${Object.keys(platforms).length}
• Tags: ${Object.keys(tags).length}

Top Categories:
${Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, count]) => `  • ${cat}: ${count}`).join('\n')}

Top Platforms:
${Object.entries(platforms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([platform, count]) => `  • ${platform}: ${count}`).join('\n')}
        `;

        showStatus(analyticsText, 'info', 10000);
      } catch (error) {
        console.error('Analytics failed:', error);
        showStatus('Failed to generate analytics', 'error');
      }
    });
  }

  // Deduplicate button
  const deduplicateBtn = document.getElementById('deduplicate-memories');
  if (deduplicateBtn) {
    deduplicateBtn.addEventListener('click', async () => {
      try {
        const result = await chrome.storage.local.get(['LocalBrain_data']);
        const memories = result.LocalBrain_data || [];
        
        if (memories.length === 0) {
          showStatus('No memories to deduplicate', 'warning');
          return;
        }

        // Simple deduplication based on content similarity
        const seen = new Set();
        const uniqueMemories = [];
        let duplicates = 0;

        memories.forEach(memory => {
          const signature = memory.content.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100);
          if (seen.has(signature)) {
            duplicates++;
          } else {
            seen.add(signature);
            uniqueMemories.push(memory);
          }
        });

        if (duplicates > 0) {
          await chrome.storage.local.set({ LocalBrain_data: uniqueMemories });
          await loadMemoryStats();
          showStatus(`Removed ${duplicates} duplicate memories`, 'success');
        } else {
          showStatus('No duplicates found', 'info');
        }
      } catch (error) {
        console.error('Deduplication failed:', error);
        showStatus('Failed to deduplicate memories', 'error');
      }
    });
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  // Add smooth entrance animation
  statusEl.style.transform = 'translateY(10px)';
  statusEl.style.opacity = '0';
  
  setTimeout(() => {
    statusEl.style.transform = 'translateY(0)';
    statusEl.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    statusEl.style.transform = 'translateY(-10px)';
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 300);
  }, 3000);
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
/**
 * OpenMemory Popup Script
 */

// Global variables for memory selection
let selectedMemories = new Set();
let allMemories = [];

document.addEventListener('DOMContentLoaded', async () => {
  await detectAndApplyPlatformTheme();
  await loadMemoryStats();
  await loadRecentMemories();
  setupEventListeners();
});

async function detectAndApplyPlatformTheme() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const hostname = new URL(tab.url).hostname;
      const platformIcon = document.getElementById('platform-icon');
      const platformName = document.getElementById('platform-name');
      
      // Set platform-specific icon and name using custom icons with chrome.runtime.getURL
      if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
        platformIcon.src = chrome.runtime.getURL('icons/openai.png');
        platformName.textContent = 'ChatGPT';
      } else if (hostname.includes('claude.ai')) {
        platformIcon.src = chrome.runtime.getURL('icons/claude.png');
        platformName.textContent = 'Claude';
      } else if (hostname.includes('perplexity.ai')) {
        platformIcon.src = chrome.runtime.getURL('icons/perplexity.png');
        platformName.textContent = 'Perplexity';
      } else if (hostname.includes('gemini.google.com')) {
        platformIcon.src = chrome.runtime.getURL('icons/google.png');
        platformName.textContent = 'Gemini';
      } else if (hostname.includes('grok.x.ai')) {
        platformIcon.src = chrome.runtime.getURL('icons/grok.png');
        platformName.textContent = 'Grok';
      } else {
        platformIcon.src = chrome.runtime.getURL('icons/grok.png');
        platformName.textContent = 'Universal AI Memory';
      }
      
      // Add error handler for icon loading
      platformIcon.onerror = function() {
        console.warn('Failed to load platform icon, using fallback');
        this.style.display = 'none';
      };
      
      console.log('Applied platform info for:', hostname);
    }
  } catch (error) {
    console.error('Failed to detect platform:', error);
    document.getElementById('platform-icon').src = chrome.runtime.getURL('icons/grok.png');
    document.getElementById('platform-name').textContent = 'Universal AI Memory';
  }
}

async function loadMemoryStats() {
  try {
    const result = await chrome.storage.local.get(['openmemory_data']);
    const memories = result.openmemory_data || [];
    
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
  } catch (error) {
    console.error('Failed to load memory stats:', error);
    document.getElementById('status').textContent = 'Error';
  }
}

async function loadRecentMemories() {
  try {
    const result = await chrome.storage.local.get(['openmemory_data']);
    const memories = result.openmemory_data || [];
    allMemories = memories; // Store for selection
    const recentList = document.getElementById('recent-list');
    
    if (memories.length === 0) {
      recentList.innerHTML = '<div class="no-memories">No memories yet</div>';
      return;
    }
    
    const recent = memories.slice(0, 5);
    recentList.innerHTML = recent.map((memory, index) => {
      // Check if this is a structured conversation memory
      let memoryDisplay = '';
      
      try {
        const parsedContent = JSON.parse(memory.content);
        if (parsedContent.user && parsedContent.ai_output) {
          // This is a structured conversation memory
          memoryDisplay = `
            <div class="structured-memory">
              <div class="user-input">
                <strong>👤 User:</strong> ${truncateText(parsedContent.user, 60)}
              </div>
              <div class="ai-output">
                <strong>🤖 AI:</strong> ${truncateText(parsedContent.ai_output, 60)}
              </div>
            </div>
          `;
        } else {
          // Regular memory
          memoryDisplay = `<div class="memory-text">${truncateText(memory.content, 80)}</div>`;
        }
      } catch (e) {
        // Not JSON or invalid structure, display as regular memory
        memoryDisplay = `<div class="memory-text">${truncateText(memory.content, 80)}</div>`;
      }
      
      return `
        <div class="memory-item" data-index="${index}">
          <div class="memory-item-container">
            <div class="memory-checkbox">
              <input type="checkbox" id="memory-${index}" data-memory-index="${index}">
            </div>
            <div class="memory-content">
              ${memoryDisplay}
              <div class="memory-meta">
                <span class="memory-date">${formatDate(memory.timestamp)}</span>
                <span class="memory-source">${memory.source}</span>
                ${memory.category === 'structured_conversation' ? '<span class="memory-type">🗣️ Conversation</span>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add inject selected button after memories
    recentList.innerHTML += `
      <button class="btn inject-selected-btn" id="inject-selected" disabled>
        💉 Inject Selected (0)
      </button>
    `;
    
    // Setup memory selection handlers
    setupMemorySelection();
    
  } catch (error) {
    console.error('Failed to load recent memories:', error);
  }
}

function setupMemorySelection() {
  // Handle checkbox changes
  document.querySelectorAll('input[data-memory-index]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const memoryIndex = parseInt(e.target.dataset.memoryIndex);
      const memoryItem = e.target.closest('.memory-item');
      
      if (e.target.checked) {
        selectedMemories.add(memoryIndex);
        memoryItem.classList.add('selected');
      } else {
        selectedMemories.delete(memoryIndex);
        memoryItem.classList.remove('selected');
      }
      
      updateInjectSelectedButton();
    });
  });
  
  // Handle inject selected button
  const injectBtn = document.getElementById('inject-selected');
  if (injectBtn) {
    injectBtn.addEventListener('click', injectSelectedMemories);
  }
}

function updateInjectSelectedButton() {
  const injectBtn = document.getElementById('inject-selected');
  if (!injectBtn) return;
  
  const selectedCount = selectedMemories.size;
  injectBtn.textContent = `💉 Inject Selected (${selectedCount})`;
  
  if (selectedCount > 0) {
    injectBtn.disabled = false;
    injectBtn.classList.add('enabled');
  } else {
    injectBtn.disabled = true;
    injectBtn.classList.remove('enabled');
  }
}

async function injectSelectedMemories() {
  if (selectedMemories.size === 0) {
    showStatus('No memories selected', 'error');
    return;
  }
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on a supported platform
    const hostname = new URL(tab.url).hostname;
    const supportedPlatforms = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'grok.x.ai', 'you.com'];
    
    if (!supportedPlatforms.some(platform => hostname.includes(platform))) {
      showStatus('Please use on a supported AI platform', 'error');
      return;
    }
    
    // Get selected memories
    const selectedMemoryData = Array.from(selectedMemories).map(index => allMemories[index]);
    
    // Send message to content script with selected memories - add retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'inject_selected_memories',
          memories: selectedMemoryData
        });
        
        // Success - break out of retry loop
        showStatus(`Injected ${selectedMemories.size} selected memories!`, 'success');
        
        // Clear selections
        selectedMemories.clear();
        document.querySelectorAll('input[data-memory-index]').forEach(checkbox => {
          checkbox.checked = false;
        });
        document.querySelectorAll('.memory-item').forEach(item => {
          item.classList.remove('selected');
        });
        updateInjectSelectedButton();
        return;
        
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Retry ${retryCount}/${maxRetries} for injecting memories...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        } else {
          throw error; // Re-throw if max retries reached
        }
      }
    }
    
  } catch (error) {
    console.error('Inject selected memories error:', error);
    showStatus('Failed to inject memories. Please refresh the page and try again.', 'error');
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
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'inject_memories' });
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
      await chrome.storage.local.set({ openmemory_data: [] });
      await loadMemoryStats();
      await loadRecentMemories();
      showStatus('All memories cleared', 'success');
    } catch (error) {
      showStatus('Failed to clear memories', 'error');
    }
  });
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
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
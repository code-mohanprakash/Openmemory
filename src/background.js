/**
 * LocalBrain Background Script
 * Handles extension lifecycle and inter-tab communication
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('LocalBrain: Extension installed');
    
    // Set default settings
    chrome.storage.local.set({
      LocalBrain_settings: {
        enabled: true,
        autoDetect: true,
        maxMemories: 1000,
        platforms: {
          chatgpt: true,
          claude: true,
          gemini: true,
          perplexity: true,
          grok: true,
          you: true
        }
      }
    });
  } else if (details.reason === 'update') {
    console.log('LocalBrain: Extension updated');
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open options page or show popup
  chrome.tabs.sendMessage(tab.id, {
    action: 'toggle_memory_injection'
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_memory_stats') {
    chrome.storage.local.get(['LocalBrain_data'], (result) => {
      const memories = result.LocalBrain_data || [];
      sendResponse({
        total: memories.length,
        recent: memories.slice(0, 5)
      });
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'memory_saved') {
    // Update badge or notification
    chrome.action.setBadgeText({
      text: request.count.toString(),
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#667eea'
    });
  }
});

// Clear badge when tab becomes inactive
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.action.setBadgeText({
    text: '',
    tabId: activeInfo.tabId
  });
});

console.log('LocalBrain: Background script loaded');
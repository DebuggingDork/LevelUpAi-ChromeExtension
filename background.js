// Background script for LevelUp extension

// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed. Setting up default settings...');
  
  // Set up default settings
  chrome.storage.sync.get(['apiKey', 'model', 'temperature', 'markdown'], (result) => {
    console.log('Current settings:', result);
    
    // Set defaults if not already set
    chrome.storage.sync.set({
      apiKey: result.apiKey || '',
      model: 'gemini-2.0-flash',
      temperature: result.temperature !== undefined ? result.temperature : 0.7,
      markdown: result.markdown !== undefined ? result.markdown : true
    }, () => {
      console.log('Default settings saved');
    });
  });
  
  // Create context menu
  chrome.contextMenus.create({
    id: "improveText",
    title: "Enhance Prompt with LevelUp",
    contexts: ["selection"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error creating context menu:', chrome.runtime.lastError);
    } else {
      console.log('Context menu created successfully');
    }
  });
});

// Listen for messages from content script with improved error handling
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request);
  
  // Handle messages from content script
  if (request.action === "getSettings") {
    console.log('Fetching settings...');
    
    // Immediate response to avoid port closure
    try {
      chrome.storage.sync.get({
        apiKey: '',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        markdown: true
      }, function(items) {
        // Check for runtime errors before sending response
        if (chrome.runtime.lastError) {
          console.error('Error getting settings:', chrome.runtime.lastError);
          // Try to send a response anyway
          try {
            sendResponse({error: chrome.runtime.lastError.message});
          } catch (e) {
            console.error('Failed to send error response:', e);
          }
          return;
        }
        
        console.log('Sending settings back to content script:', items);
        try {
          sendResponse(items);
        } catch (e) {
          console.error('Failed to send settings response:', e);
        }
      });
    } catch (e) {
      console.error('Exception during getSettings:', e);
      try {
        sendResponse({error: e.message});
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    }
    
    // Return true to indicate we'll respond asynchronously
    return true;
  } else {
    // For other actions, send a synchronous response
    sendResponse({status: "unknown_action"});
    return false;
  }
});

// Handle context menu clicks with better error handling
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === "improveText") {
    if (!tab || !tab.id) {
      console.error('Invalid tab for sending message');
      return;
    }
    
    // Send message to content script to improve the selected text
    console.log('Sending selected text to content script:', info.selectionText);
    
    try {
      // Create a connection port for more reliable messaging
      const port = chrome.tabs.connect(tab.id, {name: "improveText"});
      
      // Send the text via the port
      port.postMessage({
        action: "improveSelectedText",
        text: info.selectionText
      });
      
      // Handle disconnection
      port.onDisconnect(function() {
        if (chrome.runtime.lastError) {
          console.error('Port disconnected with error:', chrome.runtime.lastError);
        } else {
          console.log('Port disconnected normally');
        }
      });
      
      // Also try the traditional method as backup
      chrome.tabs.sendMessage(tab.id, {
        action: "improveSelectedText",
        text: info.selectionText
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('Regular sendMessage error (expected if port worked):', chrome.runtime.lastError.message);
        } else {
          console.log('Regular sendMessage response:', response);
        }
      });
    } catch (e) {
      console.error('Error sending message to tab:', e);
    }
  }
});

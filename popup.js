document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all tabs and contents
      navItems.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Show corresponding content
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Theme toggle functionality
  const themeToggle = document.getElementById('themeToggle');
  
  themeToggle.addEventListener('click', function() {
    const isDarkTheme = document.body.classList.toggle('dark-theme');
    updateThemeIcon(isDarkTheme);
    
    // Save theme preference
    chrome.storage.local.set({ darkTheme: isDarkTheme });
  });
  
  // Update theme icon based on current theme
  function updateThemeIcon(isDarkTheme) {
    const iconElement = themeToggle.querySelector('.material-symbols-rounded');
    if (isDarkTheme) {
      iconElement.textContent = 'light_mode';
    } else {
      iconElement.textContent = 'dark_mode';
    }
  }
  
  // Load theme preference
  chrome.storage.local.get(['darkTheme'], function(result) {
    // Default to dark theme if preference not set
    const isDarkTheme = result.darkTheme !== undefined ? result.darkTheme : true;
    
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    updateThemeIcon(isDarkTheme);
  });
  
  // Home tab functionality
  const enhanceBtn = document.getElementById('enhanceBtn');
  const promptInput = document.getElementById('promptInput');
  const historyList = document.getElementById('historyList');
  const favoritesList = document.getElementById('favoritesList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const clearFavoritesBtn = document.getElementById('clearFavoritesBtn');
  
  // Save history and favorites in storage
  let historyPromptsList = [];
  let favoritePromptsList = [];
  
  // Load any existing history and favorites
  chrome.storage.local.get(['historyPrompts', 'favoritePrompts'], function(result) {
    // Load history prompts
    if (result.historyPrompts && Array.isArray(result.historyPrompts) && result.historyPrompts.length > 0) {
      historyPromptsList = result.historyPrompts.filter(prompt => 
        prompt && 
        typeof prompt === 'object' && 
        prompt.original && 
        prompt.enhanced && 
        prompt.timestamp
      );
      
      if (historyPromptsList.length > 0) {
        updateHistoryList();
      }
    }
    
    // Load favorites
    if (result.favoritePrompts && Array.isArray(result.favoritePrompts) && result.favoritePrompts.length > 0) {
      favoritePromptsList = result.favoritePrompts.filter(prompt => 
        prompt && 
        typeof prompt === 'object' && 
        prompt.original && 
        prompt.enhanced && 
        prompt.timestamp
      );
      
      if (favoritePromptsList.length > 0) {
        updateFavoritesList();
      }
    }
  });
  
  // Enhance button click handler
  enhanceBtn.addEventListener('click', function() {
    const promptText = promptInput.value.trim();
    
    if (!promptText) {
      showToast('Please enter text to enhance', 'error');
      return;
    }
    
    showToast('Processing your text...', 'info');
    
    // Show processing state
  

  // Show enhanced output in Home tab
  function showEnhancedOutput(original, enhanced, model, isLoading) {
    const enhancedOutput = document.getElementById('enhancedOutput');
    const enhancedText = document.getElementById('enhancedText');
    if (enhancedOutput && enhancedText) {
      enhancedText.textContent = enhanced;
      enhancedOutput.style.display = '';
      // Show loading shimmer if loading
      if (isLoading) {
        enhancedText.classList.add('loading-shimmer');
      } else {
        enhancedText.classList.remove('loading-shimmer');
      }
    }
  }
  function hideEnhancedOutput() {
    const enhancedOutput = document.getElementById('enhancedOutput');
    if (enhancedOutput) enhancedOutput.style.display = 'none';
  }
  // Add to favorites from Home tab output
  function addToFavoritesFromHome(original, enhanced, model, btn) {
    if (!original || !enhanced) return;
    // Check if already in favorites
    const exists = favoritePromptsList.some(p => p.original === original && p.enhanced === enhanced);
    if (exists) {
      showToast('Already in favorites', 'info');
      btn.querySelector('span').textContent = 'star';
      return;
    }
    const promptData = {
      id: Date.now(),
      original,
      enhanced,
      timestamp: new Date().toISOString(),
      model: model || 'gemini-2.0-flash',
      starred: true
    };
    favoritePromptsList.unshift(promptData);
    if (favoritePromptsList.length > 20) favoritePromptsList = favoritePromptsList.slice(0, 20);
    chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
    updateFavoritesList();
    showToast('Added to favorites!', 'success');
    btn.querySelector('span').textContent = 'star';
  }
  
  // Simulate API response (to be replaced with actual API call)
  function simulateApiResponse(requestData, callback) {
    setTimeout(function() {
      // Simulate successful response
      callback({
        success: true,
        enhancedText: "Enhanced version of: " + requestData.text,
        message: "Successfully enhanced text"
      });
    }, 1500);
  }
  
  // Add to history
  function addToHistory(originalText, enhancedText, modelName) {
    // Validate inputs
    if (!originalText || !enhancedText) {
      console.warn('Cannot add to history: Missing original or enhanced text');
      showToast('Could not save to history', 'warning');
      return;
    }
    
    const promptData = {
      id: Date.now(),
      original: originalText,
      enhanced: enhancedText,
      timestamp: new Date().toISOString(),
      model: modelName || 'gemini-2.0-flash',
      starred: false
    };
    
    // Add to the beginning of the list
    historyPromptsList.unshift(promptData);
    
    // Keep only the 20 most recent prompts
    if (historyPromptsList.length > 20) {
      historyPromptsList = historyPromptsList.slice(0, 20);
    }
    
    // Save to storage
    chrome.storage.local.set({ historyPrompts: historyPromptsList });
    
    // Update the UI
    updateHistoryList();
  }
  
  // Update the history list in the UI
  function updateHistoryList() {
    // Clear the container
    historyList.innerHTML = '';
    
    // Show or hide empty state
    if (historyPromptsList.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <span class="material-symbols-rounded">history</span>
        <p>No history yet</p>
        <span>Your enhanced texts will appear here</span>
      `;
      historyList.appendChild(emptyState);
    } else {
      historyPromptsList.forEach((prompt, index) => {
        const promptCard = createPromptCard(prompt, index, false);
        historyList.appendChild(promptCard);
      });
    }
  }
  
  // Update the favorites list in the UI
  function updateFavoritesList() {
    // Clear the container
    favoritesList.innerHTML = '';
    
    // Show or hide empty state
    if (favoritePromptsList.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <span class="material-symbols-rounded">star</span>
        <p>No favorites yet</p>
        <span>Save your favorite prompts for quick access</span>
      `;
      favoritesList.appendChild(emptyState);
    } else {
      favoritePromptsList.forEach((prompt, index) => {
        const promptCard = createPromptCard(prompt, index, true);
        favoritesList.appendChild(promptCard);
      });
    }
  }
  
  // Create a prompt card element
  function createPromptCard(prompt, index, isFavorite) {
    const promptCard = document.createElement('div');
    promptCard.className = 'card prompt-card';
    
    const promptHeader = document.createElement('div');
    promptHeader.className = 'prompt-header';
    
    const timestamp = new Date(prompt.timestamp);
    const formattedDate = timestamp.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const starIcon = prompt.starred ? 'star' : 'star_outline';
    
    promptHeader.innerHTML = `
      <div class="prompt-info">
        <span class="prompt-date">${formattedDate}</span>
        <span class="prompt-model">${prompt.model || 'gemini-2.0-flash'}</span>
      </div>
      <div class="prompt-actions">
        <button class="icon-action star-btn" title="${prompt.starred ? 'Remove from favorites' : 'Add to favorites'}">
          <span class="material-symbols-rounded">${starIcon}</span>
        </button>
        <button class="icon-action" title="Copy to clipboard">
          <span class="material-symbols-rounded">content_copy</span>
        </button>
        <button class="icon-action delete-btn" title="Delete">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    `;
    
    const promptContent = document.createElement('div');
    promptContent.className = 'prompt-content';
    if (prompt.enhanced) {
      promptContent.textContent = prompt.enhanced.substring(0, 150) + (prompt.enhanced.length > 150 ? '...' : '');
    } else {
      promptContent.textContent = 'No enhanced text available';
    }
    
    // Add click handler to load the prompt
    promptCard.addEventListener('click', function(e) {
      // Don't trigger if clicked on a button
      if (e.target.closest('.icon-action')) return;
      
      // Add null check for original text
      if (prompt.original) {
        promptInput.value = prompt.original;
        promptInput.focus();
        
        // Switch to home tab
        navItems.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        document.querySelector('[data-tab="home"]').classList.add('active');
        document.getElementById('home').classList.add('active');
      } else {
        showToast('Original text not available', 'warning');
      }
    });
    
    // Add star button functionality
    const starBtn = promptHeader.querySelector('.star-btn');
    starBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFavorite(prompt, index, isFavorite);
    });
    
    // Add copy button functionality
    const copyBtn = promptHeader.querySelector('button[title="Copy to clipboard"]');
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (prompt.enhanced) {
        navigator.clipboard.writeText(prompt.enhanced)
          .then(() => {
            showToast('Copied to clipboard!', 'success');
          })
          .catch(() => {
            showToast('Failed to copy to clipboard', 'error');
          });
      } else {
        showToast('No enhanced text to copy', 'warning');
      }
    });
    
    // Add delete button functionality
    const deleteBtn = promptHeader.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      
      if (isFavorite) {
        // Remove from favorites
        favoritePromptsList.splice(index, 1);
        chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
        updateFavoritesList();
        showToast('Removed from favorites', 'info');
      } else {
        // Remove from history
        const deletedPrompt = historyPromptsList.splice(index, 1)[0];
        
        // If it was starred, also remove from favorites
        if (deletedPrompt.starred) {
          const favIndex = favoritePromptsList.findIndex(item => item.id === deletedPrompt.id);
          if (favIndex !== -1) {
            favoritePromptsList.splice(favIndex, 1);
            chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
            updateFavoritesList();
          }
        }
        
        chrome.storage.local.set({ historyPrompts: historyPromptsList });
        updateHistoryList();
        showToast('Removed from history', 'info');
      }
    });
    
    promptCard.appendChild(promptHeader);
    promptCard.appendChild(promptContent);
    return promptCard;
  }
  
  // Toggle favorite status
  function toggleFavorite(prompt, index, isCurrentlyInFavorites) {
    if (isCurrentlyInFavorites) {
      // Remove from favorites
      favoritePromptsList.splice(index, 1);
      
      // Update starred status in history list
      const historyIndex = historyPromptsList.findIndex(item => item.id === prompt.id);
      if (historyIndex !== -1) {
        historyPromptsList[historyIndex].starred = false;
        chrome.storage.local.set({ historyPrompts: historyPromptsList });
        updateHistoryList();
      }
      
      chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
      updateFavoritesList();
      showToast('Removed from favorites', 'info');
    } else {
      // Update star status in the history list
      historyPromptsList[index].starred = !historyPromptsList[index].starred;
      
      if (historyPromptsList[index].starred) {
        // Add to favorites if starred
        if (!favoritePromptsList.some(item => item.id === prompt.id)) {
          favoritePromptsList.unshift({...historyPromptsList[index]});
          chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
          showToast('Added to favorites!', 'success');
        }
      } else {
        // Remove from favorites if unstarred
        const favIndex = favoritePromptsList.findIndex(item => item.id === prompt.id);
        if (favIndex !== -1) {
          favoritePromptsList.splice(favIndex, 1);
          chrome.storage.local.set({ favoritePrompts: favoritePromptsList });
        }
      }
      
      // Save updated history prompts
      chrome.storage.local.set({ historyPrompts: historyPromptsList });
      updateHistoryList();
      updateFavoritesList();
    }
  }
  
  // Clear all history (keep favorites)
  clearHistoryBtn.addEventListener('click', function() {
    chrome.storage.local.get(['historyPrompts'], function(result) {
      let currentHistory = Array.isArray(result.historyPrompts) ? result.historyPrompts : [];
      if (currentHistory.length === 0) {
        showToast('History is already empty', 'info');
        return;
      }
      if (confirm('Are you sure you want to clear all non-favorite history?')) {
        // Keep only starred (favorite) items in history
        historyPromptsList = currentHistory.filter(item => item.starred);
        chrome.storage.local.set({ historyPrompts: historyPromptsList }, function() {
          updateHistoryList();
          showToast('Non-favorite history cleared. Favorites are kept.', 'success');
        });
      }
    });
  });
  
  // Clear all favorites
  clearFavoritesBtn.addEventListener('click', function() {
    if (favoritePromptsList.length === 0) {
      showToast('Favorites is already empty', 'info');
      return;
    }
    
    // Confirm delete
    if (confirm('Are you sure you want to clear all favorites?')) {
      // Update starred status in history
      for (const favorite of favoritePromptsList) {
        const historyIndex = historyPromptsList.findIndex(item => item.id === favorite.id);
        if (historyIndex !== -1) {
          historyPromptsList[historyIndex].starred = false;
        }
      }
      
      favoritePromptsList = [];
      chrome.storage.local.set({ 
        favoritePrompts: favoritePromptsList,
        historyPrompts: historyPromptsList
      });
      
      updateFavoritesList();
      updateHistoryList();
      showToast('Favorites cleared', 'success');
    }
  });
  
  // Settings tab functionality
  // Load saved settings
  chrome.storage.sync.get(['apiKey', 'model', 'temperature', 'markdown'], function(data) {
    const apiKeyInput = document.getElementById('apiKey');
    const apiStatus = document.getElementById('apiStatus');
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
      if (apiStatus) {
        apiStatus.classList.remove('disconnected');
        apiStatus.classList.add('connected');
        apiStatus.querySelector('span:last-child').textContent = 'Connected';
      }
    } else {
      apiKeyInput.value = '';
      if (apiStatus) {
        apiStatus.classList.remove('connected');
        apiStatus.classList.add('disconnected');
        apiStatus.querySelector('span:last-child').textContent = 'Disconnected';
      }
    }
    
    // Set model value, default to gemini-2.0-flash if not set
    const modelInput = document.getElementById('model');
    modelInput.value = data.model || 'gemini-2.0-flash';
    
    // Set temperature slider value, default to 0.7 if not set
    const tempSlider = document.getElementById('temperature');
    const tempValue = data.temperature !== undefined ? data.temperature : 0.7;
    tempSlider.value = tempValue;
    
    // Update temperature slider background
    updateSliderBackground(tempSlider);
    
    // Set markdown checkbox, default to checked if not set
    const markdownCheckbox = document.getElementById('markdown');
    markdownCheckbox.checked = data.markdown !== undefined ? data.markdown : true;
    
    // Set value display text
    const valueDisplay = document.querySelector('.value-display');
    if (valueDisplay) {
      valueDisplay.textContent = tempValue;
    }
  });
  
  // Temperature slider value update
  const tempSlider = document.getElementById('temperature');
  const tempValueDisplay = document.querySelector('.value-display');
  
  if (tempSlider && tempValueDisplay) {
    tempSlider.addEventListener('input', function() {
      tempValueDisplay.textContent = this.value;
      updateSliderBackground(this);
    });
  }
  
  // Function to update slider background
  function updateSliderBackground(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const percentage = ((val - min) / (max - min)) * 100;
    
    slider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percentage}%, var(--border-color) ${percentage}%, var(--border-color) 100%)`;
  }
  
  // Toggle password visibility for API key
  const apiKeyContainer = document.querySelector('.input-with-action');
  if (apiKeyContainer) {
    const apiKeyInput = apiKeyContainer.querySelector('input');
    const visibilityToggle = apiKeyContainer.querySelector('.icon-action');
    
    if (visibilityToggle) {
      visibilityToggle.addEventListener('click', function() {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        
        const icon = this.querySelector('.material-symbols-rounded');
        icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
      });
    }
  }
  
  // Save settings
  document.getElementById('saveBtn').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const markdown = document.getElementById('markdown').checked;
    
    chrome.storage.sync.set({
      apiKey: apiKey,
      model: model,
      temperature: temperature,
      markdown: markdown
    }, function() {
      // Show save confirmation
      showToast('Settings saved successfully!', 'success');
    });
  });
  
  // Reset settings
  document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('apiKey').value = '';
    document.getElementById('model').value = 'gemini-2.0-flash';
    
    const tempSlider = document.getElementById('temperature');
    tempSlider.value = 0.7;
    updateSliderBackground(tempSlider);
    
    if (tempValueDisplay) {
      tempValueDisplay.textContent = '0.7';
    }
    
    document.getElementById('markdown').checked = true;
    
    // Save default settings
    chrome.storage.sync.set({
      apiKey: '',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      markdown: true
    }, function() {
      showToast('Settings reset to defaults', 'info');
    });
  });
  
  // Show toast notification
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    // Remove any existing toasts
    const existingToasts = toastContainer.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on type
    let icon;
    switch(type) {
      case 'success':
        icon = 'check_circle';
        break;
      case 'error':
        icon = 'error';
        break;
      case 'warning':
        icon = 'warning';
        break;
      default:
        icon = 'info';
    }
    
    toast.innerHTML = `
      <span class="material-symbols-rounded">${icon}</span>
      <div class="toast-content">
        <p>${message}</p>
      </div>
      <button class="toast-close">
        <span class="material-symbols-rounded">close</span>
      </button>
    `;
    
    // Add close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.remove();
        }, 300);
      });
    }
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
          if (toast.parentNode === toastContainer) {
            toast.remove();
          }
        });
      }
    }, 3000);
  }

  // Copy API key from quick setup
  document.querySelectorAll('.copy-api-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const apiKey = btn.getAttribute('data-api');
      if (apiKey) {
        navigator.clipboard.writeText(apiKey).then(() => {
          showToast('API key copied!', 'success');
        }).catch(() => {
          showToast('Failed to copy API key', 'error');
        });
      }
    });
  });

  // API Key validation and paste support
  // Prevent saving invalid API key
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function(e) {
      if (!validateApiKeyInput()) {
        e.preventDefault();
        showToast('Invalid API key. Please check and try again.', 'error');
        return false;
      }
    }, true);
  }
});

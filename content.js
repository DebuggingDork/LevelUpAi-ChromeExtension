// Global variables
let selectedText = '';
let originalElement = null;
let floatingBar = null;
let improveDialog = null;
let API_KEY = '';
let MODEL = 'gemini-2.0-flash';
let TEMPERATURE = 0.7;
let MARKDOWN_ENABLED = true;
let originalRange = null;
let selectionCheckInterval = null;

// Function to safely access Chrome storage
function loadSettings() {
  // First check if we're in a Chrome extension context
  if (typeof chrome === 'undefined') {
    console.warn('Chrome API not available - running in non-extension context');
    return;
  }
  
  // Then check if storage API exists
  if (!chrome.storage) {
    console.warn('Chrome storage API not available');
    return;
  }
  
  // Finally check if sync storage is available
  if (!chrome.storage.sync) {
    console.warn('Chrome sync storage not available, falling back to local storage');
    // Try to use local storage if available
    if (chrome.storage.local) {
      chrome.storage.local.get({
        apiKey: '',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        markdown: true
      }, function(items) {
        console.log('Settings loaded from local storage:', items);
        API_KEY = items.apiKey;
        MODEL = 'gemini-2.0-flash';
        TEMPERATURE = items.temperature;
        MARKDOWN_ENABLED = items.markdown;
      });
    }
    return;
  }
  
  // If we get here, chrome.storage.sync is available
  try {
    console.log('Loading settings from chrome storage...');
    chrome.storage.sync.get({
      apiKey: '',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      markdown: true
    }, function(items) {
      console.log('Settings loaded:', items);
      API_KEY = items.apiKey;
      MODEL = 'gemini-2.0-flash';
      TEMPERATURE = items.temperature;
      MARKDOWN_ENABLED = items.markdown;
      console.log('API Key loaded:', API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No');
    });
  } catch (error) {
    console.error('Error accessing Chrome storage:', error);
  }
}

// Initial load of settings - wrap in a timeout to ensure DOM is ready
setTimeout(loadSettings, 100);

// Listen for changes in storage - with safeguards
try {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function(changes) {
        console.log('Storage changes detected:', changes);
        if (changes.apiKey) API_KEY = changes.apiKey.newValue;
        MODEL = 'gemini-2.0-flash';
        if (changes.temperature) TEMPERATURE = changes.temperature.newValue;
        if (changes.markdown) MARKDOWN_ENABLED = changes.markdown.newValue;
        console.log('Updated settings after changes:', { 
          apiKey: API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No',
          model: MODEL,
          temperature: TEMPERATURE,
          markdown: MARKDOWN_ENABLED
        });
      });
    }
  }
} catch (error) {
  console.error('Error setting up storage change listener:', error);
}

// Function to create floating toolbar
function createFloatingBar(x, y) {
  try {
    console.log('Creating floating bar at coordinates:', x, y);
    
    // Validate coordinates
    if (x === undefined || y === undefined) {
      console.error('Invalid coordinates for floating bar');
      return;
    }
    
    // Ensure y is within viewport
    if (y < 0) y = 10;
    
    // Check if there's already a floating bar
    if (floatingBar && floatingBar.parentNode) {
      console.log('Floating bar already exists, moving it to new position');
      floatingBar.style.left = `${x}px`;
      floatingBar.style.top = `${y}px`;
      return;
    }
    
    // Create floating bar
    floatingBar = document.createElement('div');
    floatingBar.className = 'levelup-floating-bar appear';
    floatingBar.style.left = `${x}px`;
    floatingBar.style.top = `${y}px`;
    
    // Add click handler to prevent losing selection
    floatingBar.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
    
    // 1. Create LevelUp logo button (for enhance prompt)
    const enhanceButton = document.createElement('button');
    enhanceButton.className = 'levelup-toolbar-button';
    enhanceButton.title = 'Enhance Prompt';
    enhanceButton.innerHTML = `
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="16" height="16" alt="LevelUp Icon" class="levelup-button-icon">
    `;
    
    // Add event listener to enhance button
    enhanceButton.addEventListener('click', function(e) {
      console.log('Enhance Prompt button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Store the text that was selected
      if (!selectedText || selectedText.trim() === '') {
        console.warn('No text selected when enhance prompt button clicked');
        removeFloatingBar();
        return;
      }
      
      // Improve the selected text
      console.log('Calling improveText with selected prompt:', selectedText.substring(0, 30) + (selectedText.length > 30 ? '...' : ''));
      improveText(selectedText);
      
      // Remove the floating bar
      removeFloatingBar();
    });
    
    // 2. Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'levelup-toolbar-button';
    copyButton.title = 'Copy Text';
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="levelup-button-icon">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    
    // Add event listener to copy button
    copyButton.addEventListener('click', function(e) {
      console.log('Copy button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Check if text is selected
      if (!selectedText || selectedText.trim() === '') {
        console.warn('No text selected when copy button clicked');
        removeFloatingBar();
        return;
      }
      
      // Copy selected text to clipboard
      navigator.clipboard.writeText(selectedText).then(() => {
        console.log('Text copied to clipboard');
        
        // Show temporary success indicator
        const originalIcon = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="levelup-button-icon">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        setTimeout(() => {
          copyButton.innerHTML = originalIcon;
        }, 1500);
        
        // Remove the floating bar after a delay
        setTimeout(() => {
          removeFloatingBar();
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text:', err);
        alert('Failed to copy text. Please try again.');
      });
    });
    
    // 3. Create meaning button
    const meaningButton = document.createElement('button');
    meaningButton.className = 'levelup-toolbar-button';
    meaningButton.title = 'Get Meaning';
    meaningButton.innerHTML = `
      <img src="${chrome.runtime.getURL('icons/meaning_icon.png')}" width="16" height="16" alt="Meaning Icon" class="levelup-button-icon">
    `;
    
    // Add event listener to meaning button
    meaningButton.addEventListener('click', function(e) {
      console.log('Meaning button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Check if text is selected
      if (!selectedText || selectedText.trim() === '') {
        console.warn('No text selected when meaning button clicked');
        removeFloatingBar();
        return;
      }
      
      // Get meaning of selected text
      console.log('Getting meaning for text:', selectedText.substring(0, 30) + (selectedText.length > 30 ? '...' : ''));
      getTextMeaning(selectedText, false, '');
      
      // Remove the floating bar
      removeFloatingBar();
    });
    
    // Add all buttons to floating bar
    floatingBar.appendChild(enhanceButton);
    floatingBar.appendChild(copyButton);
    floatingBar.appendChild(meaningButton);
    
    // Add floating bar to body
    document.body.appendChild(floatingBar);
    
    // Set interval to check if text is still selected
    const selectionCheckInterval = setInterval(() => {
      const currentSelection = window.getSelection().toString().trim();
      if (currentSelection === '') {
        console.log('Selection no longer active, removing floating bar');
        clearInterval(selectionCheckInterval);
        removeFloatingBar();
      }
    }, 1000); // Check every second
    
    console.log('Floating bar created successfully');
  } catch (error) {
    console.error('Error creating floating bar:', error);
  }
}

// Function to remove floating toolbar with animation
function removeFloatingBar() {
  if (floatingBar && floatingBar.parentNode) {
    // Add fade-out class for animation
    floatingBar.classList.add('fade-out');
    
    // Wait for animation to complete before removing
    setTimeout(() => {
      if (floatingBar && floatingBar.parentNode) {
        floatingBar.parentNode.removeChild(floatingBar);
        floatingBar = null;
      }
    }, 300); // Match this timeout with the CSS transition duration
  }
  
  // Clear the interval if it exists
  if (selectionCheckInterval) {
    clearInterval(selectionCheckInterval);
    selectionCheckInterval = null;
  }
}

// Function to create the improve dialog
function createImproveDialog(originalText, improvedText, by) {
  // Save to history
  saveToHistory(originalText, improvedText, 'enhance');
  // Remove existing dialog if any
  if (improveDialog && improveDialog.parentNode) {
    improveDialog.parentNode.removeChild(improveDialog);
  }
  
  // Remove floating bar if it exists
  removeFloatingBar();
  
  // Create new dialog
  improveDialog = document.createElement('div');
  improveDialog.className = 'levelup-dialog dark-theme'; // Set dark theme as default
  
  // Create header
  const dialogHeader = document.createElement('div');
  dialogHeader.className = 'levelup-dialog-header';
  
  // Add logo icon to header
  const logoIcon = document.createElement('div');
  logoIcon.className = 'levelup-message-icon';
  logoIcon.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="24" height="24" alt="LevelUp Icon">
  `;
  
  // Add title to header
  const dialogTitle = document.createElement('h2');
  dialogTitle.textContent = 'Enhance Prompt';
  
  // Create header actions container
  const headerActions = document.createElement('div');
  headerActions.className = 'levelup-header-actions';
  
  // Add dark mode toggle
  const darkModeButton = document.createElement('button');
  darkModeButton.className = 'levelup-theme-toggle';
  darkModeButton.title = 'Toggle Dark Mode';
  darkModeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `;
  
  // Add click event to dark mode toggle
  darkModeButton.addEventListener('click', function() {
    improveDialog.classList.toggle('dark-theme');
  });
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'levelup-close-btn';
  closeButton.title = 'Close';
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  
  // Add event listener to close button
  closeButton.addEventListener('click', function() {
    removeImproveDialog();
  });
  
  // Assemble header with actions
  headerActions.appendChild(darkModeButton);
  headerActions.appendChild(closeButton);
  
  dialogHeader.appendChild(logoIcon);
  dialogHeader.appendChild(dialogTitle);
  dialogHeader.appendChild(headerActions);
  
  // --- Make Enhance Prompt dialog draggable (exactly like meaning dialog) ---
  let isDragging = false, offsetX, offsetY;
  dialogHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - improveDialog.getBoundingClientRect().left;
    offsetY = e.clientY - improveDialog.getBoundingClientRect().top;
    improveDialog.style.cursor = 'grabbing';
    improveDialog.style.position = 'fixed';
    improveDialog.style.zIndex = 9999;
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      improveDialog.style.left = x + 'px';
      improveDialog.style.top = y + 'px';
      improveDialog.style.transform = 'none';
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      improveDialog.style.cursor = 'default';
    }
  });
  // --- End draggable logic ---
  
  // Create dialog content
  const dialogContent = document.createElement('div');
  dialogContent.className = 'levelup-dialog-content';
  
  // Create original text section
  const originalSection = document.createElement('div');
  originalSection.className = 'levelup-section';
  
  const originalHeader = document.createElement('div');
  originalHeader.className = 'levelup-section-header';
  
  const originalLabel = document.createElement('div');
  originalLabel.className = 'levelup-section-label';
  originalLabel.textContent = 'Original Prompt';
  
  const originalCopyButton = document.createElement('button');
  originalCopyButton.className = 'levelup-copy-btn';
  originalCopyButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy
  `;
  
  // Add click event to copy button
  originalCopyButton.addEventListener('click', function() {
    navigator.clipboard.writeText(originalText).then(() => {
      console.log('Original text copied to clipboard');
      showCopyNotification(originalCopyButton);
    }).catch(err => {
      console.error('Error copying text: ', err);
    });
  });
  
  originalHeader.appendChild(originalLabel);
  originalHeader.appendChild(originalCopyButton);
  
  const originalTextElement = document.createElement('div');
  originalTextElement.className = 'levelup-text-input';
  originalTextElement.textContent = originalText;
  
  originalSection.appendChild(originalHeader);
  originalSection.appendChild(originalTextElement);
  
  // Create the "Add Context" button and container
  const addContextButton = document.createElement('button');
  addContextButton.className = 'levelup-add-context';
  addContextButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
    Add Context
  `;
  
  // Create the context container (initially hidden)
  const contextContainer = document.createElement('div');
  contextContainer.className = 'levelup-context-container';
  contextContainer.style.display = 'none';
  contextContainer.style.marginTop = '10px';
  contextContainer.style.padding = '15px';
  contextContainer.style.backgroundColor = '#f5f7fa';
  contextContainer.style.borderRadius = '8px';
  
  // Add header for the context section
  const contextHeader = document.createElement('div');
  contextHeader.textContent = 'Add additional context to improve the results';
  contextHeader.style.fontSize = '14px';
  contextHeader.style.marginBottom = '10px';
  
  // Create the context input area
  const contextInput = document.createElement('textarea');
  contextInput.className = 'levelup-context-input';
  contextInput.placeholder = 'E.g., The text should mention interstellar travel and alien civilizations...';
  contextInput.rows = 3;
  contextInput.style.width = '100%';
  contextInput.style.padding = '8px';
  contextInput.style.borderRadius = '4px';
  contextInput.style.border = '1px solid #ddd';
  contextInput.style.resize = 'vertical';
  contextInput.style.fontFamily = 'inherit';
  
  // Create action buttons for context
  const contextActions = document.createElement('div');
  contextActions.style.display = 'flex';
  contextActions.style.justifyContent = 'flex-end';
  contextActions.style.marginTop = '10px';
  
  // Previous button
  const previousButton = document.createElement('button');
  previousButton.textContent = 'Previous';
  previousButton.className = 'levelup-nav-btn';
  previousButton.style.marginRight = '8px';
  previousButton.style.backgroundColor = 'transparent';
  previousButton.style.border = '1px solid #ddd';
  previousButton.style.borderRadius = '4px';
  previousButton.style.padding = '5px 10px';
  previousButton.style.cursor = 'pointer';
  
  // Next button
  const nextButton = document.createElement('button');
  nextButton.textContent = 'Next';
  nextButton.className = 'levelup-nav-btn';
  nextButton.style.marginRight = '8px';
  nextButton.style.backgroundColor = 'transparent';
  nextButton.style.border = '1px solid #ddd';
  nextButton.style.borderRadius = '4px';
  nextButton.style.padding = '5px 10px';
  nextButton.style.cursor = 'pointer';
  
  // Copy button
  const copyContextButton = document.createElement('button');
  copyContextButton.className = 'levelup-copy-btn';
  copyContextButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy
  `;
  copyContextButton.style.marginRight = '8px';
  
  // Apply button
  const applyButton = document.createElement('button');
  applyButton.textContent = 'Apply';
  applyButton.className = 'levelup-apply-btn';
  applyButton.style.backgroundColor = '#1a73e8';
  applyButton.style.color = 'white';
  applyButton.style.border = 'none';
  applyButton.style.borderRadius = '4px';
  applyButton.style.padding = '5px 15px';
  applyButton.style.cursor = 'pointer';
  
  // Add the buttons to context actions
  contextActions.appendChild(previousButton);
  contextActions.appendChild(nextButton);
  contextActions.appendChild(copyContextButton);
  contextActions.appendChild(applyButton);
  
  // Add elements to the context container
  contextContainer.appendChild(contextHeader);
  contextContainer.appendChild(contextInput);
  contextContainer.appendChild(contextActions);
  
  // Toggle context container visibility
  addContextButton.addEventListener('click', function() {
    if (contextContainer.style.display === 'none') {
      contextContainer.style.display = 'block';
      addContextButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Hide Context
      `;
    } else {
      contextContainer.style.display = 'none';
      addContextButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Add Context
      `;
    }
  });
  
  // Apply button functionality - regenerate with context
  applyButton.addEventListener('click', function() {
    const additionalContext = contextInput.value.trim();
    if (additionalContext) {
      // Show loading indicator
      removeImproveDialog();
      const loadingDialog = createLoadingIndicator('Improving with context...');
      
      // Create a prompt that includes the additional context
      const contextPrompt = `Improve the following text to make it more clear, concise, and engaging. 
      Additional context to consider: ${additionalContext}
      
      "${originalText}"
      
      Return only the improved text without any explanations or additional content.`;
      
      // Call API with the context-enhanced prompt
      callGeminiAPI(contextPrompt, originalText, loadingDialog, additionalContext);
    }
  });
  
  // Add context button and container after original section
  originalSection.appendChild(addContextButton);
  originalSection.appendChild(contextContainer);
  
  // Create improved text section
  const improvedSection = document.createElement('div');
  improvedSection.className = 'levelup-section';
  
  const improvedHeader = document.createElement('div');
  improvedHeader.className = 'levelup-section-header';
  
  const improvedLabel = document.createElement('div');
  improvedLabel.className = 'levelup-section-label';
  improvedLabel.textContent = 'Enhanced Prompt';
  
  const headerButtons = document.createElement('div');
  headerButtons.style.display = 'flex';
  headerButtons.style.gap = '8px';
  
  const repromptButton = document.createElement('button');
  repromptButton.className = 'levelup-reprompt-btn';
  repromptButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
    </svg>
    Regenerate
  `;
  
  // Add click event to regenerate button
  repromptButton.addEventListener('click', function() {
    // Handle regenerating the improved text
    console.log('Regenerating improved text');
    improveText(originalText, true);
    removeImproveDialog();
  });
  
  const improvedCopyButton = document.createElement('button');
  improvedCopyButton.className = 'levelup-copy-btn';
  improvedCopyButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy
  `;
  
  // Add click event to copy button
  improvedCopyButton.addEventListener('click', function() {
    navigator.clipboard.writeText(improvedText).then(() => {
      console.log('Improved text copied to clipboard');
      showCopyNotification(improvedCopyButton);
    }).catch(err => {
      console.error('Error copying text: ', err);
    });
  });
  
  headerButtons.appendChild(repromptButton);
  headerButtons.appendChild(improvedCopyButton);
  
  improvedHeader.appendChild(improvedLabel);
  improvedHeader.appendChild(headerButtons);
  
  const improvedTextElement = document.createElement('div');
  improvedTextElement.className = 'levelup-text-improved';
  improvedTextElement.textContent = improvedText;
  
  // Create feedback section
  const feedbackSection = document.createElement('div');
  feedbackSection.className = 'levelup-feedback';
  
  feedbackSection.innerHTML = `
    <span>Was this helpful?</span>
    <button class="levelup-thumbs-btn" title="This was helpful">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
      </svg>
    </button>
    <button class="levelup-thumbs-btn" title="This was not helpful">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
      </svg>
    </button>
  `;
  
  improvedSection.appendChild(improvedHeader);
  improvedSection.appendChild(improvedTextElement);
  improvedSection.appendChild(feedbackSection);
  
  // Create tone section
  const toneSection = document.createElement('div');
  toneSection.className = 'levelup-tone-section';
  
  const toneHeader = document.createElement('div');
  toneHeader.className = 'levelup-tone-header';
  
  const toneIcon = document.createElement('div');
  toneIcon.className = 'levelup-tone-icon';
  toneIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"></path>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="M20 12h2"></path>
      <path d="M2 12h2"></path>
    </svg>
  `;
  
  const toneLabel = document.createElement('span');
  toneLabel.textContent = 'Select Tone';
  
  toneHeader.appendChild(toneIcon);
  toneHeader.appendChild(toneLabel);
  
  // Create tone buttons
  const toneButtons = document.createElement('div');
  toneButtons.className = 'levelup-tone-buttons';
  
  // Define available tones
  const tones = ['Professional', 'Casual', 'Creative', 'Technical'];
  
  // Create a button for each tone
  tones.forEach((tone, index) => {
    const toneButton = document.createElement('button');
    toneButton.className = 'levelup-tone-btn';
    toneButton.textContent = tone;
    toneButton.setAttribute('data-tone', tone);
    
    // Add active class to the first button by default
    if (index === 0) {
      toneButton.classList.add('active');
    }
    
    // Add click event to tone button
    toneButton.addEventListener('click', function() {
      console.log('Tone button clicked:', tone);
      
      // Remove active class from all buttons
      document.querySelectorAll('.levelup-tone-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to clicked button
      this.classList.add('active');
      console.log('Added active class to button');
      
      // Get any context that might have been added
      let contextInput = document.querySelector('.levelup-context-input');
      let additionalContext = '';
      if (contextInput && contextInput.value) {
        additionalContext = contextInput.value.trim();
        console.log('Found additional context:', additionalContext);
      }
      
      // Verify that originalText exists and is not empty
      if (!originalText) {
        console.error('Original text is missing or empty');
        alert('Cannot apply tone: the original text is no longer available.');
        return;
      }
      
      // Generate improved text with the selected tone
      console.log(`Regenerating with "${tone}" tone for text: ${originalText.substring(0, 30)}...`);
      
      let prompt;
      if (tone === 'Technical') {
        prompt = `As an expert prompt engineer, create a CONCISE, TECHNICAL prompt (max 3-4 sentences). Focus on technical accuracy, precision, and developer-friendly language:

        "${originalText}"
        
        Return ONLY the enhanced technical prompt with NO explanations.`;
      } else {
        prompt = `As an expert prompt engineer, create a CONCISE, OPTIMIZED prompt (max 3-4 sentences) with a ${tone.toLowerCase()} tone:
        
        "${originalText}"
        
        Return ONLY the enhanced prompt with NO explanations.`;
      }
      
      console.log('Created prompt for tone regeneration');
      
      // Show loading indicator
      removeImproveDialog();
      const loadingDialog = createLoadingIndicator(`Applying ${tone} tone...`);
      console.log('Created loading dialog for tone regeneration');
      
      // Call API with new prompt
      callGeminiAPI(prompt, originalText, loadingDialog, additionalContext);
    });
    
    toneButtons.appendChild(toneButton);
  });
  
  toneSection.appendChild(toneHeader);
  toneSection.appendChild(toneButtons);
  dialogContent.appendChild(toneSection);

  // Create the dialog actions
  const dialogActions = document.createElement('div');
  dialogActions.className = 'levelup-dialog-actions';
  
  // Create insert button
  const insertButton = document.createElement('button');
  insertButton.className = 'levelup-insert-btn';
  insertButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Insert Enhanced Prompt
  `;
  
  // Add event listener to insert button
  insertButton.addEventListener('click', function() {
    console.log('Insert button clicked, inserting enhanced prompt');
    replaceSelectedText(improvedText);
    removeImproveDialog();
  });
  
  dialogActions.appendChild(insertButton);
  
  // Assemble the dialog
  improveDialog.appendChild(dialogHeader);
  
  // Add sections to dialog content
  dialogContent.appendChild(originalSection);
  dialogContent.appendChild(improvedSection);
  
  improveDialog.appendChild(dialogContent);
  improveDialog.appendChild(dialogActions);
  
  // Add the dialog to the document
  document.body.appendChild(improveDialog);
  
  // Helper function for copy notification
  function showCopyNotification(button) {
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Copied!</span>
    `;
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
  }
}

// Function to remove the improve dialog
function removeImproveDialog() {
  if (improveDialog && improveDialog.parentNode) {
    improveDialog.parentNode.removeChild(improveDialog);
    improveDialog = null;
  }
}

// Debug function to force-create the floating toolbar - can be called from console
window.debugCreateFloatingBar = function() {
  console.log('Forcing creation of floating toolbar for debugging');
  // Calculate center of viewport
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const x = viewportWidth / 2;
  const y = viewportHeight / 2;
  
  // Create dummy text for testing
  selectedText = 'Test text for toolbar debug';
  createFloatingBar(x, y);
  console.log('Debug floating toolbar created at center of viewport');
  return 'Toolbar created. If not visible, check console for errors.';
};

// Function to create loading indicator
function createLoadingIndicator(message) {
  const loadingDialog = document.createElement('div');
  loadingDialog.className = 'levelup-loading';
  
  // Add spinner
  const spinner = document.createElement('div');
  spinner.className = 'levelup-loading-spinner';
  loadingDialog.appendChild(spinner);
  
  // Add main text
  const loadingText = document.createElement('div');
  loadingText.textContent = message || 'Improving your text...';
  loadingDialog.appendChild(loadingText);
  
  // Add status text
  const statusText = document.createElement('div');
  statusText.className = 'levelup-status';
  statusText.textContent = 'Preparing request...';
  loadingDialog.appendChild(statusText);
  
  // Add to document
  document.body.appendChild(loadingDialog);
  
  return loadingDialog;
}

// Function to call Gemini API
function callGeminiAPI(prompt, originalText, loadingDialog, additionalContext = '') {
  const statusText = loadingDialog.querySelector('.levelup-status');
  const updateStatus = (message) => {
    statusText.textContent = message;
  };
  
  // Force-reload settings before making API call
  updateStatus('Loading settings...');
  chrome.storage.sync.get({
    apiKey: '',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    markdown: true
  }, function(items) {
    // Update global variables with the latest settings
    API_KEY = items.apiKey;
    MODEL = 'gemini-2.0-flash';
    TEMPERATURE = items.temperature;
    MARKDOWN_ENABLED = items.markdown;
    
    console.log('Using API key:', API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No');
    updateStatus('Settings loaded');
    
    // Check if API key is set
    if (!API_KEY) {
      console.error('API key is not set');
      // Remove loading indicator
      if (loadingDialog && loadingDialog.parentNode) {
        loadingDialog.parentNode.removeChild(loadingDialog);
      }
      alert('Please set your Gemini API Key in the extension settings (click the LevelUp icon in your browser toolbar)');
      return;
    }
    
    // Prepare the API request
    updateStatus('Preparing API request...');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    console.log('Making API request to:', apiUrl.replace(API_KEY, 'HIDDEN'));
    
    // Build the prompt with context if provided
    let finalPrompt = prompt;
    if (additionalContext && !prompt.includes('Additional context')) {
      finalPrompt = `As an expert prompt engineer, create a CONCISE, OPTIMIZED prompt (max 3-4 sentences):
      Additional context to consider: ${additionalContext}
      
      "${originalText}"
      
      Return ONLY the enhanced prompt with NO explanations.`;
    }
    
    console.log('Using prompt with context:', additionalContext ? 'Yes' : 'No');
    
    const requestBody = {
      contents: [{
        parts: [{
          text: finalPrompt
        }]
      }],
      generationConfig: {
        temperature: TEMPERATURE
      }
    };
    
    console.log('Request body:', JSON.stringify(requestBody).substring(0, 200) + '...');
    
    // Make the API request
    updateStatus('Sending request to Gemini API...');
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      console.log('API response status:', response.status);
      updateStatus('Response received: ' + response.status);
      
      // Check if the response is ok
      if (!response.ok) {
        if (response.status === 400) {
          console.error('Bad request error (400) - Check your API key and parameters');
          throw new Error('Invalid request. Please verify your API key is correct and try again.');
        } else if (response.status === 401) {
          console.error('Unauthorized error (401) - API key is invalid or expired');
          throw new Error('API key is invalid or expired. Please check your settings and try again.');
        } else if (response.status === 403) {
          console.error('Forbidden error (403) - API key may not have permission for this operation');
          throw new Error('Access denied. Your API key may not have permission for this model.');
        } else if (response.status === 429) {
          console.error('Rate limit exceeded (429) - Too many requests');
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          console.error('API request failed with status:', response.status);
          throw new Error(`API request failed with status ${response.status}`);
        }
      }
      
      return response.json();
    })
    .then(data => {
      // Remove loading indicator
      if (loadingDialog && loadingDialog.parentNode) {
        loadingDialog.parentNode.removeChild(loadingDialog);
      }
      
      console.log('API response data:', data);
      
      try {
        // Extract the generated text from the response
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
          
          const improvedText = data.candidates[0].content.parts[0].text;
          console.log('Improved text:', improvedText.substring(0, 50) + (improvedText.length > 50 ? '...' : ''));
          
          // Create dialog with the improved text
          if (improvedText) {
            createImproveDialog(originalText, improvedText, 'Gemini');
          } else {
            console.error('Empty response from API');
            alert('The API returned an empty response. Please try again.');
          }
        } else {
          console.error('Unexpected API response format:', data);
          alert('Unexpected response format from the API. Please try again.');
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        alert('Error processing the API response. Please try again.');
      }
    })
    .catch(error => {
      // Remove loading indicator
      if (loadingDialog && loadingDialog.parentNode) {
        loadingDialog.parentNode.removeChild(loadingDialog);
      }
      
      console.error('Error calling Gemini API:', error);
      
      // Handle the [object Object] error case specifically
      let errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage === '[object Object]') {
        errorMessage = 'Communication error with the extension. Please check your API key and try again.';
      }
      
      alert('Error: ' + errorMessage);
    });
  });
}

// Update the improveText function to ensure it removes the floating bar
function improveText(text, isReprompt = false, additionalContext = '') {
  try {
    console.log(`${isReprompt ? 'Reprompting' : 'Enhancing'} prompt:`, text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    // Make sure the floating bar is removed
    removeFloatingBar();
    
    // Validate input text
    if (!text || text.trim() === '') {
      console.error('Cannot enhance empty prompt');
      alert('Please select a prompt to enhance');
      return;
    }
    
    // Create a loading indicator
    const message = isReprompt ? 'Generating new version...' : 'Enhancing your prompt...';
    const loadingDialog = createLoadingIndicator(message);
    
    // Create the prompt for Gemini to act as a prompt engineer - optimized for brevity
    let prompt = `As an expert prompt engineer, enhance this prompt to be more effective for AI models. Create a CONCISE, OPTIMIZED prompt (max 3-4 sentences) with:
- Clear instructions
- Specific details only when needed
- Professional structure
- No unnecessary words

Only add detailed instructions when a specific tone is mentioned. Return only the enhanced prompt:`;
    
    // Add additional context if provided
    if (additionalContext) {
      prompt += `\nAdditional context to consider: ${additionalContext}`;
    }
    
    prompt += `\n\n"${text}"\n\nReturn ONLY the enhanced prompt with NO explanations.`;
    
    if (isReprompt) {
      // Add variation to the prompt for reprompt
      prompt = `As an expert prompt engineer, create a fresh, concise version (max 3-4 sentences) of this prompt:`;
      
      if (additionalContext) {
        prompt += `\nAdditional context to consider: ${additionalContext}`;
      }
      
      prompt += `\n\n"${text}"\n\nReturn ONLY the enhanced prompt with NO explanations.`;
    }
    
    // Call the API with the prompt
    callGeminiAPI(prompt, text, loadingDialog, additionalContext);
  } catch (error) {
    console.error('Error in improveText function:', error);
    alert('An error occurred while processing your request. Please try again.');
  }
}

// Function to replace the selected text
function replaceSelectedText(newText) {
  console.log('Attempting to replace selected text with:', newText.substring(0, 50) + (newText.length > 50 ? '...' : ''));
  
  try {
    // First try to use the stored original range (most reliable)
    if (originalRange) {
      console.log('Using stored original range for replacement');
      
      // Create a new range and set it to the original range
      const range = document.createRange();
      range.setStart(originalRange.startContainer, originalRange.startOffset);
      range.setEnd(originalRange.endContainer, originalRange.endOffset);
      
      // Delete contents and insert new text
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      
      console.log('Text successfully replaced using original range');
      
      // Clear the selection
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      return;
    }
    
    // If no original range, check if we have the original element
    if (!originalElement) {
      console.error('Original element is not available for text replacement');
      
      // Try to get the current selection as a fallback
      const currentSelection = window.getSelection();
      if (currentSelection && currentSelection.rangeCount > 0) {
        console.log('Using current selection as fallback');
        const range = currentSelection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        console.log('Text inserted using current selection');
        return;
      }
      
      alert('Cannot replace text: the original selection is no longer available.');
      return;
    }
    
    // Get current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.error('No selection available for text replacement');
      
      // Try to use the original element to create a new range
      console.log('Trying to create a new range with the original element');
      try {
        const range = document.createRange();
        // If the original element is an input/textarea, handle differently
        if (originalElement.tagName === 'INPUT' || originalElement.tagName === 'TEXTAREA') {
          // For form elements, simply set the value
          originalElement.value = newText;
          console.log('Text inserted into form element');
          return;
        }
        
        // For contentEditable elements or regular elements with text nodes
        range.selectNodeContents(originalElement);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        console.log('Text inserted using newly created range');
        return;
      } catch (rangeError) {
        console.error('Failed to create a replacement range:', rangeError);
        alert('Cannot replace text: unable to locate the original selection position.');
        return;
      }
    }
    
    console.log('Selection found, proceeding with replacement');
    const range = selection.getRangeAt(0);
    
    // Store references to the container nodes before deletion
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    // Delete the current contents
    range.deleteContents();
    
    // Create a text node with the new text
    const textNode = document.createTextNode(newText);
    
    // Insert the new text
    range.insertNode(textNode);
    
    // Try to adjust the selection to encompass the new text
    try {
      const newRange = document.createRange();
      newRange.selectNode(textNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
      selection.removeAllRanges(); // Clear selection after placing text
    } catch (selError) {
      console.warn('Could not reset selection after text insertion:', selError);
    }
    
    console.log('Text successfully replaced');
  } catch (error) {
    console.error('Error replacing text:', error);
    alert('Failed to replace text. Please try again or copy the text manually.');
  }
}

// Listen for text selection with debouncing
let selectionTimeout = null;
document.addEventListener('mouseup', function(e) {
  try {
    console.log('Mouse up event triggered');
    
    // Clear any existing timeout
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    
    // Use a short delay to allow selection to complete
    selectionTimeout = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection) {
        console.warn('Selection API not available');
        return;
      }
      
      selectedText = selection.toString().trim();
      console.log('Selection event triggered, text length:', selectedText.length);
      
      // Only show the floating bar if there's actual text selected
      if (selectedText && selectedText.length > 1) {
        try {
          // Store the current element
          if (selection.anchorNode) {
            originalElement = selection.anchorNode.parentElement;
            console.log('Parent element:', originalElement.tagName);
          } else {
            console.warn('No anchorNode in selection');
          }
          
          // Store the original selection range
          if (selection.rangeCount > 0) {
            // Clone the range to preserve it
            originalRange = selection.getRangeAt(0).cloneRange();
            console.log('Stored original selection range');
            
            // Calculate position for floating toolbar
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            console.log('Selection rect:', {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            });
            
            // Calculate position for the floating bar
            // For fixed positioning, we use viewport coordinates
            const x = rect.left;
            const y = Math.max(10, rect.top - 50); // Position toolbar above the selection
            
            console.log('Calculated position for floating bar:', { x, y });
            
            // Create floating toolbar with a short delay to ensure selection is stable
            setTimeout(() => {
              console.log('Creating floating toolbar at coordinates:', x, y);
              createFloatingBar(x, y);
              
              // Add a backup check to see if the toolbar was actually created and visible
              setTimeout(() => {
                if (!floatingBar || !floatingBar.parentNode) {
                  console.warn('Floating bar not found in DOM after creation attempt, trying again with fallback position');
                  // Try again with a fallback position in the middle of the viewport
                  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                  const fallbackX = viewportWidth / 2 - 85;
                  const fallbackY = viewportHeight / 3;
                  createFloatingBar(fallbackX, fallbackY);
                }
              }, 100);
            }, 50);
            
            console.log('Selection detected:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
          } else {
            console.warn('No range in selection');
          }
        } catch (selectionError) {
          console.error('Error processing selection:', selectionError);
        }
      } else {
        // Don't remove floating bar immediately to avoid issues with clicking on it
        setTimeout(() => {
          // Only remove if there's still no selection
          if (!window.getSelection().toString().trim()) {
            removeFloatingBar();
          }
        }, 200);
      }
    }, 100); // Short delay to ensure selection is complete
  } catch (error) {
    console.error('Error in mouseup event handler:', error);
  }
});

// Close floating bar when clicking elsewhere
document.addEventListener('mousedown', function(e) {
  // Check if the click is outside the floating bar and improve dialog
  if (floatingBar && !floatingBar.contains(e.target)) {
    const selection = window.getSelection();
    if (selection.toString().trim() === '') {
      removeFloatingBar();
    }
  }
  
  if (improveDialog && !improveDialog.contains(e.target)) {
    // Don't close the dialog when clicking outside
    // This is intentional to match the behavior in the images
  }
});

// Listen for messages from the background script with better error handling
(function setupMessageListener() {
  try {
    // Check if chrome and chrome.runtime exist
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('Chrome runtime API not available - message listener not set up');
      return;
    }
    
    // Set up the message listener
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      console.log('Message received from background script:', request);
      
      if (request.action === "improveSelectedText" && request.text) {
        selectedText = request.text;
        console.log('Improving text from context menu:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
        
        // Send an immediate response to prevent "message port closed" errors
        sendResponse({status: "processing"});
        
        // Then handle the actual text improvement
        improveText(request.text);
      } else {
        // Always send a response even if we don't recognize the action
        sendResponse({status: "unknown_action"});
      }
      
      // Return false since we've already sent the synchronous response
      return false;
    });
    
    console.log('Message listener set up successfully');
  } catch (error) {
    console.error('Error setting up message listener:', error);
  }
})();

// Listen for port connections from the background script
(function setupPortListener() {
  try {
    // Check if chrome and chrome.runtime exist
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('Chrome runtime API not available - port listener not set up');
      return;
    }
    
    // Set up the port connection listener
    chrome.runtime.onConnect.addListener(function(port) {
      console.log('Port connected from background script:', port.name);
      
      // Listen for messages on this port
      port.onMessage.addListener(function(message) {
        console.log('Port message received:', message);
        
        if (message.action === "improveSelectedText" && message.text) {
          selectedText = message.text;
          console.log('Improving text from port message:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
          
          // Handle the text improvement - no need to respond via port
          improveText(message.text);
        }
      });
      
      // Handle port disconnection
      port.onDisconnect.addListener(function() {
        console.log('Port disconnected:', port.name);
        if (chrome.runtime.lastError) {
          console.error('Port error:', chrome.runtime.lastError);
        }
      });
    });
    
    console.log('Port listener set up successfully');
  } catch (error) {
    console.error('Error setting up port listener:', error);
  }
})();

// Add DOM Ready event listener to ensure everything is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  loadSettings();
  addRegenerationStyles();
  
  // Add a global shortcut for showing floating toolbar
  document.addEventListener('keydown', function(e) {
    // Alt+I to show the toolbar at cursor position
    if (e.altKey && e.key === 'i') {
      console.log('Alt+I shortcut detected');
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        selectedText = selection.toString().trim();
        console.log('Selection from shortcut:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
        
        // Get cursor position or selection position
        let x = 0, y = 0;
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          x = rect.left;
          y = rect.top - 50;
        }
        
        createFloatingBar(x, y);
      } else {
        alert('Select text first to use the Improve feature');
      }
    }
  });
});

// Define a global variable to access this function from the console for debugging
window.debugSelection = function() {
  const selection = window.getSelection();
  if (!selection) {
    console.warn('Selection API not available');
    return 'Selection API not available';
  }
  
  const text = selection.toString().trim();
  console.log('Current selection text:', text);
  
  if (text && text.length > 0) {
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      console.log('Selection rect:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      return `Selection found: ${text.substring(0, 50)}... at position (${rect.left}, ${rect.top})`;
    }
    return `Selection found: ${text.substring(0, 50)}... but could not get position`;
  }
  return 'No text currently selected';
};

// Function that can be called from the console to manually create a toolbar
window.createManualToolbar = function() {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const x = viewportWidth / 2 - 85;
  const y = viewportHeight / 3;
  
  // Use some dummy text
  selectedText = 'This is a test selection for the floating toolbar';
  createFloatingBar(x, y);
  return 'Manual toolbar created. Check console for details.';
};

// Add a new fast regenerate function for more efficient regeneration
function fastRegenerate(originalText, additionalContext, callback) {
  console.log('Fast regenerating text:', originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''));
  
  // Check if API key is present
  chrome.storage.sync.get({
    apiKey: '',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    markdown: true
  }, function(items) {
    // Update global variables with the latest settings
    API_KEY = items.apiKey;
    MODEL = 'gemini-2.0-flash';
    TEMPERATURE = items.temperature;
    MARKDOWN_ENABLED = items.markdown;
    
    if (!API_KEY) {
      console.error('API key is not set');
      callback(null); // Signal failure
      alert('Please set your Gemini API Key in the extension settings (click the PromptPerfect icon in your browser toolbar)');
      return;
    }
    
    // Create a streamlined prompt optimized for fast regeneration
    let prompt = `Rewrite and improve this text with a fresh perspective, preserving the original meaning:`;
    
    if (additionalContext) {
      prompt += `\nConsider this context: ${additionalContext}`;
    }
    
    prompt += `\n\n"${originalText}"\n\nReturn only the improved text.`;
    
    // Use a higher temperature for regeneration to increase variation
    const regenerateTemperature = Math.min(TEMPERATURE + 0.2, 1.0);
    
    // Make a direct API call
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: regenerateTemperature // Use higher temperature for more variation
      }
    };
    
    // Make API request with priority flag for faster processing
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Client': 'LevelUp-Extension' // Helps identify traffic source
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      try {
        // Extract the generated text from the response
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
          
          const improvedText = data.candidates[0].content.parts[0].text;
          console.log('Regenerated text:', improvedText.substring(0, 50) + (improvedText.length > 50 ? '...' : ''));
          
          // Call the callback with the regenerated text
          callback(improvedText);
        } else {
          console.error('Unexpected API response format:', data);
          callback(null); // Signal failure
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        callback(null); // Signal failure
      }
    })
    .catch(error => {
      console.error('Error calling Gemini API for regeneration:', error);
      callback(null); // Signal failure
    });
  });
}

// Add CSS for the regeneration indication
function addRegenerationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .levelup-regenerating {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      padding: 20px 0;
    }
    
    .levelup-mini-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 2px solid #1a73e8;
      animation: mini-spin 1s linear infinite;
      margin-bottom: 10px;
    }
    
    .dark-theme .levelup-mini-spinner {
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top: 2px solid #8ab4f8;
    }
    
    @keyframes mini-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// Function to get meaning of text using Gemini
function getTextMeaning(text, isReprompt = false, additionalContext = '') {
  try {
    console.log('Getting meaning for text:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    
    // Create a loading indicator
    const message = isReprompt ? 'Regenerating meaning...' : 'Getting meaning...';
    const loadingDialog = createLoadingIndicator(message);
    
    // Create the prompt for Gemini
    let prompt = `Provide a VERY CONCISE meaning of the following text (maximum 2-3 lines or 40 words):

"${text}"

Then, in a SEPARATE SECTION, provide 2-3 practical EXAMPLES showing how this word/phrase is used in different contexts. Format examples as bullet points and BOLD the selected word/phrase where it appears in examples.

Format your response EXACTLY as follows with clear separation:

**Meaning:**
[short, concise definition - maximum 2-3 lines]

**Examples:**
• [Example 1 with **selected word** highlighted]
• [Example 2 with **selected word** highlighted]
• [Example 3 with **selected word** highlighted]`;

    // Add additional context if provided
    if (additionalContext) {
      prompt = `Provide a VERY CONCISE meaning of the following text (maximum 2-3 lines or 40 words).
IMPORTANT: Use this additional context when explaining: ${additionalContext}

"${text}"

Then, in a SEPARATE SECTION, provide 2-3 practical EXAMPLES showing how this word/phrase is used in different contexts. Format examples as bullet points and BOLD the selected word/phrase where it appears in examples.

Format your response EXACTLY as follows with clear separation:
**Meaning:**
[short, concise definition that incorporates the provided context - maximum 2-3 lines]

**Examples:**
• [Example 1 with **selected word** highlighted]
• [Example 2 with **selected word** highlighted]
• [Example 3 with **selected word** highlighted]`;
    }
    
    // Call Gemini API
    chrome.storage.sync.get({
      apiKey: '',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      markdown: true
    }, function(items) {
      // Update global variables with the latest settings
      API_KEY = items.apiKey;
      MODEL = 'gemini-2.0-flash';
      TEMPERATURE = items.temperature;
      MARKDOWN_ENABLED = items.markdown;
      
      // Check if API key is set
      if (!API_KEY) {
        console.error('API key is not set');
        if (loadingDialog && loadingDialog.parentNode) {
          loadingDialog.parentNode.removeChild(loadingDialog);
        }
        alert('Please set your Gemini API Key in the extension settings');
        return;
      }
      
      // Prepare API request
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
      
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: TEMPERATURE
        }
      };
      
      // Make API request
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Remove loading indicator
        if (loadingDialog && loadingDialog.parentNode) {
          loadingDialog.parentNode.removeChild(loadingDialog);
        }
        
        try {
          // Extract the generated text from the response
          if (data.candidates && data.candidates.length > 0 && 
              data.candidates[0].content && 
              data.candidates[0].content.parts && 
              data.candidates[0].content.parts.length > 0) {
            
            const meaningText = data.candidates[0].content.parts[0].text;
            
            // Create dialog with the meaning
            if (meaningText) {
              createMeaningDialog(text, meaningText, additionalContext);
            } else {
              console.error('Empty response from API');
              alert('The API returned an empty response. Please try again.');
            }
          } else {
            console.error('Unexpected API response format:', data);
            alert('Unexpected response format from the API. Please try again.');
          }
        } catch (parseError) {
          console.error('Error parsing API response:', parseError);
          alert('Error processing the API response. Please try again.');
        }
      })
      .catch(error => {
        // Remove loading indicator
        if (loadingDialog && loadingDialog.parentNode) {
          loadingDialog.parentNode.removeChild(loadingDialog);
        }
        
        console.error('Error calling Gemini API:', error);
        alert('Error: ' + (error.message || 'Unknown error occurred'));
      });
    });
  } catch (error) {
    console.error('Error in getTextMeaning function:', error);
    alert('An error occurred while processing your request. Please try again.');
  }
}

// Function to create meaning dialog
function createMeaningDialog(originalText, meaningText, additionalContext = '') {
  // Save to history
  saveToHistory(originalText, meaningText, 'meaning');
  try {
    console.log('Creating meaning dialog for text:', originalText.substring(0, 30) + (originalText.length > 30 ? '...' : ''));

    // Remove any existing meaning dialog
    const existingDialog = document.querySelector('.levelup-meaning-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Parse meaning and examples from the response
    let meaning = '';
    let examples = '';
    
    // Split the response into sections based on the headings
    if (meaningText.includes('**Meaning:**') && meaningText.includes('**Examples:**')) {
      const meaningSection = meaningText.split('**Meaning:**')[1].split('**Examples:**')[0].trim();
      const examplesSection = meaningText.split('**Examples:**')[1].trim();
      
      meaning = meaningSection;
      examples = examplesSection;
    } else {
      // Fallback if format is not as expected
      meaning = meaningText;
    }

    // Create dialog element
    const dialog = document.createElement('div');
    dialog.className = 'levelup-dialog dark-theme'; // Set dark theme as default
    
    // Create header with title and close button
    const header = document.createElement('div');
    header.className = 'levelup-dialog-header';
    
    // Add logo icon to header
    const logoIcon = document.createElement('div');
    logoIcon.className = 'levelup-message-icon';
    logoIcon.innerHTML = `
      <img src="${chrome.runtime.getURL('icons/meaning_icon.png')}" width="24" height="24" alt="Meaning Icon">
    `;
    
    // Add title to header
    const dialogTitle = document.createElement('h2');
    dialogTitle.textContent = 'Text Meaning';
    
    // Create header actions container
    const headerActions = document.createElement('div');
    headerActions.className = 'levelup-header-actions';
    
    // Add dark mode toggle
    const darkModeButton = document.createElement('button');
    darkModeButton.className = 'levelup-theme-toggle';
    darkModeButton.title = 'Toggle Dark Mode';
    darkModeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
    
    // Add click event to dark mode toggle
    darkModeButton.addEventListener('click', function() {
      dialog.classList.toggle('dark-theme');
    });
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'levelup-close-btn';
    closeButton.title = 'Close';
    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    
    // Add event listener to close button
    closeButton.addEventListener('click', function() {
      dialog.remove();
    });
    
    // Assemble header with actions
    headerActions.appendChild(darkModeButton);
    headerActions.appendChild(closeButton);
    
    header.appendChild(logoIcon);
    header.appendChild(dialogTitle);
    header.appendChild(headerActions);
    
    // Create dialog content
    const dialogContent = document.createElement('div');
    dialogContent.className = 'levelup-dialog-content';
    
    // Create original text section
    const originalSection = document.createElement('div');
    originalSection.className = 'levelup-section';
    
    const originalHeader = document.createElement('div');
    originalHeader.className = 'levelup-section-header';
    
    const originalLabel = document.createElement('div');
    originalLabel.className = 'levelup-section-label';
    originalLabel.textContent = 'Original Text';
    
    const originalCopyButton = document.createElement('button');
    originalCopyButton.className = 'levelup-copy-btn';
    originalCopyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy
    `;
    
    // Add click event to copy button
    originalCopyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(originalText).then(() => {
        console.log('Original text copied to clipboard');
        showCopyNotification(originalCopyButton);
      }).catch(err => {
        console.error('Error copying text: ', err);
      });
    });
    
    originalHeader.appendChild(originalLabel);
    originalHeader.appendChild(originalCopyButton);
    
    const originalTextElement = document.createElement('div');
    originalTextElement.className = 'levelup-text-input';
    originalTextElement.textContent = originalText;
    
    originalSection.appendChild(originalHeader);
    originalSection.appendChild(originalTextElement);
    
    // Create the "Add Context" button and container
    const addContextButton = document.createElement('button');
    addContextButton.className = 'levelup-add-context';
    addContextButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      Add Context
    `;
    
    // Create the context container (initially hidden)
    const contextContainer = document.createElement('div');
    contextContainer.className = 'levelup-context-container';
    contextContainer.style.display = 'none';
    
    // Add header for the context section
    const contextHeader = document.createElement('div');
    contextHeader.textContent = 'Add additional context to improve the meaning';
    contextHeader.style.fontSize = '14px';
    contextHeader.style.marginBottom = '10px';
    
    // Create the context input area
    const contextInput = document.createElement('textarea');
    contextInput.className = 'levelup-context-input';
    contextInput.placeholder = 'E.g., The text is from a machine learning research paper, or I need this definition for a legal context...';
    contextInput.rows = 3;
    
    // Create action buttons for context
    const contextActions = document.createElement('div');
    contextActions.style.display = 'flex';
    contextActions.style.justifyContent = 'flex-end';
    contextActions.style.marginTop = '10px';
    
    // Apply button
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Get Specific Meaning';
    applyButton.className = 'levelup-apply-btn';
    
    // Add the button to context actions
    contextActions.appendChild(applyButton);
    
    // Add elements to the context container
    contextContainer.appendChild(contextHeader);
    contextContainer.appendChild(contextInput);
    contextContainer.appendChild(contextActions);
    
    // Toggle context container visibility
    addContextButton.addEventListener('click', function() {
      if (contextContainer.style.display === 'none') {
        contextContainer.style.display = 'block';
        addContextButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Hide Context
        `;
      } else {
        contextContainer.style.display = 'none';
        addContextButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Add Context
        `;
      }
    });
    
    // Apply button functionality - regenerate with context
    applyButton.addEventListener('click', function() {
      const newAdditionalContext = contextInput.value.trim();
      if (newAdditionalContext) {
        // Call the meaning function with context
        getTextMeaning(originalText, true, newAdditionalContext);
        // Close the current dialog
        dialog.remove();
      }
    });
    
    // Add context button and container after original section
    originalSection.appendChild(addContextButton);
    originalSection.appendChild(contextContainer);
    
    // Create meaning section
    const meaningSection = document.createElement('div');
    meaningSection.className = 'levelup-section';
    
    const meaningHeader = document.createElement('div');
    meaningHeader.className = 'levelup-section-header';
    
    const meaningLabel = document.createElement('div');
    meaningLabel.className = 'levelup-section-label';
    meaningLabel.textContent = 'Meaning';
    
    const headerButtons = document.createElement('div');
    headerButtons.style.display = 'flex';
    headerButtons.style.gap = '8px';
    
    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'levelup-nav-btn';
    regenerateButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
      </svg>
      Regenerate
    `;
    
    // Add click event to regenerate button
    regenerateButton.addEventListener('click', function() {
      // Handle regenerating the meaning
      console.log('Regenerating meaning');
      getTextMeaning(originalText, true, additionalContext);
      dialog.remove();
    });
    
    const meaningCopyButton = document.createElement('button');
    meaningCopyButton.className = 'levelup-copy-btn';
    meaningCopyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy
    `;
    
    // Add click event to copy button
    meaningCopyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(meaning).then(() => {
        console.log('Meaning text copied to clipboard');
        showCopyNotification(meaningCopyButton);
      }).catch(err => {
        console.error('Error copying text: ', err);
      });
    });
    
    headerButtons.appendChild(regenerateButton);
    headerButtons.appendChild(meaningCopyButton);
    
    meaningHeader.appendChild(meaningLabel);
    meaningHeader.appendChild(headerButtons);
    
    const meaningTextElement = document.createElement('div');
    meaningTextElement.className = 'levelup-text-improved';
    
    // Format the meaning text
    if (MARKDOWN_ENABLED) {
      meaningTextElement.innerHTML = meaning
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    } else {
      meaningTextElement.textContent = meaning;
    }
    
    meaningSection.appendChild(meaningHeader);
    meaningSection.appendChild(meaningTextElement);
    
    // Create examples section if available
    let examplesSection = null;
    if (examples) {
      examplesSection = document.createElement('div');
      examplesSection.className = 'levelup-section';
      
      const examplesHeader = document.createElement('div');
      examplesHeader.className = 'levelup-section-header';
      
      const examplesLabel = document.createElement('div');
      examplesLabel.className = 'levelup-section-label';
      examplesLabel.textContent = 'Examples';
      
      const examplesCopyButton = document.createElement('button');
      examplesCopyButton.className = 'levelup-copy-btn';
      examplesCopyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      `;
      
      // Add click event to copy button
      examplesCopyButton.addEventListener('click', function() {
        navigator.clipboard.writeText(examples).then(() => {
          console.log('Examples text copied to clipboard');
          showCopyNotification(examplesCopyButton);
        }).catch(err => {
          console.error('Error copying text: ', err);
        });
      });
      
      examplesHeader.appendChild(examplesLabel);
      examplesHeader.appendChild(examplesCopyButton);
      
      const examplesTextElement = document.createElement('div');
      examplesTextElement.className = 'levelup-text-improved levelup-examples-text';
      
      // Format the examples text
      if (MARKDOWN_ENABLED) {
        examplesTextElement.innerHTML = examples
          .replace(/•\s(.*?)(?=(?:\n•|\n\n|$))/gs, '<div class="levelup-example-item">• $1</div>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '<br><br>')
          .replace(/\n/g, '<br>');
      } else {
        examplesTextElement.textContent = examples;
      }
      
      examplesSection.appendChild(examplesHeader);
      examplesSection.appendChild(examplesTextElement);
    }
    
    // Add sections to content
    dialogContent.appendChild(originalSection);
    dialogContent.appendChild(meaningSection);
    if (examplesSection) {
      dialogContent.appendChild(examplesSection);
    }
    
    // Assemble dialog
    dialog.appendChild(header);
    dialog.appendChild(dialogContent);
    
    // If context was previously provided, show it in the input
    if (additionalContext) {
      contextInput.value = additionalContext;
      contextContainer.style.display = 'block';
      addContextButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Hide Context
      `;
    }
    
    // Add dialog to document
    document.body.appendChild(dialog);
    
    // Make dialog draggable
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - dialog.getBoundingClientRect().left;
      offsetY = e.clientY - dialog.getBoundingClientRect().top;
      dialog.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        dialog.style.left = x + 'px';
        dialog.style.top = y + 'px';
        dialog.style.transform = 'none';
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dialog.style.cursor = 'default';
      }
    });
    
    // Helper function to show copy notification
    function showCopyNotification(button) {
      const originalText = button.innerHTML;
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      setTimeout(() => {
        button.innerHTML = originalText;
      }, 2000);
    }
    
    return dialog;
  } catch (error) {
    console.error('Error creating meaning dialog:', error);
    return null;
  }
}

// Helper to save to history
function saveToHistory(original, enhanced, type) {
  if (!original || !enhanced) return;
  const entry = {
    id: Date.now(),
    original,
    enhanced,
    type,
    timestamp: new Date().toISOString(),
    starred: false
  };
  chrome.storage.local.get(['historyPrompts'], function(result) {
    let history = Array.isArray(result.historyPrompts) ? result.historyPrompts : [];
    history.unshift(entry);
    if (history.length > 20) history = history.slice(0, 20);
    chrome.storage.local.set({ historyPrompts: history });
  });
}
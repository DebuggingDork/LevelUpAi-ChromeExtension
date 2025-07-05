# LevelUp - Text Enhancement Chrome Extension

LevelUp is a Chrome extension that helps you improve your text or enhance your prompts with a simple selection.

## Features

- Select text on any webpage and see a floating icon
- Choose between "Improve Text" or "Enhance Prompt" options
- View and edit the processed text in a beautiful popup interface
- Copy the processed text to your clipboard with one click

## Installation

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click on "Load unpacked" and select the directory containing the extension files
5. The LevelUp extension icon should now appear in your browser toolbar

## How to Use

1. Select any text on a webpage
2. A floating "T" icon will appear near your selection
3. Click on the icon to see the options
4. Choose either "Improve Text" or "Enhance Prompt"
5. The text will be displayed in the popup window
6. Click "Process Text" to apply the selected operation
7. You can then copy the processed text to your clipboard

## Development

This extension uses vanilla JavaScript and does not require any build step or external dependencies.

### Project Structure

```
├── manifest.json      # Extension configuration
├── content.js         # Content script for text selection and floating icon
├── background.js      # Background script for communication
├── popup.html         # Popup UI
├── popup.js           # Popup functionality
└── icons/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

MIT 
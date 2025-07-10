# OpenMemory - AI Memory Sync Extension

🧠 **Share memory seamlessly across ChatGPT, Claude, Perplexity, Gemini, Zendesk and more!**

## ✨ Features

- **Cross-Platform Memory**: Works with ChatGPT, Claude, Perplexity, Gemini, Zendesk, and more
- **Smart Categorization**: Automatically organizes memories by topic 
- **Local Storage**: All data stays on your device - no servers needed
- **TF-IDF Search**: Advanced relevance scoring for intelligent memory retrieval
- **Conversation Grouping**: Groups related messages into coherent memory blocks
- **Export/Import**: Backup and share your memories
- **Customer Service Ready**: Perfect for CX teams using Zendesk + AI tools

## 🚀 Installation

### Chrome Web Store (Coming Soon)
[Link will be added once approved]

### Manual Installation (Available Now)

1. **Download the Extension**
   ```bash
   git clone https://github.com/code-mohanprakash/Openmemory.git
   # OR download ZIP from releases
   ```

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the extension folder
   - The OpenMemory icon should appear in your toolbar

3. **Start Using**
   - Visit ChatGPT, Claude, or any supported platform
   - Look for the green "🔄 Update Memory" button
   - Click to save memories, double-click to view them

## 🎯 Supported Platforms

- **AI Platforms**: ChatGPT, Claude, Perplexity, Gemini, Grok, You.com, Character.AI, Poe, HuggingFace
- **Customer Service**: Zendesk, Zendesk Government
- **More platforms being added regularly**

## 📱 How to Use

1. **Save Memories**: Click the "Update Memory" button to capture insights
2. **View Memories**: Double-click the button to see all saved memories
3. **Search**: Use the search bar in the memory overlay
4. **Categories**: Memories are auto-categorized (coding, business, customer_service, etc.)
5. **Export**: Download your memories as JSON for backup

## 🔒 Privacy

- **100% Local Storage**: All data stays on your device
- **No Servers**: We don't send your data anywhere
- **No Tracking**: No analytics or data collection
- **You Own Your Data**: Export/delete anytime

## 🛠️ For Developers

### Project Structure
```
browser-extension/
├── manifest.json          # Extension configuration
├── src/
│   ├── content-script.js  # Main functionality
│   ├── memory-engine.js   # Memory management
│   ├── background.js      # Service worker
│   └── styles.css         # Styling
├── popup/
│   ├── popup.html        # Extension popup
│   └── popup.js          # Popup functionality
└── icons/                # Extension icons
```

### Building
No build process required - it's vanilla JavaScript!

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🐛 Issues & Support

- **GitHub Issues**: https://github.com/code-mohanprakash/Openmemory/issues
- **Feature Requests**: Submit via GitHub issues
- **Bug Reports**: Include browser version and steps to reproduce

## 📄 License

MIT License - feel free to use and modify!

## 🎉 Changelog

### v1.0.0
- Initial release
- Support for ChatGPT, Claude, Perplexity, Gemini
- Added Zendesk integration for customer service teams
- TF-IDF search algorithm
- Local storage with export/import
- Smart categorization system

---

**Made with ❤️ for the AI community**
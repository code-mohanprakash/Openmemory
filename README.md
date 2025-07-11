# LocalBrain - AI Memory Sync Extension

A professional Chrome extension that automatically saves and shares memory across AI platforms (ChatGPT, Claude, Perplexity) while keeping all data stored locally in your browser.

## 🚀 Features

- **Universal AI Memory**: Works across ChatGPT, Claude, and Perplexity
- **Automatic Memory Saving**: Intelligently captures and categorizes conversations
- **Smart Memory Injection**: Suggests relevant memories for new conversations
- **Local Storage**: All data stays in your browser - no cloud dependency
- **Professional UI**: Modern glassmorphic design with smooth animations
- **Notification Management**: Smart rate-limiting prevents notification spam
- **Error Handling**: Production-ready error recovery and reporting

## 📋 Requirements

- Chrome/Chromium browser (version 88+)
- Node.js 16+ (for development)
- 10MB+ available storage space

## 🛠 Development Setup

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Install development tools globally (optional)
npm install -g eslint jest
```

### Available Scripts

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Build for production
npm run build

# Development mode (watch tests)
npm run dev
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- memory-engine.test.js

# Run tests with coverage report
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm test -- content-script.test.js
```

### End-to-End Tests
```bash
# Run E2E tests
npm test -- e2e.test.js
```

### Test Coverage Goals
- **Functions**: 80%+
- **Lines**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

## 🏗 Build Process

### Development Build
```bash
npm run build
```

### Production Build
```bash
# Runs linting, tests, and creates optimized build
node scripts/build.js
```

The build process:
1. ✅ Runs ESLint for code quality
2. 🧪 Executes full test suite
3. 📁 Creates optimized build in `dist/`
4. 📦 Generates extension package ZIP
5. 📊 Creates build info and documentation

## 📦 Installation

### For Development
1. Clone the repository
2. Run `npm install`
3. Load `src/` directory as unpacked extension in Chrome
4. Navigate to supported AI platforms to test

### For Production
1. Download the latest release ZIP
2. Extract to a folder
3. Load the extracted folder as unpacked extension
4. Or use the generated `.zip` file for Chrome Web Store submission

## 🔧 Configuration

### Environment Configuration
Edit `src/config.js` to customize:

```javascript
const CONFIG = {
  ENVIRONMENT: 'production', // 'development' | 'staging' | 'production'
  DEBUG: false,
  MAX_NOTIFICATIONS: 2,
  NOTIFICATION_COOLDOWN: 3000,
  // ... more settings
};
```

### Feature Flags
```javascript
FEATURES: {
  AUTO_MEMORY_SAVING: true,
  SMART_SUGGESTIONS: true,
  CONVERSATION_DETECTION: true,
  KEY_FACT_EXTRACTION: true,
  // ... more features
}
```

## 🎯 Platform Support

### ChatGPT (chat.openai.com)
- ✅ Message detection
- ✅ Memory button integration
- ✅ Conversation flow tracking

### Claude (claude.ai)
- ✅ Message detection
- ✅ Memory button integration
- ✅ Conversation flow tracking

### Perplexity (perplexity.ai)
- ✅ Message detection
- ✅ Memory button integration
- ✅ Conversation flow tracking

## 🔒 Privacy & Security

- **Local Storage Only**: All data stored in browser's local storage
- **No Cloud Sync**: No data sent to external servers
- **Content Filtering**: Automatically filters sensitive information
- **Secure Origins**: Only works on verified AI platform domains
- **Permission Minimal**: Requests only necessary browser permissions

## 🐛 Error Handling

### Production Error Handling
- Automatic error recovery
- Rate-limited error reporting
- Graceful degradation on failures
- User-friendly error notifications
- Extension auto-disable on critical errors

### Debug Mode
```javascript
// Enable debug mode in config.js
CONFIG.DEBUG = true;
CONFIG.VERBOSE_LOGGING = true;
```

## 📊 Performance

### Optimization Features
- Debounced message processing
- Intelligent content batching
- Storage quota management
- Memory cleanup routines
- Efficient DOM observation

### Performance Metrics
- Memory processing: <100ms
- UI interactions: <50ms
- Storage operations: <200ms
- Memory searches: <500ms

## 🚀 Deployment

### Chrome Web Store Submission
1. Run production build: `npm run build`
2. Upload `dist/openmemory-extension-v*.zip`
3. Complete store listing information
4. Submit for review

### Self-Hosted Deployment
1. Build extension: `npm run build`
2. Host the `dist/` directory
3. Provide installation instructions to users

## 🧪 Quality Assurance

### Code Quality
- ESLint configuration for consistent coding standards
- Comprehensive test suite with high coverage
- Type checking for better code reliability
- Security-focused linting rules

### Testing Strategy
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Complete user workflow validation
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability assessment

### Production Readiness Checklist
- [ ] All tests passing
- [ ] Code coverage >80%
- [ ] No ESLint errors
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Error handling tested
- [ ] Cross-platform compatibility verified
- [ ] Documentation updated

## 📈 Monitoring

### Error Tracking
```javascript
// Access error statistics
window.openMemoryErrorHandler.getErrorStats();
```

### Performance Monitoring
```javascript
// Check storage usage
CONFIG.utils.getStorageQuota();
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Use semantic commit messages

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

### Common Issues

**Extension not working on AI platforms:**
- Verify you're on a supported domain
- Check browser console for errors
- Try disabling other extensions

**Memory not saving:**
- Check available storage space
- Verify content meets minimum length requirements
- Review browser permissions

**Notifications not appearing:**
- Check notification rate limiting
- Verify DOM injection permissions
- Review error logs

### Getting Help
1. Check browser console for error messages
2. Review error statistics: `window.openMemoryErrorHandler.getErrorStats()`
3. Enable debug mode for detailed logging
4. Submit issues with reproduction steps

## 📝 Changelog

### v1.0.0
- Initial production release
- Universal AI platform support
- Smart memory management
- Professional UI design
- Comprehensive error handling
- Full test coverage

---

**Made with ❤️ by the LocalBrain Team**
#!/bin/bash

# LocalBrain Production Deployment Script
# This script sets up and deploys LocalBrain for production use

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="LocalBrain"
BACKEND_DIR="backend"
LOG_DIR="$BACKEND_DIR/logs"
MODEL_DIR="$BACKEND_DIR/models"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  LocalBrain Production Deploy  ${NC}"
echo -e "${BLUE}================================${NC}"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "manifest.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the LocalBrain project root directory"
    exit 1
fi

print_status "Starting production deployment..."

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
    print_error "Python 3.8+ is required. Found: $PYTHON_VERSION"
    exit 1
fi

print_status "Python version: $PYTHON_VERSION"

# Create necessary directories
print_status "Creating production directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$MODEL_DIR"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install backend dependencies
print_status "Installing backend dependencies..."
cd "$BACKEND_DIR"
pip install -r requirements.txt

# Download NLP models
print_status "Downloading NLP models..."
python3 -m spacy download en_core_web_sm

# Download NLTK data
print_status "Downloading NLTK data..."
python3 -c "
import nltk
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
print('NLTK data downloaded successfully')
"

# Test the installation
print_status "Testing installation..."
python3 -c "
try:
    from transformers import pipeline
    from sentence_transformers import SentenceTransformer
    import spacy
    import nltk
    from textblob import TextBlob
    print('✓ All imports successful')
    
    nlp = spacy.load('en_core_web_sm')
    doc = nlp('This is a test sentence.')
    print('✓ spaCy model working')
    
    blob = TextBlob('This is a test.')
    print('✓ TextBlob working')
    
    print('✓ Installation test passed')
except Exception as e:
    print(f'✗ Installation test failed: {e}')
    exit(1)
"

if [ $? -ne 0 ]; then
    print_error "Installation test failed"
    exit 1
fi

# Create production startup script
print_status "Creating production startup script..."
cat > start_production.sh << 'EOF'
#!/bin/bash
# LocalBrain Production Startup Script

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Set production environment variables
export LOCALBRAIN_ENV=production
export LOCALBRAIN_LOG_LEVEL=INFO
export LOCALBRAIN_DEBUG=false

echo "Starting LocalBrain Production Server..."
echo "Backend will be available at http://localhost:5000"
echo "Health check: http://localhost:5000/health"
echo "Logs: backend/logs/"

# Start the production server
python3 start_production.py --host 127.0.0.1 --port 5000 --log-level INFO
EOF

chmod +x start_production.sh

# Create systemd service file (if running as root)
if [ "$EUID" -eq 0 ]; then
    print_status "Creating systemd service..."
    cat > /etc/systemd/system/localbrain.service << EOF
[Unit]
Description=LocalBrain Production Server
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/start_production.sh
Restart=always
RestartSec=10
Environment=LOCALBRAIN_ENV=production
Environment=LOCALBRAIN_LOG_LEVEL=INFO

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    print_status "Systemd service created. To enable:"
    print_status "  sudo systemctl enable localbrain"
    print_status "  sudo systemctl start localbrain"
fi

# Create production configuration
print_status "Creating production configuration..."
cat > .env.production << EOF
# LocalBrain Production Configuration
LOCALBRAIN_ENV=production
LOCALBRAIN_HOST=127.0.0.1
LOCALBRAIN_PORT=5000
LOCALBRAIN_DEBUG=false
LOCALBRAIN_LOG_LEVEL=INFO
LOCALBRAIN_WORKERS=1
LOCALBRAIN_THREADS=4
LOCALBRAIN_TIMEOUT=30
LOCALBRAIN_MAX_CONTENT_LENGTH=10000
LOCALBRAIN_SIMILARITY_THRESHOLD=0.8
LOCALBRAIN_CONFIDENCE_THRESHOLD=0.7
LOCALBRAIN_RATE_LIMIT=100
LOCALBRAIN_METRICS=true
LOCALBRAIN_BACKUP=true
EOF

# Test the production server
print_status "Testing production server..."
timeout 30s python3 start_production.py --host 127.0.0.1 --port 5001 --log-level ERROR &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
if curl -s http://127.0.0.1:5001/health > /dev/null; then
    print_status "Production server test successful"
else
    print_error "Production server test failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Clean up test server
kill $SERVER_PID 2>/dev/null || true

# Create deployment summary
print_status "Creating deployment summary..."
cat > DEPLOYMENT_SUMMARY.md << EOF
# LocalBrain Production Deployment Summary

## Deployment Date
$(date)

## System Information
- Python Version: $PYTHON_VERSION
- Operating System: $(uname -s) $(uname -r)
- Architecture: $(uname -m)

## Installation Status
- ✓ Python virtual environment created
- ✓ Backend dependencies installed
- ✓ NLP models downloaded
- ✓ NLTK data downloaded
- ✓ Production configuration created
- ✓ Startup scripts created

## Directory Structure
\`\`\`
$(pwd)
├── backend/
│   ├── logs/           # Application logs
│   ├── models/         # NLP models
│   ├── app.py          # Main application
│   ├── config.py       # Production configuration
│   ├── start_production.py  # Production startup
│   └── requirements.txt
├── src/                # Extension source code
├── popup/              # Extension popup
├── icons/              # Extension icons
├── manifest.json       # Extension manifest
├── start_production.sh # Production startup script
└── .env.production     # Production environment
\`\`\`

## Usage Instructions

### Start Production Server
\`\`\`bash
./start_production.sh
\`\`\`

### Health Check
\`\`\`bash
curl http://localhost:5000/health
\`\`\`

### View Logs
\`\`\`bash
tail -f backend/logs/localbrain_$(date +%Y%m%d).log
\`\`\`

### Stop Server
\`\`\`bash
pkill -f "start_production.py"
\`\`\`

## Configuration
- Server Host: 127.0.0.1
- Server Port: 5000
- Log Level: INFO
- Environment: Production
- Debug Mode: Disabled

## Monitoring
- Logs: \`backend/logs/\`
- Health Check: \`http://localhost:5000/health\`
- Metrics: Enabled (if configured)

## Security Notes
- Server runs on localhost only
- CORS enabled for Chrome extension
- No external API calls
- All processing is local

## Troubleshooting
1. Check logs: \`tail -f backend/logs/localbrain_*.log\`
2. Verify Python environment: \`source venv/bin/activate\`
3. Test health endpoint: \`curl http://localhost:5000/health\`
4. Restart server: \`./start_production.sh\`
EOF

print_status "Deployment completed successfully!"
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Deployment Summary           ${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${GREEN}✓${NC} Backend server ready at: http://localhost:5000"
echo -e "${GREEN}✓${NC} Health check: http://localhost:5000/health"
echo -e "${GREEN}✓${NC} Logs directory: $LOG_DIR"
echo -e "${GREEN}✓${NC} Production config: .env.production"
echo ""
echo -e "${YELLOW}To start the production server:${NC}"
echo -e "  ${BLUE}./start_production.sh${NC}"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  ${BLUE}tail -f $LOG_DIR/localbrain_$(date +%Y%m%d).log${NC}"
echo ""
echo -e "${YELLOW}For systemd service (if created):${NC}"
echo -e "  ${BLUE}sudo systemctl enable localbrain${NC}"
echo -e "  ${BLUE}sudo systemctl start localbrain${NC}"
echo ""
echo -e "${GREEN}Deployment summary saved to: DEPLOYMENT_SUMMARY.md${NC}" 
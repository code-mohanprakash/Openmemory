#!/usr/bin/env python3
"""
LocalBrain Production Startup Script
Handles production deployment with proper logging and error handling
"""

import os
import sys
import signal
import logging
import argparse
from pathlib import Path
from datetime import datetime

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app import app, initialize_components

# Configure production logging
def setup_production_logging(log_level='INFO'):
    """Setup production logging with file rotation"""
    log_dir = backend_dir / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / f'localbrain_{datetime.now().strftime("%Y%m%d")}.log'
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}. Shutting down gracefully...")
    sys.exit(0)

def check_environment():
    """Check production environment requirements"""
    logger.info("Checking production environment...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        logger.error("Python 3.8+ is required for production")
        return False
    
    # Check required directories
    required_dirs = ['logs']
    for dir_name in required_dirs:
        dir_path = backend_dir / dir_name
        dir_path.mkdir(exist_ok=True)
        logger.info(f"✓ Directory ready: {dir_path}")
    
    # Check if models are available
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        logger.info("✓ spaCy model loaded successfully")
    except Exception as e:
        logger.error(f"✗ spaCy model not available: {e}")
        return False
    
    logger.info("✓ Production environment check passed")
    return True

def main():
    """Main production startup function"""
    parser = argparse.ArgumentParser(description='LocalBrain Production Server')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind to')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], help='Log level')
    parser.add_argument('--workers', type=int, default=1, help='Number of worker processes')
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_production_logging(args.log_level)
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("=" * 60)
    logger.info("LocalBrain Production Server Starting")
    logger.info("=" * 60)
    logger.info(f"Host: {args.host}")
    logger.info(f"Port: {args.port}")
    logger.info(f"Log Level: {args.log_level}")
    logger.info(f"Workers: {args.workers}")
    logger.info(f"Python Version: {sys.version}")
    logger.info(f"Working Directory: {os.getcwd()}")
    
    # Check environment
    if not check_environment():
        logger.error("Production environment check failed")
        sys.exit(1)
    
    # Initialize components
    logger.info("Initializing NLP components...")
    if not initialize_components():
        logger.error("Failed to initialize components")
        sys.exit(1)
    
    logger.info("✓ All components initialized successfully")
    
    # Start the server
    logger.info("Starting Flask server...")
    try:
        app.run(
            host=args.host,
            port=args.port,
            debug=False,  # Disable debug mode for production
            threaded=True,
            use_reloader=False  # Disable reloader for production
        )
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
"""
LocalBrain Backend Setup Script
Installs dependencies and downloads required models
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, description):
    """Run a command and handle errors"""
    logger.info(f"Running: {description}")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        logger.info(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"✗ {description} failed: {e}")
        logger.error(f"Error output: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        logger.error("Python 3.8 or higher is required")
        return False
    logger.info(f"✓ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    return True

def install_requirements():
    """Install Python requirements"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    if not requirements_file.exists():
        logger.error("requirements.txt not found")
        return False
    
    return run_command(
        f"{sys.executable} -m pip install -r \"{requirements_file}\"",
        "Installing Python requirements"
    )

def download_spacy_model():
    """Download spaCy model"""
    return run_command(
        f"{sys.executable} -m spacy download en_core_web_sm",
        "Downloading spaCy English model"
    )

def download_nltk_data():
    """Download NLTK data"""
    nltk_script = """
import nltk
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
print("NLTK data downloaded successfully")
"""
    
    return run_command(
        f"{sys.executable} -c '{nltk_script}'",
        "Downloading NLTK data"
    )



def create_startup_script():
    """Create startup script for the backend"""
    startup_script = """#!/bin/bash
# LocalBrain Backend Startup Script

cd "$(dirname "$0")"

echo "Starting LocalBrain Backend..."
echo "Backend will be available at http://localhost:5000"

python3 app.py
"""
    
    script_path = Path(__file__).parent / "start_backend.sh"
    with open(script_path, 'w') as f:
        f.write(startup_script)
    
    # Make executable
    os.chmod(script_path, 0o755)
    logger.info(f"✓ Created startup script: {script_path}")
    return True

def main():
    """Main setup function"""
    logger.info("Starting LocalBrain Backend Setup")
    logger.info("=" * 50)
    
    # Check Python version
    if not check_python_version():
        return False
    
    # Install requirements
    if not install_requirements():
        return False
    
    # Download spaCy model
    if not download_spacy_model():
        return False
    
    # Download NLTK data
    if not download_nltk_data():
        return False
    
    # Create startup script
    if not create_startup_script():
        return False
    
    logger.info("=" * 50)
    logger.info("✓ LocalBrain Backend Setup Complete!")
    logger.info("")
    logger.info("To start the backend:")
    logger.info("  cd backend")
    logger.info("  python3 app.py")
    logger.info("  # or")
    logger.info("  ./start_backend.sh")
    logger.info("")
    logger.info("Backend will be available at: http://localhost:5000")
    logger.info("Health check: http://localhost:5000/health")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 
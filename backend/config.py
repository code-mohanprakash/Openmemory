#!/usr/bin/env python3
"""
LocalBrain Production Configuration
Centralized configuration for production deployment
"""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent

# Server Configuration
SERVER_HOST = os.getenv('LOCALBRAIN_HOST', '127.0.0.1')
SERVER_PORT = int(os.getenv('LOCALBRAIN_PORT', 5000))
DEBUG_MODE = os.getenv('LOCALBRAIN_DEBUG', 'false').lower() == 'true'

# Logging Configuration
LOG_LEVEL = os.getenv('LOCALBRAIN_LOG_LEVEL', 'INFO')
LOG_DIR = BASE_DIR / 'logs'
LOG_FILE = LOG_DIR / 'localbrain.log'

# NLP Model Configuration
SPACY_MODEL = os.getenv('LOCALBRAIN_SPACY_MODEL', 'en_core_web_sm')
SENTENCE_TRANSFORMER_MODEL = os.getenv('LOCALBRAIN_SENTENCE_MODEL', 'all-MiniLM-L6-v2')
BART_MODEL = os.getenv('LOCALBRAIN_BART_MODEL', 'facebook/bart-large-cnn')

# Processing Configuration
MAX_CONTENT_LENGTH = int(os.getenv('LOCALBRAIN_MAX_CONTENT_LENGTH', 10000))
PROCESSING_TIMEOUT = int(os.getenv('LOCALBRAIN_TIMEOUT', 30))
SIMILARITY_THRESHOLD = float(os.getenv('LOCALBRAIN_SIMILARITY_THRESHOLD', 0.8))
CONFIDENCE_THRESHOLD = float(os.getenv('LOCALBRAIN_CONFIDENCE_THRESHOLD', 0.7))

# Memory Configuration
MAX_MEMORIES_PER_REQUEST = int(os.getenv('LOCALBRAIN_MAX_MEMORIES', 100))
MEMORY_CACHE_SIZE = int(os.getenv('LOCALBRAIN_CACHE_SIZE', 1000))
MEMORY_EXPIRY_DAYS = int(os.getenv('LOCALBRAIN_EXPIRY_DAYS', 365))

# Security Configuration
CORS_ORIGINS = os.getenv('LOCALBRAIN_CORS_ORIGINS', '*').split(',')
API_RATE_LIMIT = int(os.getenv('LOCALBRAIN_RATE_LIMIT', 100))  # requests per minute

# Performance Configuration
WORKER_PROCESSES = int(os.getenv('LOCALBRAIN_WORKERS', 1))
THREAD_POOL_SIZE = int(os.getenv('LOCALBRAIN_THREADS', 4))
BATCH_SIZE = int(os.getenv('LOCALBRAIN_BATCH_SIZE', 10))

# Health Check Configuration
HEALTH_CHECK_INTERVAL = int(os.getenv('LOCALBRAIN_HEALTH_INTERVAL', 300))  # seconds
COMPONENT_TIMEOUT = int(os.getenv('LOCALBRAIN_COMPONENT_TIMEOUT', 10))  # seconds

# Error Handling Configuration
MAX_RETRY_ATTEMPTS = int(os.getenv('LOCALBRAIN_MAX_RETRIES', 3))
ERROR_LOG_RETENTION_DAYS = int(os.getenv('LOCALBRAIN_ERROR_RETENTION', 30))

# Development vs Production
IS_PRODUCTION = os.getenv('LOCALBRAIN_ENV', 'production').lower() == 'production'

# Model Download Configuration
MODEL_DOWNLOAD_TIMEOUT = int(os.getenv('LOCALBRAIN_MODEL_TIMEOUT', 300))
MODEL_CACHE_DIR = BASE_DIR / 'models'
MODEL_DOWNLOAD_RETRIES = int(os.getenv('LOCALBRAIN_MODEL_RETRIES', 3))

# Extension Communication
EXTENSION_ORIGIN = os.getenv('LOCALBRAIN_EXTENSION_ORIGIN', 'chrome-extension://*')
ALLOWED_ORIGINS = [
    'chrome-extension://*',
    'moz-extension://*',
    'http://localhost:*',
    'https://localhost:*'
] + CORS_ORIGINS

# Monitoring Configuration
ENABLE_METRICS = os.getenv('LOCALBRAIN_METRICS', 'true').lower() == 'true'
METRICS_INTERVAL = int(os.getenv('LOCALBRAIN_METRICS_INTERVAL', 60))  # seconds

# Backup Configuration
BACKUP_ENABLED = os.getenv('LOCALBRAIN_BACKUP', 'true').lower() == 'true'
BACKUP_INTERVAL_HOURS = int(os.getenv('LOCALBRAIN_BACKUP_INTERVAL', 24))
BACKUP_RETENTION_DAYS = int(os.getenv('LOCALBRAIN_BACKUP_RETENTION', 7))

def get_config_summary():
    """Get a summary of current configuration"""
    return {
        'server': {
            'host': SERVER_HOST,
            'port': SERVER_PORT,
            'debug': DEBUG_MODE
        },
        'nlp': {
            'spacy_model': SPACY_MODEL,
            'sentence_model': SENTENCE_TRANSFORMER_MODEL,
            'bart_model': BART_MODEL
        },
        'processing': {
            'max_content_length': MAX_CONTENT_LENGTH,
            'timeout': PROCESSING_TIMEOUT,
            'similarity_threshold': SIMILARITY_THRESHOLD,
            'confidence_threshold': CONFIDENCE_THRESHOLD
        },
        'performance': {
            'workers': WORKER_PROCESSES,
            'threads': THREAD_POOL_SIZE,
            'batch_size': BATCH_SIZE
        },
        'environment': {
            'production': IS_PRODUCTION,
            'log_level': LOG_LEVEL
        }
    }

def validate_config():
    """Validate configuration settings"""
    errors = []
    
    if SERVER_PORT < 1 or SERVER_PORT > 65535:
        errors.append(f"Invalid port number: {SERVER_PORT}")
    
    if MAX_CONTENT_LENGTH < 100:
        errors.append(f"Max content length too small: {MAX_CONTENT_LENGTH}")
    
    if PROCESSING_TIMEOUT < 5:
        errors.append(f"Processing timeout too small: {PROCESSING_TIMEOUT}")
    
    if SIMILARITY_THRESHOLD < 0 or SIMILARITY_THRESHOLD > 1:
        errors.append(f"Invalid similarity threshold: {SIMILARITY_THRESHOLD}")
    
    if CONFIDENCE_THRESHOLD < 0 or CONFIDENCE_THRESHOLD > 1:
        errors.append(f"Invalid confidence threshold: {CONFIDENCE_THRESHOLD}")
    
    return errors 
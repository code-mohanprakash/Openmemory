#!/usr/bin/env python3
"""
LocalBrain Python Backend
High-accuracy NLP processing for Chrome extension
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from nlp_engine import NLPEngine
from memory_processor import MemoryProcessor
from text_analyzer import TextAnalyzer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Initialize NLP components
nlp_engine = None
memory_processor = None
text_analyzer = None

def initialize_components():
    """Initialize all NLP components with error handling"""
    global nlp_engine, memory_processor, text_analyzer
    
    try:
        logger.info("Initializing NLP components...")
        
        # Initialize core NLP engine
        nlp_engine = NLPEngine()
        logger.info("✓ NLP Engine initialized")
        
        # Initialize memory processor
        memory_processor = MemoryProcessor(nlp_engine)
        logger.info("✓ Memory Processor initialized")
        
        # Initialize text analyzer
        text_analyzer = TextAnalyzer(nlp_engine)
        logger.info("✓ Text Analyzer initialized")
        
        logger.info("All components initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'components': {
            'nlp_engine': nlp_engine is not None,
            'memory_processor': memory_processor is not None,
            'text_analyzer': text_analyzer is not None
        }
    })

@app.route('/api/process-content', methods=['POST'])
def process_content():
    """Process content and extract structured information"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        logger.info(f"Processing content: {len(content)} characters")
        
        # Process content through NLP pipeline
        result = memory_processor.process_content(content)
        
        return jsonify({
            'success': True,
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error processing content: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/categorize', methods=['POST'])
def categorize_content():
    """Categorize content with high accuracy"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        category = text_analyzer.categorize_content(content)
        
        return jsonify({
            'success': True,
            'category': category,
            'confidence': category.get('confidence', 0.0)
        })
        
    except Exception as e:
        logger.error(f"Error categorizing content: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize_content():
    """Generate high-quality summary"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        max_length = data.get('max_length', 150)
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        summary = text_analyzer.generate_summary(content, max_length)
        
        return jsonify({
            'success': True,
            'summary': summary,
            'original_length': len(content),
            'summary_length': len(summary)
        })
        
    except Exception as e:
        logger.error(f"Error summarizing content: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-tags', methods=['POST'])
def extract_tags():
    """Extract relevant tags from content"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        tags = text_analyzer.extract_tags(content)
        
        return jsonify({
            'success': True,
            'tags': tags,
            'count': len(tags)
        })
        
    except Exception as e:
        logger.error(f"Error extracting tags: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-similarity', methods=['POST'])
def analyze_similarity():
    """Analyze similarity between two pieces of content"""
    try:
        data = request.get_json()
        content1 = data.get('content1', '')
        content2 = data.get('content2', '')
        
        if not content1 or not content2:
            return jsonify({'error': 'Both content1 and content2 are required'}), 400
        
        similarity = nlp_engine.calculate_similarity(content1, content2)
        
        return jsonify({
            'success': True,
            'similarity_score': similarity,
            'is_similar': similarity > 0.8
        })
        
    except Exception as e:
        logger.error(f"Error analyzing similarity: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search-memories', methods=['POST'])
def search_memories():
    """Search through memories with semantic similarity"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        memories = data.get('memories', [])
        limit = data.get('limit', 5)
        
        if not query:
            return jsonify({'error': 'No query provided'}), 400
        
        if not memories:
            return jsonify({'error': 'No memories provided'}), 400
        
        results = memory_processor.search_memories(query, memories, limit)
        
        return jsonify({
            'success': True,
            'results': results,
            'query': query,
            'total_memories': len(memories),
            'results_count': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error searching memories: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-facts', methods=['POST'])
def extract_facts():
    """Extract key facts from content"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        facts = text_analyzer.extract_key_facts(content)
        
        return jsonify({
            'success': True,
            'facts': facts,
            'count': len(facts)
        })
        
    except Exception as e:
        logger.error(f"Error extracting facts: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/is-worth-saving', methods=['POST'])
def is_worth_saving():
    """Determine if content is worth saving"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        worth_saving = text_analyzer.is_worth_saving(content)
        
        return jsonify({
            'success': True,
            'worth_saving': worth_saving,
            'reason': text_analyzer.get_worth_saving_reason(content) if worth_saving else 'Content not substantial enough'
        })
        
    except Exception as e:
        logger.error(f"Error checking if worth saving: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize components before starting server
    if initialize_components():
        port = int(os.environ.get('PORT', 5000))
        debug = os.environ.get('FLASK_ENV') == 'development'
        
        logger.info(f"Starting LocalBrain backend on port {port}")
        app.run(host='0.0.0.0', port=port, debug=debug)
    else:
        logger.error("Failed to initialize components. Exiting.")
        exit(1) 
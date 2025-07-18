#!/usr/bin/env python3
"""
LocalBrain Python Backend (Simplified)
High-accuracy NLP processing for Chrome extension
"""

import os
import json
import logging
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from textblob import TextBlob
import nltk

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

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

class SimpleNLPEngine:
    """Simplified NLP engine using basic libraries"""
    
    def __init__(self):
        self.stop_words = set(nltk.corpus.stopwords.words('english'))
        logger.info("Simple NLP Engine initialized")
    
    def categorize_content(self, content):
        """Categorize content using keyword matching"""
        text = content.lower()
        
        categories = {
            'code': ['code', 'function', 'api', 'programming', 'algorithm', 'variable', 'loop'],
            'troubleshooting': ['error', 'bug', 'fix', 'issue', 'problem', 'debug', 'crash'],
            'how-to': ['how to', 'tutorial', 'guide', 'step', 'instruction', 'procedure'],
            'explanation': ['explain', 'what is', 'definition', 'meaning', 'concept'],
            'comparison': ['compare', 'difference', 'vs', 'versus', 'alternative'],
            'recommendation': ['recommend', 'suggest', 'best', 'optimal', 'preferred'],
            'example': ['example', 'sample', 'instance', 'case', 'demonstration']
        }
        
        scores = {}
        for category, keywords in categories.items():
            score = sum(1 for keyword in keywords if keyword in text)
            scores[category] = score / len(keywords) if keywords else 0
        
        best_category = max(scores.items(), key=lambda x: x[1])
        return {
            'category': best_category[0],
            'confidence': best_category[1],
            'all_scores': scores
        }
    
    def generate_summary(self, content, max_length=150):
        """Generate summary using extractive method"""
        # Simple sentence splitting to avoid NLTK issues
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) <= 2:
            return content[:max_length]
        
        # Score sentences based on word frequency
        word_freq = {}
        for sentence in sentences:
            words = sentence.lower().split()
            for word in words:
                if word not in self.stop_words and len(word) > 2:
                    word_freq[word] = word_freq.get(word, 0) + 1
        
        # Score sentences
        sentence_scores = {}
        for sentence in sentences:
            words = sentence.lower().split()
            score = sum(word_freq.get(word, 0) for word in words if word not in self.stop_words)
            sentence_scores[sentence] = score
        
        # Get top sentences
        top_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)
        
        summary = ""
        for sentence, _ in top_sentences:
            if len(summary + sentence) <= max_length:
                summary += sentence + " "
            else:
                break
        
        return summary.strip()
    
    def extract_tags(self, content):
        """Extract tags from content"""
        tags = []
        
        # Extract hashtags
        hashtags = re.findall(r'#[\w]+', content)
        tags.extend([tag[1:] for tag in hashtags])
        
        # Extract technical terms
        technical_terms = [
            'javascript', 'python', 'react', 'node', 'api', 'database', 'server', 'client',
            'html', 'css', 'sql', 'git', 'docker', 'aws', 'cloud', 'security', 'performance',
            'algorithm', 'function', 'class', 'method', 'variable', 'loop', 'condition',
            'framework', 'library', 'package', 'module', 'component', 'service'
        ]
        
        content_lower = content.lower()
        for term in technical_terms:
            if term in content_lower:
                tags.append(term)
        
        # Extract keywords using TextBlob
        blob = TextBlob(content)
        keywords = [word for word in blob.words if word.lower() not in self.stop_words and len(word) > 2]
        tags.extend(keywords[:5])
        
        return list(set(tags))[:15]
    
    def extract_facts(self, content):
        """Extract key facts from content"""
        facts = []
        
        # Extract numbered lists
        numbered_matches = re.findall(r'\d+\.\s+([^.\n]+)', content)
        facts.extend(numbered_matches)
        
        # Extract bullet points
        bullet_matches = re.findall(r'[-•*]\s+([^.\n]+)', content)
        facts.extend(bullet_matches)
        
        # Extract sentences with key phrases
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip()]
        key_phrases = ['important', 'key', 'note', 'remember', 'essential', 'critical']
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            if any(phrase in sentence_lower for phrase in key_phrases):
                facts.append(sentence.strip())
        
        return facts[:10]
    
    def is_worth_saving(self, content):
        """Determine if content is worth saving"""
        if not content or len(content) < 20:
            return False
        
        # Check for AI response patterns
        ai_patterns = [
            r'here\'s|here is',
            r'i can help',
            r'let me explain',
            r'based on',
            r'according to',
            r'in summary',
            r'to answer your question'
        ]
        
        has_ai_pattern = any(re.search(pattern, content, re.IGNORECASE) for pattern in ai_patterns)
        
        # Check for structured content
        has_structure = bool(re.search(r'^\s*[-•*]\s|^\s*\d+\.\s|:\s*$', content, re.MULTILINE))
        
        # Check for code blocks
        has_code = bool(re.search(r'```[\s\S]*```|`[^`]+`', content))
        
        # Check for URLs
        has_urls = bool(re.search(r'https?://[^\s]+', content))
        
        # Check for technical terms
        technical_terms = r'api|function|class|method|algorithm|database|server|client|framework|library'
        has_technical = bool(re.search(technical_terms, content, re.IGNORECASE))
        
        # Check for substantial content
        is_substantial = len(content) > 100
        
        return has_ai_pattern or has_structure or has_code or has_urls or has_technical or is_substantial
    
    def calculate_similarity(self, text1, text2):
        """Calculate simple similarity using Jaccard index"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0

# Initialize NLP engine
nlp_engine = SimpleNLPEngine()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'engine': 'simple_nlp'
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
        
        # Process content
        worth_saving = nlp_engine.is_worth_saving(content)
        if not worth_saving:
            return jsonify({
                'success': True,
                'result': {
                    'worth_saving': False,
                    'reason': 'Content not substantial enough'
                }
            })
        
        result = {
            'worth_saving': True,
            'category': nlp_engine.categorize_content(content),
            'summary': nlp_engine.generate_summary(content),
            'tags': nlp_engine.extract_tags(content),
            'facts': nlp_engine.extract_facts(content),
            'processing_time': 0.1
        }
        
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
    """Categorize content"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        category = nlp_engine.categorize_content(content)
        
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
    """Generate summary"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        max_length = data.get('max_length', 150)
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        summary = nlp_engine.generate_summary(content, max_length)
        
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
    """Extract tags from content"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        tags = nlp_engine.extract_tags(content)
        
        return jsonify({
            'success': True,
            'tags': tags,
            'count': len(tags)
        })
        
    except Exception as e:
        logger.error(f"Error extracting tags: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-facts', methods=['POST'])
def extract_facts():
    """Extract key facts from content"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'No content provided'}), 400
        
        facts = nlp_engine.extract_facts(content)
        
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
        
        worth_saving = nlp_engine.is_worth_saving(content)
        
        return jsonify({
            'success': True,
            'worth_saving': worth_saving,
            'reason': 'Content is substantial' if worth_saving else 'Content not substantial enough'
        })
        
    except Exception as e:
        logger.error(f"Error checking if worth saving: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search-memories', methods=['POST'])
def search_memories():
    """Search through memories with similarity"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        memories = data.get('memories', [])
        limit = data.get('limit', 5)
        
        if not query or not memories:
            return jsonify({'error': 'Query and memories are required'}), 400
        
        # Calculate similarity scores
        scored_memories = []
        for memory in memories:
            similarity = nlp_engine.calculate_similarity(query, memory.get('content', ''))
            scored_memories.append({
                **memory,
                'similarity_score': similarity
            })
        
        # Sort by similarity and return top results
        scored_memories.sort(key=lambda x: x['similarity_score'], reverse=True)
        results = scored_memories[:limit]
        
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))  # Changed default port
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting LocalBrain backend (simplified) on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 
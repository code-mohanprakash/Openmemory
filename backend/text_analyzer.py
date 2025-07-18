#!/usr/bin/env python3
"""
LocalBrain Text Analyzer
High-level text analysis functions using the NLP engine
"""

import logging
from typing import List, Dict, Optional
from nlp_engine import NLPEngine

logger = logging.getLogger(__name__)

class TextAnalyzer:
    """
    High-level text analyzer that uses the NLP engine for accurate analysis
    """
    
    def __init__(self, nlp_engine: NLPEngine):
        """Initialize with NLP engine"""
        self.nlp = nlp_engine
        logger.info("Text Analyzer initialized")
    
    def categorize_content(self, content: str) -> Dict:
        """
        Categorize content with high accuracy
        Returns: {'category': str, 'confidence': float, 'all_scores': dict}
        """
        try:
            return self.nlp.classify_text(content)
        except Exception as e:
            logger.error(f"Error categorizing content: {e}")
            return {'category': 'general', 'confidence': 0.0, 'all_scores': {}}
    
    def generate_summary(self, content: str, max_length: int = 150) -> str:
        """
        Generate high-quality summary
        """
        try:
            return self.nlp.generate_summary(content, max_length)
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            # Fallback to simple truncation
            return content[:max_length] + "..." if len(content) > max_length else content
    
    def extract_tags(self, content: str) -> List[str]:
        """
        Extract relevant tags from content
        """
        try:
            tags = []
            
            # Extract hashtags
            import re
            hashtags = re.findall(r'#[\w]+', content)
            tags.extend([tag[1:] for tag in hashtags])
            
            # Extract technical terms
            technical_terms = [
                'javascript', 'python', 'react', 'node', 'api', 'database', 'server', 'client',
                'html', 'css', 'sql', 'git', 'docker', 'aws', 'cloud', 'security', 'performance',
                'algorithm', 'function', 'class', 'method', 'variable', 'loop', 'condition',
                'framework', 'library', 'package', 'module', 'component', 'service', 'api'
            ]
            
            content_lower = content.lower()
            for term in technical_terms:
                if term in content_lower:
                    tags.append(term)
            
            # Extract keywords using NLP engine
            keywords = self.nlp.extract_keywords(content, top_k=5)
            tags.extend(keywords)
            
            # Extract entities
            entities = self.nlp.extract_entities(content)
            for entity in entities:
                if entity['label'] in ['PERSON', 'ORG', 'PRODUCT', 'GPE']:
                    tags.append(entity['text'].lower())
            
            # Remove duplicates and return
            return list(set(tags))[:15]  # Limit to 15 tags
            
        except Exception as e:
            logger.error(f"Error extracting tags: {e}")
            return []
    
    def extract_key_facts(self, content: str) -> List[str]:
        """
        Extract key facts from content
        """
        try:
            return self.nlp.extract_facts(content)
        except Exception as e:
            logger.error(f"Error extracting facts: {e}")
            return []
    
    def is_worth_saving(self, content: str) -> bool:
        """
        Determine if content is worth saving
        """
        try:
            return self.nlp.is_worth_saving(content)
        except Exception as e:
            logger.error(f"Error checking if worth saving: {e}")
            return len(content) > 50  # Fallback
    
    def get_worth_saving_reason(self, content: str) -> str:
        """
        Get the reason why content is worth saving
        """
        try:
            return self.nlp.get_worth_saving_reason(content)
        except Exception as e:
            logger.error(f"Error getting worth saving reason: {e}")
            return "substantial content"
    
    def analyze_sentiment(self, content: str) -> Dict:
        """
        Analyze sentiment of content
        """
        try:
            from textblob import TextBlob
            
            blob = TextBlob(content)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Determine sentiment category
            if polarity > 0.1:
                sentiment = 'positive'
            elif polarity < -0.1:
                sentiment = 'negative'
            else:
                sentiment = 'neutral'
            
            return {
                'sentiment': sentiment,
                'polarity': polarity,
                'subjectivity': subjectivity
            }
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {e}")
            return {'sentiment': 'neutral', 'polarity': 0.0, 'subjectivity': 0.0}
    
    def extract_technical_terms(self, content: str) -> List[str]:
        """
        Extract technical terms from content
        """
        try:
            technical_terms = []
            
            # Common technical terms
            terms = [
                'api', 'function', 'class', 'method', 'algorithm', 'database', 'server',
                'client', 'framework', 'library', 'package', 'module', 'component',
                'service', 'endpoint', 'request', 'response', 'authentication',
                'authorization', 'encryption', 'decryption', 'compression', 'caching',
                'load balancing', 'scalability', 'performance', 'optimization',
                'debugging', 'testing', 'deployment', 'monitoring', 'logging'
            ]
            
            content_lower = content.lower()
            for term in terms:
                if term in content_lower:
                    technical_terms.append(term)
            
            return technical_terms
            
        except Exception as e:
            logger.error(f"Error extracting technical terms: {e}")
            return []
    
    def detect_language(self, content: str) -> str:
        """
        Detect the language of the content
        """
        try:
            from textblob import TextBlob
            
            blob = TextBlob(content)
            return blob.detect_language()
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
            return 'en'  # Default to English
    
    def extract_code_blocks(self, content: str) -> List[str]:
        """
        Extract code blocks from content
        """
        try:
            import re
            
            # Extract code blocks with language specification
            code_pattern = r'```(\w+)?\n([\s\S]*?)```'
            matches = re.findall(code_pattern, content)
            
            code_blocks = []
            for lang, code in matches:
                code_blocks.append({
                    'language': lang if lang else 'unknown',
                    'code': code.strip()
                })
            
            # Extract inline code
            inline_pattern = r'`([^`]+)`'
            inline_matches = re.findall(inline_pattern, content)
            
            for code in inline_matches:
                code_blocks.append({
                    'language': 'inline',
                    'code': code.strip()
                })
            
            return code_blocks
            
        except Exception as e:
            logger.error(f"Error extracting code blocks: {e}")
            return []
    
    def extract_urls(self, content: str) -> List[str]:
        """
        Extract URLs from content
        """
        try:
            import re
            
            url_pattern = r'https?://[^\s]+'
            urls = re.findall(url_pattern, content)
            
            return urls
            
        except Exception as e:
            logger.error(f"Error extracting URLs: {e}")
            return []
    
    def analyze_complexity(self, content: str) -> Dict:
        """
        Analyze the complexity of content
        """
        try:
            import re
            
            # Count sentences
            sentences = len(content.split('.'))
            
            # Count words
            words = len(content.split())
            
            # Count technical terms
            technical_terms = len(self.extract_technical_terms(content))
            
            # Count code blocks
            code_blocks = len(self.extract_code_blocks(content))
            
            # Calculate complexity score
            complexity_score = (
                (technical_terms * 0.3) +
                (code_blocks * 0.4) +
                (words / 100 * 0.2) +
                (sentences / 10 * 0.1)
            )
            
            # Determine complexity level
            if complexity_score > 0.7:
                level = 'high'
            elif complexity_score > 0.3:
                level = 'medium'
            else:
                level = 'low'
            
            return {
                'complexity_level': level,
                'complexity_score': complexity_score,
                'word_count': words,
                'sentence_count': sentences,
                'technical_terms': technical_terms,
                'code_blocks': code_blocks
            }
            
        except Exception as e:
            logger.error(f"Error analyzing complexity: {e}")
            return {
                'complexity_level': 'unknown',
                'complexity_score': 0.0,
                'word_count': 0,
                'sentence_count': 0,
                'technical_terms': 0,
                'code_blocks': 0
            } 
#!/usr/bin/env python3
"""
LocalBrain Memory Processor
Handles memory operations and search using NLP engine
"""

import logging
import time
from typing import List, Dict, Optional
from nlp_engine import NLPEngine

logger = logging.getLogger(__name__)

class MemoryProcessor:
    """
    Memory processor that uses NLP engine for high-accuracy memory operations
    """
    
    def __init__(self, nlp_engine: NLPEngine):
        """Initialize with NLP engine"""
        self.nlp = nlp_engine
        self.cache = {}
        self.cache_timeout = 300  # 5 minutes
        logger.info("Memory Processor initialized")
    
    def process_content(self, content: str) -> Dict:
        """
        Process content and extract structured information
        Returns comprehensive analysis of the content
        """
        try:
            start_time = time.time()
            
            # Check if content is worth processing
            worth_saving = self.nlp.is_worth_saving(content)
            if not worth_saving:
                return {
                    'worth_saving': False,
                    'reason': 'Content not substantial enough'
                }
            
            # Extract all information
            result = {
                'worth_saving': True,
                'category': self.nlp.classify_text(content),
                'summary': self.nlp.generate_summary(content),
                'tags': self._extract_tags_enhanced(content),
                'facts': self.nlp.extract_facts(content),
                'entities': self.nlp.extract_entities(content),
                'keywords': self.nlp.extract_keywords(content),
                'technical_terms': self._extract_technical_terms(content),
                'code_blocks': self._extract_code_blocks(content),
                'urls': self._extract_urls(content),
                'complexity': self._analyze_complexity(content),
                'sentiment': self._analyze_sentiment(content),
                'language': self._detect_language(content),
                'processing_time': time.time() - start_time
            }
            
            logger.info(f"Processed content in {result['processing_time']:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error processing content: {e}")
            return {
                'worth_saving': False,
                'error': str(e)
            }
    
    def search_memories(self, query: str, memories: List[Dict], limit: int = 5) -> List[Dict]:
        """
        Search through memories with semantic similarity
        """
        try:
            if not query or not memories:
                return []
            
            # Calculate similarity scores for all memories
            scored_memories = []
            
            for memory in memories:
                # Calculate semantic similarity
                similarity = self.nlp.calculate_similarity(query, memory.get('content', ''))
                
                # Calculate keyword overlap
                keyword_score = self._calculate_keyword_overlap(query, memory.get('content', ''))
                
                # Combine scores (semantic similarity weighted higher)
                combined_score = (similarity * 0.7) + (keyword_score * 0.3)
                
                scored_memories.append({
                    **memory,
                    'similarity_score': similarity,
                    'keyword_score': keyword_score,
                    'combined_score': combined_score
                })
            
            # Sort by combined score and return top results
            scored_memories.sort(key=lambda x: x['combined_score'], reverse=True)
            
            return scored_memories[:limit]
            
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return []
    
    def find_duplicates(self, new_memory: Dict, existing_memories: List[Dict]) -> List[Dict]:
        """
        Find duplicate or similar memories
        """
        try:
            duplicates = []
            new_content = new_memory.get('content', '')
            
            for memory in existing_memories:
                existing_content = memory.get('content', '')
                
                # Calculate similarity
                similarity = self.nlp.calculate_similarity(new_content, existing_content)
                
                if similarity > 0.8:  # High similarity threshold
                    duplicates.append({
                        **memory,
                        'similarity_score': similarity
                    })
            
            return duplicates
            
        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
            return []
    
    def group_similar_memories(self, memories: List[Dict]) -> List[List[Dict]]:
        """
        Group memories by similarity
        """
        try:
            if not memories:
                return []
            
            groups = []
            processed = set()
            
            for i, memory in enumerate(memories):
                if i in processed:
                    continue
                
                # Start a new group
                group = [memory]
                processed.add(i)
                
                # Find similar memories
                for j, other_memory in enumerate(memories[i+1:], i+1):
                    if j in processed:
                        continue
                    
                    similarity = self.nlp.calculate_similarity(
                        memory.get('content', ''),
                        other_memory.get('content', '')
                    )
                    
                    if similarity > 0.7:  # Similarity threshold
                        group.append(other_memory)
                        processed.add(j)
                
                groups.append(group)
            
            return groups
            
        except Exception as e:
            logger.error(f"Error grouping memories: {e}")
            return [memories]  # Return as single group on error
    
    def extract_conversation_context(self, content: str) -> Dict:
        """
        Extract conversation context from content
        """
        try:
            context = {
                'has_question': self._has_question(content),
                'has_answer': self._has_answer(content),
                'topic': self._extract_topic(content),
                'entities_mentioned': self.nlp.extract_entities(content),
                'technical_terms': self._extract_technical_terms(content),
                'code_blocks': self._extract_code_blocks(content),
                'urls': self._extract_urls(content)
            }
            
            return context
            
        except Exception as e:
            logger.error(f"Error extracting conversation context: {e}")
            return {}
    
    def _extract_tags_enhanced(self, content: str) -> List[str]:
        """Enhanced tag extraction"""
        try:
            tags = []
            
            # Extract hashtags
            import re
            hashtags = re.findall(r'#[\w]+', content)
            tags.extend([tag[1:] for tag in hashtags])
            
            # Extract technical terms
            technical_terms = self._extract_technical_terms(content)
            tags.extend(technical_terms)
            
            # Extract keywords using NLP
            keywords = self.nlp.extract_keywords(content, top_k=5)
            tags.extend(keywords)
            
            # Extract entities
            entities = self.nlp.extract_entities(content)
            for entity in entities:
                if entity['label'] in ['PERSON', 'ORG', 'PRODUCT', 'GPE']:
                    tags.append(entity['text'].lower())
            
            # Remove duplicates and return
            return list(set(tags))[:15]
            
        except Exception as e:
            logger.error(f"Error extracting enhanced tags: {e}")
            return []
    
    def _extract_technical_terms(self, content: str) -> List[str]:
        """Extract technical terms"""
        try:
            technical_terms = [
                'api', 'function', 'class', 'method', 'algorithm', 'database', 'server',
                'client', 'framework', 'library', 'package', 'module', 'component',
                'service', 'endpoint', 'request', 'response', 'authentication',
                'authorization', 'encryption', 'decryption', 'compression', 'caching',
                'load balancing', 'scalability', 'performance', 'optimization',
                'debugging', 'testing', 'deployment', 'monitoring', 'logging',
                'javascript', 'python', 'react', 'node', 'html', 'css', 'sql', 'git',
                'docker', 'aws', 'cloud', 'security'
            ]
            
            found_terms = []
            content_lower = content.lower()
            
            for term in technical_terms:
                if term in content_lower:
                    found_terms.append(term)
            
            return found_terms
            
        except Exception as e:
            logger.error(f"Error extracting technical terms: {e}")
            return []
    
    def _extract_code_blocks(self, content: str) -> List[Dict]:
        """Extract code blocks"""
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
    
    def _extract_urls(self, content: str) -> List[str]:
        """Extract URLs"""
        try:
            import re
            url_pattern = r'https?://[^\s]+'
            return re.findall(url_pattern, content)
        except Exception as e:
            logger.error(f"Error extracting URLs: {e}")
            return []
    
    def _analyze_complexity(self, content: str) -> Dict:
        """Analyze content complexity"""
        try:
            # Count sentences
            sentences = len(content.split('.'))
            
            # Count words
            words = len(content.split())
            
            # Count technical terms
            technical_terms = len(self._extract_technical_terms(content))
            
            # Count code blocks
            code_blocks = len(self._extract_code_blocks(content))
            
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
    
    def _analyze_sentiment(self, content: str) -> Dict:
        """Analyze sentiment"""
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
    
    def _detect_language(self, content: str) -> str:
        """Detect language"""
        try:
            from textblob import TextBlob
            blob = TextBlob(content)
            return blob.detect_language()
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
            return 'en'
    
    def _has_question(self, content: str) -> bool:
        """Check if content contains questions"""
        try:
            import re
            question_patterns = [
                r'\?$',  # Ends with question mark
                r'^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\s',
                r'\b(what|how|why|when|where|who|which)\b'
            ]
            
            content_lower = content.lower()
            return any(re.search(pattern, content_lower) for pattern in question_patterns)
        except Exception as e:
            logger.error(f"Error checking for questions: {e}")
            return False
    
    def _has_answer(self, content: str) -> bool:
        """Check if content contains answers"""
        try:
            answer_patterns = [
                r'here\'s|here is',
                r'i can help',
                r'let me explain',
                r'based on',
                r'according to',
                r'in summary',
                r'to answer your question'
            ]
            
            import re
            content_lower = content.lower()
            return any(re.search(pattern, content_lower) for pattern in answer_patterns)
        except Exception as e:
            logger.error(f"Error checking for answers: {e}")
            return False
    
    def _extract_topic(self, content: str) -> str:
        """Extract main topic from content"""
        try:
            # Use keywords to determine topic
            keywords = self.nlp.extract_keywords(content, top_k=3)
            if keywords:
                return keywords[0]
            else:
                return 'general'
        except Exception as e:
            logger.error(f"Error extracting topic: {e}")
            return 'general'
    
    def _calculate_keyword_overlap(self, query: str, content: str) -> float:
        """Calculate keyword overlap between query and content"""
        try:
            query_words = set(query.lower().split())
            content_words = set(content.lower().split())
            
            if not query_words or not content_words:
                return 0.0
            
            intersection = query_words.intersection(content_words)
            union = query_words.union(content_words)
            
            return len(intersection) / len(union) if union else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating keyword overlap: {e}")
            return 0.0 
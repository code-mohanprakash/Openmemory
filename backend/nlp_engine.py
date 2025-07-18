#!/usr/bin/env python3
"""
LocalBrain NLP Engine
High-accuracy text processing using state-of-the-art models
"""

import logging
import numpy as np
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch
from sklearn.metrics.pairwise import cosine_similarity
import spacy
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

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

logger = logging.getLogger(__name__)

class NLPEngine:
    """
    High-accuracy NLP engine using state-of-the-art models
    """
    
    def __init__(self):
        """Initialize NLP models and components"""
        logger.info("Initializing NLP Engine...")
        
        # Initialize sentence transformer for semantic similarity
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✓ Sentence transformer loaded")
        
        # Initialize text classification pipeline
        self.classifier = pipeline(
            "text-classification",
            model="microsoft/DialoGPT-medium",
            return_all_scores=True
        )
        logger.info("✓ Text classifier loaded")
        
        # Initialize summarization pipeline
        self.summarizer = pipeline(
            "summarization",
            model="facebook/bart-large-cnn",
            device=0 if torch.cuda.is_available() else -1
        )
        logger.info("✓ Summarizer loaded")
        
        # Initialize spaCy for advanced NLP
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found, downloading...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            self.nlp = spacy.load("en_core_web_sm")
        logger.info("✓ spaCy model loaded")
        
        # Initialize NLTK components
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        logger.info("✓ NLTK components loaded")
        
        # Category mapping for high-accuracy classification
        self.category_keywords = {
            'code': [
                'function', 'class', 'method', 'api', 'code', 'programming', 'algorithm',
                'variable', 'loop', 'condition', 'database', 'query', 'sql', 'javascript',
                'python', 'react', 'node', 'html', 'css', 'git', 'docker', 'aws'
            ],
            'troubleshooting': [
                'error', 'bug', 'fix', 'issue', 'problem', 'debug', 'crash', 'exception',
                'warning', 'failed', 'broken', 'not working', 'solution', 'resolve'
            ],
            'how-to': [
                'how to', 'tutorial', 'guide', 'step', 'instruction', 'procedure',
                'walkthrough', 'setup', 'install', 'configure', 'tutorial'
            ],
            'explanation': [
                'explain', 'what is', 'definition', 'meaning', 'concept', 'theory',
                'understand', 'clarify', 'describe', 'elaborate'
            ],
            'comparison': [
                'compare', 'difference', 'vs', 'versus', 'alternative', 'option',
                'pros and cons', 'advantages', 'disadvantages', 'better', 'worse'
            ],
            'recommendation': [
                'recommend', 'suggest', 'best', 'optimal', 'preferred', 'choice',
                'advice', 'tip', 'should', 'recommended', 'suggestion'
            ],
            'example': [
                'example', 'sample', 'instance', 'case', 'demonstration',
                'illustration', 'for instance', 'such as', 'like'
            ]
        }
        
        logger.info("NLP Engine initialized successfully")
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts using sentence transformers
        Returns similarity score between 0 and 1
        """
        try:
            # Encode texts to embeddings
            embeddings = self.sentence_model.encode([text1, text2])
            
            # Calculate cosine similarity
            similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
            
            return float(similarity)
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    def extract_entities(self, text: str) -> List[Dict]:
        """
        Extract named entities using spaCy
        """
        try:
            doc = self.nlp(text)
            entities = []
            
            for ent in doc.ents:
                entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char
                })
            
            return entities
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            return []
    
    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        """
        Extract keywords using TF-IDF and spaCy
        """
        try:
            doc = self.nlp(text.lower())
            
            # Extract nouns, verbs, adjectives
            keywords = []
            for token in doc:
                if (token.pos_ in ['NOUN', 'VERB', 'ADJ'] and 
                    not token.is_stop and 
                    len(token.text) > 2):
                    keywords.append(token.lemma_)
            
            # Count frequencies
            from collections import Counter
            keyword_freq = Counter(keywords)
            
            # Return top keywords
            return [word for word, _ in keyword_freq.most_common(top_k)]
        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            return []
    
    def classify_text(self, text: str) -> Dict:
        """
        Classify text into categories with confidence scores
        """
        try:
            # Use keyword-based classification for better accuracy
            text_lower = text.lower()
            scores = {}
            
            for category, keywords in self.category_keywords.items():
                score = 0
                for keyword in keywords:
                    if keyword in text_lower:
                        score += 1
                
                # Normalize score
                scores[category] = score / len(keywords) if keywords else 0
            
            # Find best category
            best_category = max(scores.items(), key=lambda x: x[1])
            
            return {
                'category': best_category[0],
                'confidence': best_category[1],
                'all_scores': scores
            }
        except Exception as e:
            logger.error(f"Error classifying text: {e}")
            return {'category': 'general', 'confidence': 0.0, 'all_scores': {}}
    
    def generate_summary(self, text: str, max_length: int = 150) -> str:
        """
        Generate high-quality summary using BART
        """
        try:
            if len(text) < 100:
                return text
            
            # Use BART for summarization
            summary = self.summarizer(text, max_length=max_length, min_length=30, do_sample=False)
            
            if summary and len(summary) > 0:
                return summary[0]['summary_text']
            else:
                # Fallback to extractive summarization
                return self._extractive_summary(text, max_length)
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return self._extractive_summary(text, max_length)
    
    def _extractive_summary(self, text: str, max_length: int) -> str:
        """
        Fallback extractive summarization
        """
        try:
            sentences = sent_tokenize(text)
            
            if len(sentences) <= 2:
                return text[:max_length]
            
            # Score sentences based on word frequency
            word_freq = {}
            for sentence in sentences:
                words = word_tokenize(sentence.lower())
                for word in words:
                    if word not in self.stop_words and len(word) > 2:
                        word_freq[word] = word_freq.get(word, 0) + 1
            
            # Score sentences
            sentence_scores = {}
            for sentence in sentences:
                words = word_tokenize(sentence.lower())
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
        except Exception as e:
            logger.error(f"Error in extractive summary: {e}")
            return text[:max_length]
    
    def extract_facts(self, text: str) -> List[str]:
        """
        Extract key facts from text
        """
        try:
            facts = []
            
            # Extract numbered lists
            import re
            numbered_pattern = r'\d+\.\s+([^.\n]+)'
            numbered_matches = re.findall(numbered_pattern, text)
            facts.extend(numbered_matches)
            
            # Extract bullet points
            bullet_pattern = r'[-•*]\s+([^.\n]+)'
            bullet_matches = re.findall(bullet_pattern, text)
            facts.extend(bullet_matches)
            
            # Extract sentences with key phrases
            sentences = sent_tokenize(text)
            key_phrases = ['important', 'key', 'note', 'remember', 'essential', 'critical']
            
            for sentence in sentences:
                sentence_lower = sentence.lower()
                if any(phrase in sentence_lower for phrase in key_phrases):
                    facts.append(sentence.strip())
            
            return facts[:10]  # Limit to 10 facts
        except Exception as e:
            logger.error(f"Error extracting facts: {e}")
            return []
    
    def is_worth_saving(self, text: str) -> bool:
        """
        Determine if content is worth saving based on multiple criteria
        """
        try:
            if not text or len(text) < 20:
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
            
            import re
            has_ai_pattern = any(re.search(pattern, text, re.IGNORECASE) for pattern in ai_patterns)
            
            # Check for structured content
            has_structure = bool(re.search(r'^\s*[-•*]\s|^\s*\d+\.\s|:\s*$', text, re.MULTILINE))
            
            # Check for code blocks
            has_code = bool(re.search(r'```[\s\S]*```|`[^`]+`', text))
            
            # Check for URLs
            has_urls = bool(re.search(r'https?://[^\s]+', text))
            
            # Check for technical terms
            technical_terms = r'api|function|class|method|algorithm|database|server|client|framework|library'
            has_technical = bool(re.search(technical_terms, text, re.IGNORECASE))
            
            # Check for substantial content
            is_substantial = len(text) > 100
            
            return has_ai_pattern or has_structure or has_code or has_urls or has_technical or is_substantial
            
        except Exception as e:
            logger.error(f"Error checking if worth saving: {e}")
            return len(text) > 50  # Fallback
    
    def get_worth_saving_reason(self, text: str) -> str:
        """
        Get the reason why content is worth saving
        """
        try:
            reasons = []
            
            if len(text) > 100:
                reasons.append("substantial content")
            
            import re
            if re.search(r'here\'s|here is|i can help|let me explain', text, re.IGNORECASE):
                reasons.append("AI response pattern")
            
            if re.search(r'^\s*[-•*]\s|^\s*\d+\.\s', text, re.MULTILINE):
                reasons.append("structured content")
            
            if re.search(r'```[\s\S]*```|`[^`]+`', text):
                reasons.append("contains code")
            
            if re.search(r'https?://[^\s]+', text):
                reasons.append("contains URLs")
            
            if re.search(r'api|function|class|method|algorithm', text, re.IGNORECASE):
                reasons.append("technical content")
            
            return ", ".join(reasons) if reasons else "substantial content"
            
        except Exception as e:
            logger.error(f"Error getting worth saving reason: {e}")
            return "substantial content" 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { Library, Book, Eye, Search, X, Trash2, BookOpen, Volume2, Loader2, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../services/authService';
import ChainToggle from '../components/ChainToggle';
import DOMPurify from 'dompurify';
import { getSpeechManager, getAvailableVoices, isAzureSpeechConfigured } from '../services/azureSpeechService';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Generate a 3D-style gradient background based on book title
function getCoverColor(title) {
  // Title-specific overrides for thematic colors
  const titleOverrides = {
    'The Magical Paintbrush': 'linear-gradient(135deg, #c94c1a 0%, #ff8a50 100%)',
    'The Whispering Woods': 'linear-gradient(135deg, #0d3b0d 0%, #2d7a2d 100%)',
    'Against the Tides': 'linear-gradient(135deg, #0c2d48 0%, #1a6fa0 100%)',
    'The Magic of Numbers': 'linear-gradient(135deg, #2d1b69 0%, #6a3de8 100%)',
    'Oliver Twist': 'linear-gradient(135deg, #3d2a1a 0%, #7a5a3a 100%)',
    'Oliver: The Boy Who Found Balance': 'linear-gradient(135deg, #4a3a1a 0%, #8a7a3a 100%)',
    'The Dreamer': 'linear-gradient(135deg, #0d3b0d 0%, #3a8a3a 100%)',
    'The Weight of Envy': 'linear-gradient(135deg, #3d0d0d 0%, #8a2a2a 100%)',
  };
  if (title && titleOverrides[title]) return titleOverrides[title];
  
  const colors = [
    'linear-gradient(135deg, #1a365d 0%, #2d4a7a 100%)',
    'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
    'linear-gradient(135deg, #553c9a 0%, #805ad5 100%)',
    'linear-gradient(135deg, #22543d 0%, #38a169 100%)',
    'linear-gradient(135deg, #744210 0%, #b7791f 100%)',
    'linear-gradient(135deg, #9b2c2c 0%, #e53e3e 100%)',
    'linear-gradient(135deg, #234e52 0%, #319795 100%)',
    'linear-gradient(135deg, #702459 0%, #d53f8c 100%)',
  ];
  let hash = 0;
  if (title) {
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  return colors[Math.abs(hash) % colors.length];
}

// Generate a 3D emoji art scene based on book title
function getCoverEmojiArt(title) {
  const art = {
    'The Magical Paintbrush': ['🎨', '✨', '🖌️', '🌟', '🌈'],
    'The Whispering Woods': ['🌲', '🌿', '🦉', '🍃', '🌳'],
    'Against the Tides': ['🌊', '⛵', '🌅', '🐋', '⚓'],
    'The Magic of Numbers': ['🔢', '✨', '📐', '🔮', '➕'],
    'Oliver Twist': ['🏚️', '🍞', '🎩', '🌆', '👞'],
    'Oliver: The Boy Who Found Balance': ['🌾', '☀️', '🍞', '🤝', '🏡'],
    'The Dreamer': ['⚽', '🌟', '🏆', '🌍', '👦'],
    'The Weight of Envy': ['💔', '🤝', '💙', '🌟', '😢'],
  };
  if (title && art[title]) return art[title];
  // Default: generate from title hash
  const defaults = [
    ['📚', '✨', '🌟', '📖', '💡'],
    ['📘', '🔍', '💭', '🌟', '📝'],
    ['📕', '🌈', '⭐', '📗', '🎯'],
    ['📙', '💫', '✨', '📓', '🏅'],
  ];
  let hash = 0;
  if (title) {
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  return defaults[Math.abs(hash) % defaults.length];
}


// Allowed tags for DOMPurify sanitization
const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'u', 'i', 'b', 'span', 'div',
  'img', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
  'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
  'blockquote', 'pre', 'code', 'hr', 'sub', 'sup',
  'section', 'article', 'header', 'footer', 'nav', 'main',
  'figure', 'figcaption', 'details', 'summary',
  'audio', 'video', 'source', 'track',
  'label', 'input', 'textarea', 'select', 'option',
  'button', 'form', 'fieldset', 'legend',
  'style', 'link', 'meta', 'title', 'head', 'body',
  'html', 'script'
];

const ALLOWED_ATTR = [
  'src', 'href', 'alt', 'title', 'class', 'id', 'style',
  'width', 'height', 'target', 'rel', 'type', 'name',
  'value', 'placeholder', 'disabled', 'readonly', 'checked',
  'selected', 'autocomplete', 'novalidate',
  'data-*', 'aria-*', 'role',
  'controls', 'autoplay', 'loop', 'muted', 'poster',
  'colspan', 'rowspan', 'scope',
  'lang', 'dir', 'charset', 'name', 'content',
  'action', 'method', 'enctype',
  'for', 'tabindex', 'accesskey',
  'onclick', 'onload', 'onerror',
  'xmlns', 'version', 'viewBox', 'fill', 'stroke',
  'd', 'path', 'svg'
];

function EBook() {
  const currentUser = useSelector(selectCurrentUser);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedChain, setSelectedChain] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [readerBook, setReaderBook] = useState(null);
  const [bookContent, setBookContent] = useState('');
  const [bookScripts, setBookScripts] = useState([]);
  const [bookStyles, setBookStyles] = useState('');
  const contentRef = useRef(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState(null);

  // ----- READ ALOUD STATE -----
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [isStopLoading, setIsStopLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const sentencesRef = useRef([]);
  const currentSentenceIndexRef = useRef(0);
  const pauseLoadingTimerRef = useRef(null);
  const stopLoadingTimerRef = useRef(null);
  const isPausedRef = useRef(false);
  const currentUtteranceRef = useRef(null);


  const userRole = currentUser?.role?.toLowerCase();
  const userChain = currentUser?.chain;
  
  const canDelete = ['principal', 'director', 'coordinator'].includes(userRole);
  const canLock = ['principal', 'director', 'coordinator'].includes(userRole);

  const CATEGORIES = [
    { value: 'all', label: 'All Categories' },
    { value: 'textbook', label: 'Textbooks' },
    { value: 'reference', label: 'Reference Books' },
    { value: 'literature', label: 'Literature' },
    { value: 'science', label: 'Science' },
    { value: 'mathematics', label: 'Mathematics' },
    { value: 'history', label: 'History & Geography' },
    { value: 'language', label: 'Languages' },
    { value: 'religious', label: 'Religious Studies' },
    { value: 'other', label: 'Other' }
  ];

  // Determine the active chain for data fetching
  const activeChain = ['director', 'coordinator'].includes(userRole) 
    ? selectedChain 
    : userChain;

  useEffect(() => {
    // loadBooks also derives the grade-level filter options from the same
    // response, so we do NOT call loadClasses() here too. Previously both
    // functions fetched /ebooks independently, firing the SAME request twice
    // on every mount / chain change.
    loadBooks();
  }, [selectedChain, userChain]);


  // ----- LOAD AZURE VOICES ON MOUNT & PRE-WARM AZURE TTS -----
  useEffect(() => {
    const voices = getAvailableVoices();
    setAvailableVoices(voices);
    
    // Auto-select child-friendly voice (AnaNeural is a child voice)
    const childVoice = voices.find(v => 
      v.style === 'child' || 
      v.name.toLowerCase().includes('child') ||
      v.name.toLowerCase().includes('kid')
    );
    if (childVoice) {
      setSelectedVoice(childVoice);
    } else if (voices.length > 0) {
      // Default to first voice (Jenny)
      setSelectedVoice(voices[0]);
    }
    
    // Pre-warm Azure TTS connection by making a small silent request
    // This reduces the delay on the first actual read-aloud
    if (isAzureSpeechConfigured()) {
      const warmUp = async () => {
        try {
          const { synthesizeSpeech } = await import('../services/azureSpeechService');
          await synthesizeSpeech('Hello', voices[0]?.voice || 'en-US-JennyNeural', { rate: 1.0, pitch: 1.0, volume: 0 });
        } catch (e) {
          // Silently ignore warm-up errors
        }
      };
      // Delay warm-up slightly to not interfere with initial page load
      setTimeout(warmUp, 3000);
    }
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const params = activeChain ? { chain: activeChain } : {};
      const response = await apiClient.get('/ebooks', { params });
      const booksData = response.data || [];
      setBooks(booksData);
      // Derive the grade-level filter options from the SAME response so we
      // don't issue a second /ebooks request just to build the dropdown.
      const gradeLevels = [...new Set(booksData.map(b => b.grade_level).filter(Boolean))].sort();
      setClasses(gradeLevels);
    } catch (error) {
      console.error('Failed to load books:', error);
      toast.error('Failed to load e-books');
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = async (bookId) => {
    if (!window.confirm('Are you sure you want to delete this e-book?')) {
      return;
    }

    try {
      await apiClient.delete(`/ebooks/${bookId}`);
      toast.success('e-Book deleted successfully');
      loadBooks();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete e-book');
    }
  };

  const handleToggleLock = async (bookId, e) => {
    e.stopPropagation();
    try {
      const response = await apiClient.patch(`/ebooks/${bookId}/toggle-lock`);
      const { locked } = response.data;
      toast.success(locked ? 'e-Book locked 🔒' : 'e-Book unlocked 🔓');
      loadBooks();
    } catch (error) {
      console.error('Toggle lock failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to toggle lock');
    }
  };

  // ----- EXTRACT SENTENCES FROM HTML -----
  const extractSentences = useCallback((htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const textNodes = [];
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text && text.length > 2) {
        // Split by .!? but keep delimiters
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        sentences.forEach(s => {
          const clean = s.trim();
          if (clean && clean.length > 1) {
            textNodes.push(clean);
          }
        });
      }
    }
    
    return textNodes;
  }, []);

  // ----- HIGHLIGHT CURRENT SENTENCE -----
  const highlightSentence = (index) => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    
    // Remove all previous highlights
    contentEl.querySelectorAll('.speaking-sentence').forEach(el => {
      el.classList.remove('speaking-sentence');
    });
    contentEl.querySelectorAll('.active-sentence').forEach(el => {
      el.classList.remove('active-sentence');
    });
    
    // Find the nth <p> element (matches getTextBlocks order)
    const paragraphs = contentEl.querySelectorAll('p');
    if (paragraphs.length > 0 && index < paragraphs.length) {
      paragraphs[index].classList.add('speaking-sentence');
      paragraphs[index].classList.add('active-sentence');
      paragraphs[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    
    // Fallback: find the nth text node
    let count = 0;
    const walker = document.createTreeWalker(
      contentEl,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text && text.length > 1 && text.match(/[.!?]/)) {
        if (count === index) {
          const parent = node.parentNode;
          if (parent) {
            parent.classList.add('speaking-sentence');
            parent.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          break;
        }
        count++;
      }
    }
  };

  // ----- FALLBACK: BROWSER SPEECH SYNTHESIS (used if Azure TTS fails) -----
  const speakWithBrowserFallback = useCallback((startIndex) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Speech synthesis is not supported in this browser.');
      setIsReading(false);
      return;
    }
    
    const sentences = sentencesRef.current;
    if (!sentences || sentences.length === 0) return;
    
    setIsSpeechLoading(false);
    setIsReading(true);
    setIsPaused(false);
    
    const speakFrom = (i) => {
      if (i >= sentences.length) {
        setIsReading(false);
        setReadingProgress(sentences.length);
        toast.success('🎉 Finished reading the book!');
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(sentences[i]);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      
      // Try to pick a natural English voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en') && v.name.toLowerCase().includes('female')) 
        || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
      if (preferred) utterance.voice = preferred;
      
      utterance.onstart = () => {
        setReadingProgress(i + 1);
        currentSentenceIndexRef.current = i;
        highlightSentence(i);
      };
      
      utterance.onend = () => {
        if (!isPausedRef.current) {
          speakFrom(i + 1);
        }
      };
      
      utterance.onerror = (e) => {
        console.warn('Browser speech error:', e);
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        speakFrom(i + 1);
      };
      
      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };
    
    speakFrom(startIndex);
  }, []);


  // ----- SPEAK SENTENCES USING AZURE SPEECH -----
  const speakSentence = useCallback((text, index) => {
    // Check if Azure Speech is configured before attempting
    if (!isAzureSpeechConfigured()) {
      // Fall back to browser speech synthesis if Azure isn't configured
      speakWithBrowserFallback(index || 0);
      return;
    }
    
    const speechManager = getSpeechManager();
    
    // Configure voice and options
    if (selectedVoice) {
      speechManager.setVoice(selectedVoice.voice);
    }
    speechManager.setOptions({ rate: 0.9, pitch: 1.25, volume: 1 });
    
    // Show loading spinner while first Azure TTS request is in progress
    setIsSpeechLoading(true);
    
    // Set up callbacks
    speechManager.onSentenceStart = (sentence, idx) => {
      setIsSpeechLoading(false);
      setIsReading(true);
      setIsPaused(false);
      setReadingProgress(idx + 1);
      currentSentenceIndexRef.current = idx;
      highlightSentence(idx);
    };
    
    speechManager.onSentenceEnd = (idx) => {
      // Progress is already updated in onSentenceStart
    };
    
    speechManager.onEnd = () => {
      setIsSpeechLoading(false);
      setIsReading(false);
      setReadingProgress(sentencesRef.current.length);
      toast.success('🎉 Finished reading the book!');
    };
    
    speechManager.onError = (error, idx) => {
      setIsSpeechLoading(false);
      console.error('Azure Speech error:', error);
      // Fall back to browser speech synthesis so the book still reads aloud
      toast.info('Azure speech unavailable - using browser voice.');
      speakWithBrowserFallback(idx || 0);
    };
    
    // Speak from the given index
    speechManager.speakSentences(sentencesRef.current, index);
  }, [selectedVoice, speakWithBrowserFallback]);


  // ----- GET TEXT BLOCKS FROM E-BOOK CONTENT -----
  const getTextBlocks = useCallback(() => {

    if (!contentRef.current) return [];
    const el = contentRef.current;
    
    // Collect all text-bearing elements in DOM order
    const blocks = [];
    const seen = new Set();
    
    // Walk all child elements in DOM order
    const walkElements = (root) => {
      const children = root.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tag = child.tagName.toLowerCase();
        
        // Skip script, style, emoji-scene, label elements
        if (['script', 'style'].includes(tag)) continue;
        if (child.classList.contains('emoji-scene')) continue;
        if (child.classList.contains('label')) continue;
        
        // If it's a <p> tag, use it as a block
        if (tag === 'p') {
          const text = child.textContent.trim();
          if (text && text.length > 2 && !seen.has(child)) {
            blocks.push({ text, element: child });
            seen.add(child);
          }
          continue;
        }
        
        // If it's a .stage-dir, .character, or .dialogue span, use it
        if (child.classList.contains('stage-dir') || 
            child.classList.contains('character') || 
            child.classList.contains('dialogue')) {
          const text = child.textContent.trim();
          if (text && text.length > 2 && !seen.has(child)) {
            blocks.push({ text, element: child });
            seen.add(child);
          }
          continue;
        }
        
        // If it's a .text-block, use it
        if (child.classList.contains('text-block')) {
          const text = child.textContent.trim();
          if (text && text.length > 2 && !seen.has(child)) {
            blocks.push({ text, element: child });
            seen.add(child);
          }
          continue;
        }
        
        // If it's a div with substantial text, use it
        if (tag === 'div') {
          const text = child.textContent.trim();
          if (text && text.length > 20 && !seen.has(child)) {
            blocks.push({ text, element: child });
            seen.add(child);
          }
          continue;
        }
        
        // Recurse into other containers
        if (child.children.length > 0) {
          walkElements(child);
        }
      }
    };
    
    walkElements(el);
    return blocks;
  }, []);

  // ----- READ BOOK ALOUD -----
  const readBookAloud = () => {
    if (!bookContent) {
      toast.error('No book content loaded');
      return;
    }
    
    // Stop any ongoing speech via Azure Speech Manager
    getSpeechManager().stop();
    
    // Get text blocks from the rendered content
    const blocks = getTextBlocks();
    if (blocks.length === 0) {
      // Fallback: extract sentences from raw HTML
      const sentences = extractSentences(bookContent);
      sentencesRef.current = sentences;
      setTotalSentences(sentences.length);
      if (sentences.length === 0) {
        toast.error('No readable text found in this book');
        return;
      }
      setReadingProgress(0);
      currentSentenceIndexRef.current = 0;
      speakSentence(sentences[0], 0);
      return;
    }
    
    // Use text blocks from the DOM
    sentencesRef.current = blocks.map(b => b.text);
    setTotalSentences(blocks.length);
    setReadingProgress(0);
    currentSentenceIndexRef.current = 0;
    speakSentence(blocks[0].text, 0);
  };

  // ----- PAUSE READING -----
  const pauseReading = () => {
    // Show mini spinner on pause button
    setIsPauseLoading(true);
    
    // Clear any existing timer
    if (pauseLoadingTimerRef.current) {
      clearTimeout(pauseLoadingTimerRef.current);
    }
    
    getSpeechManager().pause();
    isPausedRef.current = true;
    setIsPaused(true);
    
    // Also pause browser speech synthesis if it's being used as fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    
    // Keep spinner for a minimum duration so user sees feedback
    pauseLoadingTimerRef.current = setTimeout(() => {
      setIsPauseLoading(false);
    }, 1500);
  };

  // ----- RESUME READING -----
  const resumeReading = () => {
    getSpeechManager().resume();
    isPausedRef.current = false;
    setIsPaused(false);
    
    // Also resume browser speech synthesis if it's being used as fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  };

  // ----- STOP READING -----
  const stopReading = () => {
    // Show mini spinner on stop button
    setIsStopLoading(true);
    
    // Clear any existing timer
    if (stopLoadingTimerRef.current) {
      clearTimeout(stopLoadingTimerRef.current);
    }
    
    try {
      getSpeechManager().stop();
    } catch (e) {
      console.warn('Stop speech error:', e);
    }
    
    // Also stop browser speech synthesis if it's being used as fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isPausedRef.current = false;
    currentUtteranceRef.current = null;
    
    setIsReading(false);
    setIsPaused(false);
    setReadingProgress(0);
    
    // Remove highlights
    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.querySelectorAll('.speaking-sentence').forEach(el => {
        el.classList.remove('speaking-sentence');
      });
      contentEl.querySelectorAll('.active-sentence').forEach(el => {
        el.classList.remove('active-sentence');
      });
    }
    
    // Keep spinner for a minimum duration so user sees feedback
    stopLoadingTimerRef.current = setTimeout(() => {
      setIsStopLoading(false);
    }, 1500);
  };


  // Clean up loading timers on unmount
  useEffect(() => {
    return () => {
      if (pauseLoadingTimerRef.current) {
        clearTimeout(pauseLoadingTimerRef.current);
      }
      if (stopLoadingTimerRef.current) {
        clearTimeout(stopLoadingTimerRef.current);
      }
    };
  }, []);

  const handleView = async (book) => {
    if (!book || !book.id) {
      toast.error('Invalid book data - missing ID');
      return;
    }
    if (!book.file_url) {
      toast.error('Book file not available');
      return;
    }

    // Check if the book is locked
    const isLocked = book.locked === true;
    const userRole = currentUser?.role?.toLowerCase();
    const canBypassLock = ['principal', 'director', 'coordinator'].includes(userRole);
    if (isLocked && !canBypassLock) {
      toast.error('This e-book is locked by the principal');
      return;
    }

    // PDF or other non-HTML files - open in new tab via API endpoint
    if (!book.file_url.endsWith('.html')) {
      window.open(`${API_URL}/api/ebooks/${book.id}/content`, '_blank');
      return;
    }

    // HTML books - fetch and render directly in React
    setReaderBook(book);
    setBookContent('');
    setBookError(null);
    setBookStyles('');
    setBookLoading(true);
    
    // Reset read-aloud state
    stopReading();
    sentencesRef.current = [];
    setTotalSentences(0);

    try {
      const response = await apiClient.get(`/ebooks/${book.id}/content`, {
        responseType: 'text',
        timeout: 20000 // 20 second timeout so the reader never hangs forever
      });

      
      // Sanitize the HTML content before rendering
      // Allow scripts and event handlers so e-book interactivity (speech, click-to-read) works
      const sanitized = DOMPurify.sanitize(response.data, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ADD_ATTR: ['target'],
        ADD_TAGS: ['script']
      });
      
      // Extract scripts from sanitized HTML — scripts injected via innerHTML don't execute
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      const extractedScripts = [];
      let htmlWithoutScripts = sanitized.replace(scriptRegex, (match, scriptContent) => {
        const srcMatch = match.match(/src\s*=\s*["']([^"']*)["']/);
        extractedScripts.push({
          content: scriptContent,
          src: srcMatch ? srcMatch[1] : null
        });
        return '';
      });
      
      // Extract <style> tags so they can be applied at the component level
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      const extractedStyles = [];
      let htmlWithoutStyles = htmlWithoutScripts.replace(styleRegex, (match, styleContent) => {
        extractedStyles.push(styleContent);
        return '';
      });
      
      // Extract the body content (everything between <body> and </body>)
      const bodyMatch = htmlWithoutStyles.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : htmlWithoutStyles;
      
      setBookContent(bodyContent);
      setBookStyles(extractedStyles.join('\n'));
      setBookScripts(extractedScripts);
    } catch (error) {
      console.error('Failed to load book content:', error);
      setBookError('Failed to load book content. Please try again.');
      toast.error('Failed to load book content');
    } finally {
      setBookLoading(false);
    }
  };

  // Script injection is disabled — EBook.js handles all interactivity
  // (speech synthesis, click-to-read, highlighting) directly.
  // The e-book's own scripts would conflict with EBook.js's system.

  // ----- CLICK-TO-READ VIA EVENT DELEGATION -----
  // Use a single click handler on the content container instead of per-element handlers.
  // This avoids cleanup issues and works with dangerouslySetInnerHTML content.
  const handleContentClick = useCallback((e) => {
    // Find the closest clickable element
    const target = e.target.closest('p, .stage-dir, .dialogue, .character, .narrator-text, .text-block');
    if (!target) return;
    
    // Skip emoji-scene and label elements
    if (target.classList.contains('emoji-scene') || target.classList.contains('label')) return;
    
    const text = target.textContent.trim();
    if (!text || text.length < 2) return;
    
    e.stopPropagation();
    
    // Stop any ongoing speech via Azure Speech Manager
    getSpeechManager().stop();
    
    // Speak the clicked text
    sentencesRef.current = [text];
    setTotalSentences(1);
    setReadingProgress(0);
    currentSentenceIndexRef.current = 0;
    speakSentence(text, 0);
  }, [speakSentence]);

  // Attach click delegation when content is rendered
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !bookContent) return;
    
    container.addEventListener('click', handleContentClick);
    container.style.cursor = 'pointer';
    
    return () => {
      container.removeEventListener('click', handleContentClick);
      container.style.cursor = '';
    };
  }, [bookContent, handleContentClick]);

  const closeReader = () => {
    stopReading();
    setReaderBook(null);
    setBookContent('');
    setBookError(null);
    setBookScripts([]);
    setBookStyles('');
    sentencesRef.current = [];
    setTotalSentences(0);
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = searchTerm === '' || 
      book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
    const matchesGrade = selectedGrade === '' || book.grade_level === selectedGrade;
    return matchesSearch && matchesCategory && matchesGrade;
  });

  return (
    <div className="ebook-page">
      <style>{`
        .ebook-page {
          padding: 1.5rem;
          min-height: 100vh;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filters-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          min-width: 240px;
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
          font-size: 0.95rem;
        }

        .search-input:focus {
          outline: none;
          border-color: #8b5cf6;
        }

        .filter-select {
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
          font-size: 0.95rem;
          min-width: 160px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .books-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .book-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 1rem;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
        }

        .book-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          border-color: rgba(139, 92, 246, 0.5);
        }

        .book-card.locked {
          opacity: 0.6;
          filter: grayscale(0.3);
          cursor: default;
        }

        .book-card.locked:hover {
          transform: none;
          box-shadow: none;
          border-color: rgba(71, 85, 105, 0.5);
        }

        .book-card.locked .book-cover-emoji {
          animation: none;
        }

        .book-lock-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(2px);
          z-index: 5;
          border-radius: 1rem;
        }

        .book-lock-icon {
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .book-cover {
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .book-cover-inner {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          text-align: center;
          position: relative;
        }

        .book-cover-emoji-art {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          margin-bottom: 0.25rem;
          position: relative;
          width: 100%;
          min-height: 70px;
        }

        .book-cover-emoji {
          font-size: 1.8rem;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          transition: all 0.3s ease;
          animation: emojiFloat 3s ease-in-out infinite;
        }

        .book-cover-emoji:nth-child(1) { animation-delay: 0s; font-size: 2.2rem; }
        .book-cover-emoji:nth-child(2) { animation-delay: 0.4s; font-size: 1.6rem; }
        .book-cover-emoji:nth-child(3) { animation-delay: 0.8s; font-size: 2rem; }
        .book-cover-emoji:nth-child(4) { animation-delay: 1.2s; font-size: 1.4rem; }
        .book-cover-emoji:nth-child(5) { animation-delay: 1.6s; font-size: 1.8rem; }

        @keyframes emojiFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.05); }
        }

        .book-card:hover .book-cover-emoji {
          animation-duration: 1.5s;
        }

        .book-card:hover .book-cover-emoji:nth-child(1) { transform: perspective(400px) rotateY(-8deg) rotateX(4deg) scale(1.1); }
        .book-card:hover .book-cover-emoji:nth-child(2) { transform: perspective(400px) rotateY(6deg) rotateX(-3deg) scale(1.08); }
        .book-card:hover .book-cover-emoji:nth-child(3) { transform: perspective(400px) rotateY(-4deg) rotateX(5deg) scale(1.12); }
        .book-card:hover .book-cover-emoji:nth-child(4) { transform: perspective(400px) rotateY(8deg) rotateX(-2deg) scale(1.06); }
        .book-card:hover .book-cover-emoji:nth-child(5) { transform: perspective(400px) rotateY(-6deg) rotateX(3deg) scale(1.09); }

        .book-cover-title {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          max-width: 90%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          position: relative;
          z-index: 1;
        }

        .book-cover-badge {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          padding: 0.25rem 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          color: white;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .book-cover-type {
          position: absolute;
          bottom: 0.75rem;
          left: 0.75rem;
          padding: 0.2rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(4px);
          border-radius: 0.25rem;
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .book-category-badge {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          padding: 0.25rem 0.75rem;
          background: rgba(139, 92, 246, 0.9);
          color: white;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .book-content {
          padding: 1.25rem;
        }

        .book-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .book-author {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.75rem;
        }

        .book-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .book-meta-tag {
          padding: 0.25rem 0.5rem;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 0.375rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .book-actions {
          display: flex;
          gap: 0.5rem;
        }

        .book-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.625rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-view {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .btn-view:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        .btn-delete {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          flex: 0;
          padding: 0.625rem 0.75rem;
        }

        .btn-delete:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .btn-lock {
          background: rgba(234, 179, 8, 0.2);
          color: #eab308;
          flex: 0;
          padding: 0.625rem 0.75rem;
        }

        .btn-lock:hover {
          background: rgba(234, 179, 8, 0.3);
        }

        .btn-unlock {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          flex: 0;
          padding: 0.625rem 0.75rem;
        }

        .btn-unlock:hover {
          background: rgba(34, 197, 94, 0.3);
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }

        .empty-icon {
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        /* Reader Modal - Full e-book CSS preserved */
        .reader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 0;
        }

        .reader-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f1f5f9;
        }

        .reader-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
          z-index: 10;
        }

        .reader-header-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #0f172a;
        }

        .reader-title {
          font-weight: 600;
          font-size: 1rem;
        }

        .reader-author {
          color: #64748b;
          font-size: 0.85rem;
        }

        .reader-close-btn {
          background: #fee2e2;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .reader-close-btn:hover {
          background: #fecaca;
        }

        /* ----- READ ALOUD CONTROLS (Light Theme) ----- */
        .read-aloud-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem 1.25rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .read-aloud-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.25rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          color: white;
        }

        .read-aloud-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .btn-speak {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        .btn-speak:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .btn-pause {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        .btn-pause:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }

        .btn-stop {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        .btn-stop:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .btn-resume {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .btn-resume:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        }

        .voice-selector {
          flex: 1;
          min-width: 180px;
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          color: #0f172a;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .voice-selector:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .reading-status {
          font-size: 0.8rem;
          color: #64748b;
          margin-left: auto;
          white-space: nowrap;
        }

        .reading-progress {
          width: 100%;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .reading-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #7c3aed);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* ============================================
           CHILDREN'S BOOK STYLES - ARIAL ONLY
           No italics, no serif fonts
           ============================================ */

        /* ----- ROOT VARIABLES ----- */
        :root {
          --book-bg: #fcf8f0;
          --book-text: #2c1810;
          --book-gold: #c9a84c;
          --book-gold-light: #e8d5a3;
          --book-forest: #1a3a1a;
          --book-forest-light: #2d5a27;
          --book-cream: #f5ede0;
          --book-shadow: rgba(44, 24, 16, 0.15);
        }

        /* ----- READER CONTENT CONTAINER ----- */
        .reader-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 3rem 4rem;
          background: var(--book-bg);
          margin: 1rem 2rem;
          border-radius: 1.5rem;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(201, 168, 76, 0.15);
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 20px;
          line-height: 1.9;
          color: var(--book-text);
          position: relative;
        }

        /* ----- DECORATIVE BOOK SPINE EFFECT ----- */
        .reader-content::before {
          content: '';
          position: absolute;
          left: 0;
          top: 5%;
          height: 90%;
          width: 6px;
          background: linear-gradient(to bottom, var(--book-gold), var(--book-forest), var(--book-gold));
          border-radius: 0 4px 4px 0;
          opacity: 0.4;
        }

        /* ----- ACT HEADINGS (BOLD & STYLISH) ----- */
        .reader-content .act-heading {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 32px;
          color: var(--book-forest);
          text-align: center;
          margin: 2.5rem 0 0.5rem 0;
          padding: 0.8rem 0;
          letter-spacing: 0.08em;
          text-shadow: 2px 2px 0 rgba(201, 168, 76, 0.2);
          position: relative;
          text-transform: uppercase;
          font-style: normal !important;
        }

        /* Decorative line under act headings */
        .reader-content .act-heading::after {
          content: '✦ ✦ ✦';
          display: block;
          font-size: 20px;
          color: var(--book-gold);
          letter-spacing: 0.5em;
          margin-top: 0.2rem;
          opacity: 0.6;
          font-style: normal !important;
        }

        /* ----- SCENE HEADINGS ----- */
        .reader-content .scene-heading {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 700;
          font-size: 24px;
          color: var(--book-forest-light);
          margin: 1.8rem 0 0.8rem 0;
          padding: 0.4rem 1.2rem;
          background: linear-gradient(to right, transparent, var(--book-cream), transparent);
          border-left: 6px solid var(--book-gold);
          border-radius: 0 12px 12px 0;
          letter-spacing: 0.04em;
          display: inline-block;
          font-style: normal !important;
        }

        /* ----- EMOJI SCENE BLOCKS (BIG & BEAUTIFUL) ----- */
        .reader-content .emoji-scene {
          display: inline-block;
          font-size: 52px !important;
          line-height: 1.2;
          margin: 0.5rem 1.2rem 0.5rem 0;
          padding: 0.4rem 1rem;
          background: linear-gradient(145deg, #f5ede0, #e8dccc);
          border-radius: 28px 12px 28px 12px;
          box-shadow: 
            0 6px 24px rgba(201, 168, 76, 0.25),
            0 0 0 3px #fcf8f0,
            0 0 0 5px var(--book-gold-light);
          float: left;
          transform: perspective(800px) rotateY(-3deg) rotateX(2deg);
          transition: transform 0.3s ease, box-shadow 0.3s;
          min-width: 100px;
          text-align: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05));
          font-style: normal !important;
        }

        .reader-content .emoji-scene.right {
          float: right;
          margin: 0.5rem 0 0.5rem 1.2rem;
          transform: perspective(800px) rotateY(3deg) rotateX(2deg);
        }

        .reader-content .emoji-scene:hover {
          transform: perspective(800px) rotateY(0deg) rotateX(0deg) scale(1.04);
          box-shadow: 
            0 10px 32px rgba(201, 168, 76, 0.35),
            0 0 0 3px #fcf8f0,
            0 0 0 5px var(--book-gold);
        }

        .reader-content .emoji-scene .label {
          display: block;
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 12px !important;
          font-weight: 700;
          color: var(--book-forest);
          letter-spacing: 0.06em;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 40px;
          padding: 0.1rem 0.6rem;
          margin-top: 0.1rem;
          text-transform: uppercase;
          backdrop-filter: blur(4px);
          font-style: normal !important;
        }

        /* ----- CHARACTER NAMES (BOLD & COLORFUL) ----- */
        .reader-content .character {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 22px;
          color: var(--book-forest-light);
          display: inline;
          margin-right: 0.2rem;
          padding: 0.1rem 0.4rem;
          background: linear-gradient(to right, transparent, rgba(201, 168, 76, 0.1), transparent);
          border-radius: 4px;
          font-style: normal !important;
        }

        .reader-content .character::after {
          content: ': ';
          color: var(--book-gold);
          font-weight: 900;
        }

        /* ----- DIALOGUE ----- */
        .reader-content .dialogue {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 20px;
          color: var(--book-text);
          font-weight: 600;
          padding: 0.1rem 0.3rem;
          border-radius: 4px;
          font-style: normal !important;
        }

        .reader-content .dialogue::before {
          content: '"';
          color: var(--book-gold);
          font-size: 24px;
          font-weight: 700;
          opacity: 0.7;
        }

        .reader-content .dialogue::after {
          content: '"';
          color: var(--book-gold);
          font-size: 24px;
          font-weight: 700;
          opacity: 0.7;
        }

        /* ----- STAGE DIRECTIONS (no italics) ----- */
        .reader-content .stage-dir {
          font-family: 'Arial', 'Helvetica', sans-serif;
          color: #6b5a4a;
          background: rgba(245, 237, 224, 0.5);
          padding: 0.2rem 1rem;
          border-radius: 16px 4px 16px 4px;
          display: inline-block;
          margin: 0.2rem 0;
          font-size: 18px;
          border-left: 3px solid var(--book-gold-light);
          font-style: normal !important;
          font-weight: 400;
        }

        /* ----- PARAGRAPHS ----- */
        .reader-content p {
          margin-bottom: 1.2rem;
          padding: 0.3rem 0.5rem;
          border-radius: 12px;
          transition: background 0.3s ease;
          display: flow-root;
          clear: both;
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 20px;
          font-style: normal !important;
        }

        .reader-content p::after {
          content: '';
          display: table;
          clear: both;
        }

        /* ----- NARRATOR SPECIAL STYLING (no italics) ----- */
        .reader-content .narrator-text {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 20px;
          color: #3d2a1a;
          padding: 0.8rem 1.5rem;
          background: linear-gradient(to right, rgba(201, 168, 76, 0.05), rgba(201, 168, 76, 0.1), rgba(201, 168, 76, 0.05));
          border-radius: 24px 4px 24px 4px;
          border: 1px solid rgba(201, 168, 76, 0.15);
          line-height: 1.8;
          font-style: normal !important;
          font-weight: 500;
        }

        /* ----- CHAPTER HEADERS (for story-format books like The Weight of Envy, The Dreamer) ----- */
        .reader-content .chapter-header {
          margin: 2.5rem 0 1.5rem 0;
          padding: 1rem 0;
          border-top: 2px solid rgba(201, 168, 76, 0.2);
          border-bottom: 2px solid rgba(201, 168, 76, 0.2);
          text-align: center;
        }

        .reader-content .chapter-number {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 18px;
          color: var(--book-gold);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 0.3rem;
          font-style: normal !important;
        }

        .reader-content .chapter-title {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 28px;
          color: var(--book-forest);
          letter-spacing: 0.03em;
          font-style: normal !important;
        }

        .reader-content .chapter-emoji {
          text-align: center;
          font-size: 48px;
          margin: 1rem 0;
          line-height: 1.3;
        }

        /* ----- EPILOGUE HEADING ----- */
        .reader-content .epilogue-heading {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 28px;
          color: var(--book-forest);
          text-align: center;
          margin: 2rem 0 1rem 0;
          letter-spacing: 0.08em;
          font-style: normal !important;
        }

        .reader-content .epilogue-heading::after {
          content: '✦ ✦ ✦';
          display: block;
          font-size: 18px;
          color: var(--book-gold);
          letter-spacing: 0.5em;
          margin-top: 0.3rem;
          opacity: 0.5;
          font-style: normal !important;
        }

        /* ----- TITLE PAGE (for story-format books) ----- */
        .reader-content .title-page {
          text-align: center;
          padding: 2rem 0 3rem 0;
          border-bottom: 2px solid rgba(201, 168, 76, 0.2);
          margin-bottom: 2rem;
        }

        .reader-content .title-page h1 {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 42px;
          color: var(--book-forest);
          letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
          text-shadow: 2px 2px 0 rgba(201, 168, 76, 0.15);
          font-style: normal !important;
        }

        .reader-content .title-page .subtitle {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 22px;
          color: #7a6a4a;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-style: normal !important;
        }

        .reader-content .title-page .author {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 18px;
          color: #9a8a6a;
          font-weight: 500;
          font-style: normal !important;
        }

        .reader-content .title-page .title-emoji {
          font-size: 64px;
          display: block;
          margin-bottom: 1rem;
          line-height: 1.2;
        }

        /* ----- THE END (for story-format books) ----- */
        .reader-content .the-end {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-weight: 900;
          font-size: 32px;
          text-align: center;
          color: var(--book-gold);
          margin: 2.5rem 0 1rem 0;
          letter-spacing: 0.3em;
          text-shadow: 0 2px 12px rgba(201, 168, 76, 0.2);
          position: relative;
          font-style: normal !important;
        }

        .reader-content .the-end::before {
          content: '✦ ✦ ✦ ✦ ✦';
          display: block;
          font-size: 18px;
          color: var(--book-gold-light);
          letter-spacing: 0.8em;
          margin-bottom: 0.5rem;
          opacity: 0.4;
          font-style: normal !important;
        }

        /* ----- SPEAKING HIGHLIGHT (golden glow) ----- */
        .reader-content .speaking-sentence {
          background: rgba(201, 168, 76, 0.15) !important;
          border-radius: 8px;
          padding: 0.1rem 0.4rem;
          box-shadow: 0 0 30px rgba(201, 168, 76, 0.15), inset 0 0 20px rgba(201, 168, 76, 0.05);
          animation: bookGlow 1.2s ease-in-out;
          border: 1px solid rgba(201, 168, 76, 0.1);
          font-style: normal !important;
        }

        @keyframes bookGlow {
          0% { box-shadow: 0 0 0 rgba(201, 168, 76, 0); }
          50% { box-shadow: 0 0 40px rgba(201, 168, 76, 0.25); }
          100% { box-shadow: 0 0 30px rgba(201, 168, 76, 0.15); }
        }

        /* ----- PARAGRAPH SPEAKING HIGHLIGHT ----- */
        .reader-content p.speaking {
          background: rgba(201, 168, 76, 0.04);
          border-radius: 16px;
          padding: 0.3rem 0.8rem;
          box-shadow: inset 0 0 40px rgba(201, 168, 76, 0.04);
        }

        .reader-content p,

        .reader-content span,
        .reader-content div {
          transition: background 0.3s ease;
          font-style: normal !important;
        }

        /* ----- SPINNER ANIMATION (fallback if Tailwind animate-spin not available) ----- */
        @keyframes ebook-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: ebook-spin 1s linear infinite !important;
        }

        /* ----- RESPONSIVE ----- */
        @media (max-width: 768px) {
          .reader-content {
            padding: 1.5rem;
            margin: 0.5rem;
            font-size: 18px;
          }
          
          .reader-content .act-heading {
            font-size: 26px;
          }
          
          .reader-content .scene-heading {
            font-size: 20px;
          }
          
          .reader-content .emoji-scene {
            font-size: 40px !important;
            float: none !important;
            display: block;
            margin: 0.8rem auto !important;
            width: fit-content;
            transform: none !important;
          }
          
          .reader-content .emoji-scene:hover {
            transform: scale(1.04) !important;
          }
          
          .reader-content .character {
            font-size: 18px;
          }
          
          .reader-content .dialogue {
            font-size: 18px;
          }
          
          .reader-content .the-end {
            font-size: 26px;
          }
          
          .reader-content .stage-dir {
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .reader-content {
            padding: 1rem;
            margin: 0.25rem;
            font-size: 16px;
            border-radius: 0.75rem;
          }
          
          .reader-content .act-heading {
            font-size: 22px;
          }
          
          .reader-content .scene-heading {
            font-size: 17px;
          }
          
          .reader-content .emoji-scene {
            font-size: 34px !important;
          }
          
          .reader-content .character {
            font-size: 16px;
          }
          
          .reader-content .dialogue {
            font-size: 16px;
          }
          
          .reader-content .the-end {
            font-size: 22px;
          }
        }

        .reader-loading {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          color: #64748b;
          gap: 0.75rem;
          font-size: 1.1rem;
        }

        .reader-error {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          color: #ef4444;
          font-size: 1.1rem;
          padding: 2rem;
          text-align: center;
        }

        @media (max-width: 640px) {
          .read-aloud-controls { padding: 0.5rem 1rem; }
          .voice-selector { min-width: 120px; font-size: 0.75rem; }
          .reading-status { font-size: 0.7rem; }
        }

        .stats-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .stat-chip {
          padding: 0.5rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .stat-chip strong {
          color: #f8fafc;
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <Library size={20} color="white" />
          </span>
          e-Book Library
        </h1>
      </div>

      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
      }} />

      <div className="stats-row">
        <div className="stat-chip">
          Total Books: <strong>{books.length}</strong>
        </div>
        <div className="stat-chip">
          Filtered: <strong>{filteredBooks.length}</strong>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, author, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="ebook-search"
          />
        </div>
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          data-testid="category-filter"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
          data-testid="grade-filter"
        >
          <option value="">All Grades</option>
          {classes.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Loading e-books...</div>
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <Library size={64} className="empty-icon" />
          <div className="empty-title">
            {books.length === 0 ? 'No e-Books Yet' : 'No Results Found'}
          </div>
          <p>
            {books.length === 0 
              ? 'No e-books are available in the library yet.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
        </div>
      ) : (
        <div className="books-grid">
          {filteredBooks.map(book => {
            const isLocked = book.locked === true;
            return (
            <div key={book.id} className={`book-card${isLocked ? ' locked' : ''}`} data-testid={`book-card-${book.id}`} onClick={() => {
              if (isLocked && !canLock) {
                toast.error('This e-book is locked by the principal');
                return;
              }
              handleView(book);
            }}>
              <div className="book-cover" style={{ background: getCoverColor(book.title) }}>
                {isLocked && (
                  <div className="book-lock-overlay">
                    <div className="book-lock-icon">
                      <Lock size={28} color="white" />
                    </div>
                  </div>
                )}
                <div className="book-cover-inner">
                  <div className="book-cover-emoji-art">
                    {getCoverEmojiArt(book.title).map((emoji, i) => (
                      <span key={i} className={`book-cover-emoji emoji-pos-${i}`}>{emoji}</span>
                    ))}
                  </div>
                  <div className="book-cover-title">{book.title}</div>
                </div>
                <span className="book-cover-badge">
                  {CATEGORIES.find(c => c.value === book.category)?.label || book.category}
                </span>
                {book.file_url && book.file_url.endsWith('.html') && (
                  <span className="book-cover-type">
                    <Volume2 size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                    Read Aloud
                  </span>
                )}
              </div>
              <div className="book-content">
                <h3 className="book-title">{book.title}</h3>
                {book.author && <p className="book-author">by {book.author}</p>}
                <div className="book-meta">
                  {book.grade_level && (
                    <span className="book-meta-tag">{book.grade_level}</span>
                  )}
                  {book.subject && (
                    <span className="book-meta-tag">{book.subject}</span>
                  )}
                </div>
                <div className="book-actions">
                  <button 
                    className="book-action-btn btn-view"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLocked && !canLock) {
                        toast.error('This e-book is locked by the principal');
                        return;
                      }
                      handleView(book);
                    }}
                    data-testid={`view-book-${book.id}`}
                  >
                    {book.file_url && book.file_url.endsWith('.html') ? (
                      <><BookOpen size={16} /> Read Book</>
                    ) : (
                      <><Eye size={16} /> View PDF</>
                    )}
                  </button>
                  {canLock && (
                    <button 
                      className={`book-action-btn ${isLocked ? 'btn-unlock' : 'btn-lock'}`}
                      onClick={(e) => handleToggleLock(book.id, e)}
                      data-testid={`lock-book-${book.id}`}
                      title={isLocked ? 'Unlock this e-book' : 'Lock this e-book'}
                    >
                      {isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      className="book-action-btn btn-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }}
                      data-testid={`delete-book-${book.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Reader Modal - Direct HTML Render (no iframe) */}
      {readerBook && (
        <div className="reader-overlay" onClick={closeReader}>
          <div className="reader-container" onClick={e => e.stopPropagation()}>
            <div className="reader-header">
              <div className="reader-header-info">
                <BookOpen size={18} />
                <span className="reader-title">{readerBook.title}</span>
                {readerBook.author && <span className="reader-author">by {readerBook.author}</span>}
              </div>
              <button className="reader-close-btn" onClick={closeReader}>
                <X size={24} />
              </button>
            </div>
            {/* READ ALOUD CONTROLS */}
            {bookContent && !bookLoading && !bookError && (
              <div className="read-aloud-controls">
                {!isReading && !isSpeechLoading ? (
                  <button 
                    className="read-aloud-btn btn-speak"
                    onClick={readBookAloud}
                    disabled={!bookContent || isSpeechLoading}
                    data-testid="read-aloud-btn"
                  >
                    <>
                      <Volume2 size={16} />
                      Read Aloud
                    </>
                  </button>
                ) : isPaused ? (
                  <button 
                    className="read-aloud-btn btn-resume"
                    onClick={resumeReading}
                  >
                    <Volume2 size={16} />
                    Resume
                  </button>
                ) : (
                  <>
                    <button 
                      className="read-aloud-btn btn-pause"
                      onClick={pauseReading}
                      disabled={isSpeechLoading || isPauseLoading}
                    >
                      {isSpeechLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Starting...</>
                      ) : isPauseLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Pausing...</>
                      ) : (
                        <>⏸ Pause</>
                      )}
                    </button>
                    <button 
                      className="read-aloud-btn btn-stop"
                      onClick={stopReading}
                      disabled={isSpeechLoading || isStopLoading}
                    >
                      {isSpeechLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Starting...</>
                      ) : isStopLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Stopping...</>
                      ) : (
                        <>⏹ Stop</>
                      )}
                    </button>
                  </>
                )}
                
                <select 
                  className="voice-selector"
                  value={selectedVoice?.name || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.name === e.target.value);
                    setSelectedVoice(voice);
                    // If currently reading, restart with new voice
                    if (isReading) {
                      const currentIdx = currentSentenceIndexRef.current;
                      stopReading();
                      setTimeout(() => {
                        if (sentencesRef.current.length > 0 && currentIdx < sentencesRef.current.length) {
                          speakSentence(sentencesRef.current[currentIdx], currentIdx);
                        }
                      }, 100);
                    }
                  }}
                >
                  <option value="">Select voice...</option>
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} {voice.gender ? '(' + voice.gender + ')' : ''}
                    </option>
                  ))}
                </select>
                
                <span className="reading-status">
                  {totalSentences > 0 && (
                    <>📖 {readingProgress}/{totalSentences}</>
                  )}
                </span>
                
                <div className="reading-progress">
                  <div 
                    className="reading-progress-bar"
                    style={{ 
                      width: totalSentences > 0 
                        ? `${(readingProgress / totalSentences) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>
            )}

            {bookLoading ? (
              <div className="reader-loading">
                <Loader2 size={24} className="animate-spin" />
                Loading book content...
              </div>
            ) : bookError ? (
              <div className="reader-error">
                {bookError}
              </div>
            ) : (
              <>
                {/* Inject e-book's own styles */}
                {bookStyles && (
                  <style>{bookStyles}</style>
                )}
                <div 
                  className="reader-content"
                  ref={contentRef}
                  dangerouslySetInnerHTML={{ __html: bookContent }}
                />
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default EBook;

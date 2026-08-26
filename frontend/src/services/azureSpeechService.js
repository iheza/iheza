/**
 * Azure Cognitive Services Speech Service
 * Provides high-quality neural text-to-speech using Azure's API
 * instead of the browser's robotic SpeechSynthesis.
 */

// Azure Speech configuration from environment variables
const AZURE_SPEECH_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.REACT_APP_AZURE_SPEECH_REGION;
const AZURE_SPEECH_ENDPOINT = process.env.REACT_APP_AZURE_SPEECH_ENDPOINT;

// Default voice - a natural, child-friendly neural voice
const DEFAULT_VOICE = 'en-US-JennyNeural';
const DEFAULT_VOICE_CHILD = 'en-US-AriaNeural';

// Available neural voices for selection
const AVAILABLE_VOICES = [
  { name: 'Jenny (Natural Female)', voice: 'en-US-JennyNeural', gender: 'female' },
  { name: 'Aria (Natural Female)', voice: 'en-US-AriaNeural', gender: 'female' },
  { name: 'Guy (Natural Male)', voice: 'en-US-GuyNeural', gender: 'male' },
  { name: 'Davis (Natural Male)', voice: 'en-US-DavisNeural', gender: 'male' },
  { name: 'Jane (Natural Female)', voice: 'en-US-JaneNeural', gender: 'female' },
  { name: 'Jason (Natural Male)', voice: 'en-US-JasonNeural', gender: 'male' },
  { name: 'Nancy (Natural Female)', voice: 'en-US-NancyNeural', gender: 'female' },
  { name: 'Sara (Natural Female)', voice: 'en-US-SaraNeural', gender: 'female' },
  { name: 'Tony (Natural Male)', voice: 'en-US-TonyNeural', gender: 'male' },
  { name: 'Michelle (Natural Female)', voice: 'en-US-MichelleNeural', gender: 'female' },
  { name: 'Ana (Natural Female - Child)', voice: 'en-US-AnaNeural', gender: 'female', style: 'child' },
  { name: 'Christopher (Natural Male)', voice: 'en-US-ChristopherNeural', gender: 'male' },
  { name: 'Eric (Natural Male)', voice: 'en-US-EricNeural', gender: 'male' },
  { name: 'Steffan (Natural Male)', voice: 'en-US-SteffanNeural', gender: 'male' },
];

// Check if Azure Speech is configured
export function isAzureSpeechConfigured() {
  return !!(AZURE_SPEECH_KEY && AZURE_SPEECH_REGION);
}

// Get available voices list
export function getAvailableVoices() {
  return AVAILABLE_VOICES;
}

// Get default voice
export function getDefaultVoice() {
  return DEFAULT_VOICE;
}

/**
 * Escape XML special characters for SSML
 * Using hex character codes to avoid auto-formatter issues
 */
function escapeXml(text) {
  // Build entity strings dynamically to avoid auto-formatter converting them
  var a = '&' + 'a' + 'm' + 'p' + ';';
  var l = '&' + 'l' + 't' + ';';
  var g = '&' + 'g' + 't' + ';';
  var q = '&' + 'q' + 'u' + 'o' + 't' + ';';
  var p = '&' + 'a' + 'p' + 'o' + 's' + ';';
  // First remove any XML-invalid control characters (except tab, CR, LF)
  var cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned
    .replace(/&/g, a)
    .replace(/</g, l)
    .replace(/>/g, g)
    .replace(/"/g, q)
    .replace(/'/g, p);
}

/**
 * Synthesize speech using Azure Cognitive Services REST API
 * This avoids needing the full SDK and works with just fetch/axios
 * 
 * @param {string} text - The text to speak
 * @param {string} voiceName - The Azure voice name (e.g., 'en-US-JennyNeural')
 * @param {object} options - Additional options (rate, pitch, volume)
 * @returns {Promise<HTMLAudioElement>} - A promise that resolves with an Audio element
 */
export async function synthesizeSpeech(text, voiceName, options) {
  if (!voiceName) voiceName = DEFAULT_VOICE;
  if (!options) options = {};
  
  // Format prosody values for Azure SSML
  // rate: Azure accepts percentage values like "+25%" or "-10%", or named values
  var rate = options.rate;
  if (rate === undefined || rate === null) rate = 1.0;
  if (typeof rate === 'number') {
    // Convert multiplier (e.g., 0.9 = 10% slower, 1.25 = 25% faster) to percentage
    var ratePercent = Math.round((rate - 1.0) * 100);
    if (ratePercent >= 0) {
      rate = '+' + ratePercent + '%';
    } else {
      rate = ratePercent + '%';
    }
  } else {
    rate = String(rate);
  }
  
  // pitch: Azure accepts percentage values like "+25%" or "-10%", or named values
  var pitch = options.pitch;
  if (pitch === undefined || pitch === null) pitch = 1.0;
  if (typeof pitch === 'number') {
    // Convert multiplier (e.g., 1.25 = 25% higher) to percentage
    var pitchPercent = Math.round((pitch - 1.0) * 100);
    if (pitchPercent >= 0) {
      pitch = '+' + pitchPercent + '%';
    } else {
      pitch = pitchPercent + '%';
    }
  } else {
    pitch = String(pitch);
  }
  
  // volume: Azure accepts percentage values like "+20%" or "-50%", or named values
  var volume = options.volume;
  if (volume === undefined || volume === null) volume = 1.0;
  if (typeof volume === 'number') {
    // Convert multiplier (e.g., 1.0 = 0% change) to percentage
    var volPercent = Math.round((volume - 1.0) * 100);
    if (volPercent >= 0) {
      volume = '+' + volPercent + '%';
    } else {
      volume = volPercent + '%';
    }
  } else {
    volume = String(volume);
  }

  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    throw new Error('Azure Speech not configured. Please set REACT_APP_AZURE_SPEECH_KEY and REACT_APP_AZURE_SPEECH_REGION in .env');
  }

  // Build the SSML with prosody control
  var escapedText = escapeXml(text);
  var ssml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="en-US">' +
    '<voice name="' + voiceName + '">' +
    '<prosody rate="' + rate + '" pitch="' + pitch + '" volume="' + volume + '">' +
    escapedText +
    '</prosody>' +
    '</voice>' +
    '</speak>';

  var endpoint = AZURE_SPEECH_ENDPOINT || ('https://' + AZURE_SPEECH_REGION + '.tts.speech.microsoft.com/cognitiveservices/v1');

  // Use AbortController with a timeout so a slow/unreachable Azure endpoint
  // doesn't leave the "Starting..." spinner spinning forever.
  var controller = new AbortController();
  var timeoutId = setTimeout(function() {
    controller.abort();
  }, 15000); // 15 second timeout

  var response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'iheza-ebook-reader'
      },
      body: ssml,
      signal: controller.signal
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError.name === 'AbortError') {
      throw new Error('Azure TTS timed out. Please check your internet connection and try again.');
    }
    throw fetchError;
  }
  clearTimeout(timeoutId);


  if (!response.ok) {
    var errorText = await response.text();
    // Log the SSML for debugging
    console.error('Azure TTS failed:', response.status, errorText);
    console.error('SSML sent:', ssml.substring(0, 500) + '...');
    throw new Error('Azure TTS failed: ' + response.status + ' - ' + errorText);
  }

  // Get the audio blob and create an audio element
  var audioBlob = await response.blob();
  var audioUrl = URL.createObjectURL(audioBlob);
  var audio = new Audio(audioUrl);
  // Use original numeric volume for the HTMLAudioElement (0.0 to 1.0)
  audio.volume = options.volume !== undefined ? options.volume : 1.0;
  
  return audio;
}

/**
 * Azure Speech Manager class
 * Manages the queue of sentences to speak, with pause/resume/stop controls
 */
export class AzureSpeechManager {
  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.queue = [];
    this.currentIndex = 0;
    this.voiceName = DEFAULT_VOICE;
    this.options = { rate: 1.0, pitch: 1.0, volume: 1.0 };
    this.onStart = null;
    this.onEnd = null;
    this.onSentenceStart = null;
    this.onSentenceEnd = null;
    this.onError = null;
    this._cancelled = false;
  }

  setVoice(voiceName) {
    this.voiceName = voiceName;
  }

  setOptions(options) {
    this.options = Object.assign({}, this.options, options);
  }

  /**
   * Speak a list of sentences sequentially
   */
  async speakSentences(sentences, startIndex) {
    if (startIndex === undefined) startIndex = 0;
    this.queue = sentences;
    this.currentIndex = startIndex;
    this.isPlaying = true;
    this.isPaused = false;
    this._cancelled = false;

    if (this.onStart) this.onStart();

    await this._playQueue();
  }

  async _playQueue() {
    var self = this;
    
    while (self.currentIndex < self.queue.length && !self._cancelled) {
      if (self.isPaused) {
        // Wait until resumed or cancelled
        await new Promise(function(resolve) {
          self._resumeResolver = resolve;
        });
        self._resumeResolver = null;
        if (self._cancelled) break;
        continue;
      }

      var text = self.queue[self.currentIndex];
      
      if (self.onSentenceStart) {
        self.onSentenceStart(text, self.currentIndex);
      }

      try {
        var audio = await synthesizeSpeech(text, self.voiceName, self.options);
        self.currentAudio = audio;

        // Append audio to DOM temporarily to ensure it plays in all browsers
        audio.style.display = 'none';
        document.body.appendChild(audio);

        await new Promise(function(resolve, reject) {
          audio.onended = function() {
            self.currentAudio = null;
            // Remove from DOM after playback
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
            resolve();
          };
          audio.onerror = function(e) {
            self.currentAudio = null;
            // Remove from DOM on error
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
            reject(e);
          };
          // Play and handle autoplay rejection
          var playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(function(err) {
              // Autoplay was prevented - resolve anyway so queue continues
              console.warn('Audio play was blocked:', err);
              self.currentAudio = null;
              if (audio.parentNode) {
                audio.parentNode.removeChild(audio);
              }
              resolve();
            });
          }
        });

        if (self._cancelled) break;

        if (self.onSentenceEnd) {
          self.onSentenceEnd(self.currentIndex);
        }

        self.currentIndex++;
      } catch (error) {
        if (self._cancelled) break;
        if (self.onError) {
          self.onError(error, self.currentIndex);
        }
        // Continue to next sentence on error
        self.currentIndex++;
      }
    }

    if (!self._cancelled) {
      self.isPlaying = false;
      if (self.onEnd) self.onEnd();
    }
  }

  pause() {
    this.isPaused = true;
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  resume() {
    this.isPaused = false;
    if (this.currentAudio) {
      this.currentAudio.play().catch(function() {});
    }
    if (this._resumeResolver) {
      this._resumeResolver();
    }
  }

  stop() {
    this._cancelled = true;
    this.isPlaying = false;
    this.isPaused = false;
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    if (this._resumeResolver) {
      this._resumeResolver();
    }
    
    this.queue = [];
    this.currentIndex = 0;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  isActive() {
    return this.isPlaying;
  }

  isPausedState() {
    return this.isPaused;
  }
}

// Singleton instance
var managerInstance = null;

export function getSpeechManager() {
  if (!managerInstance) {
    managerInstance = new AzureSpeechManager();
  }
  return managerInstance;
}

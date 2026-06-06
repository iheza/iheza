/**
 * Notification Sound Hook
 * Provides sound effects for all toast/notification actions
 * Uses Web Audio API to generate tones - no external audio files needed
 */

// Audio context singleton
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[Sound] Web Audio API not supported');
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a tone using Web Audio API
 * @param {number} frequency - Hz frequency
 * @param {number} duration - Duration in seconds
 * @param {string} type - Oscillator type (sine, square, triangle, sawtooth)
 * @param {number} volume - Volume 0-1
 */
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Envelope for smooth sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail - audio is not critical
  }
}

/**
 * Play a success sound (ascending cheerful tone)
 */
function playSuccessSound() {
  playTone(523.25, 0.15, 'sine', 0.25); // C5
  setTimeout(() => playTone(659.25, 0.15, 'sine', 0.25), 100); // E5
  setTimeout(() => playTone(783.99, 0.3, 'sine', 0.25), 200); // G5
}

/**
 * Play an error sound (descending harsh tone)
 */
function playErrorSound() {
  playTone(400, 0.2, 'square', 0.2);
  setTimeout(() => playTone(300, 0.3, 'square', 0.2), 150);
}

/**
 * Play a warning sound (two-tone alert)
 */
function playWarningSound() {
  playTone(440, 0.15, 'triangle', 0.2);
  setTimeout(() => playTone(440, 0.15, 'triangle', 0.2), 200);
  setTimeout(() => playTone(440, 0.15, 'triangle', 0.2), 400);
}

/**
 * Play an info sound (soft single tone)
 */
function playInfoSound() {
  playTone(600, 0.2, 'sine', 0.15);
}

/**
 * Play a delete sound (descending whoosh)
 */
function playDeleteSound() {
  playTone(500, 0.1, 'triangle', 0.15);
  setTimeout(() => playTone(400, 0.1, 'triangle', 0.15), 80);
  setTimeout(() => playTone(300, 0.15, 'triangle', 0.15), 160);
}

/**
 * Play a create/add sound (ascending sparkle)
 */
function playCreateSound() {
  playTone(400, 0.1, 'sine', 0.2);
  setTimeout(() => playTone(500, 0.1, 'sine', 0.2), 60);
  setTimeout(() => playTone(600, 0.1, 'sine', 0.2), 120);
  setTimeout(() => playTone(800, 0.2, 'sine', 0.2), 180);
}

/**
 * Play an update sound (two-tone confirmation)
 */
function playUpdateSound() {
  playTone(440, 0.12, 'sine', 0.2);
  setTimeout(() => playTone(660, 0.2, 'sine', 0.2), 100);
}

/**
 * Play a login sound (welcome jingle)
 */
function playLoginSound() {
  playTone(523.25, 0.15, 'sine', 0.2); // C5
  setTimeout(() => playTone(587.33, 0.15, 'sine', 0.2), 100); // D5
  setTimeout(() => playTone(659.25, 0.15, 'sine', 0.2), 200); // E5
  setTimeout(() => playTone(783.99, 0.3, 'sine', 0.25), 300); // G5
}

/**
 * Play a logout sound (descending)
 */
function playLogoutSound() {
  playTone(600, 0.12, 'sine', 0.15);
  setTimeout(() => playTone(500, 0.12, 'sine', 0.15), 80);
  setTimeout(() => playTone(400, 0.2, 'sine', 0.15), 160);
}

/**
 * Play a scan/check-in sound (beep-boop)
 */
function playScanSound() {
  playTone(800, 0.08, 'sine', 0.25);
  setTimeout(() => playTone(1200, 0.15, 'sine', 0.25), 80);
}

/**
 * Play a late check-in sound (lower tone)
 */
function playLateSound() {
  playTone(350, 0.2, 'triangle', 0.2);
  setTimeout(() => playTone(300, 0.2, 'triangle', 0.2), 200);
  setTimeout(() => playTone(250, 0.3, 'triangle', 0.2), 400);
}

/**
 * Play a notification/alert sound (for new tasks, announcements)
 */
function playNotificationSound() {
  playTone(880, 0.1, 'sine', 0.2);
  setTimeout(() => playTone(880, 0.1, 'sine', 0.2), 150);
  setTimeout(() => playTone(1108.73, 0.2, 'sine', 0.2), 300); // C#6
}

/**
 * Sound notification hook
 * Returns functions to play different notification sounds
 */
export function useNotificationSound() {
  return {
    playSuccess: playSuccessSound,
    playError: playErrorSound,
    playWarning: playWarningSound,
    playInfo: playInfoSound,
    playDelete: playDeleteSound,
    playCreate: playCreateSound,
    playUpdate: playUpdateSound,
    playLogin: playLoginSound,
    playLogout: playLogoutSound,
    playScan: playScanSound,
    playLate: playLateSound,
    playNotification: playNotificationSound,
  };
}

/**
 * Sound-enabled toast wrapper
 * Enhances sonner toast with sound effects
 */
export function createSoundEnabledToast(toast) {
  return {
    success: (message, options) => {
      playSuccessSound();
      return toast.success(message, options);
    },
    error: (message, options) => {
      playErrorSound();
      return toast.error(message, options);
    },
    warning: (message, options) => {
      playWarningSound();
      return toast.warning(message, options);
    },
    info: (message, options) => {
      playInfoSound();
      return toast.info(message, options);
    },
    // Pass through for custom usage
    custom: toast,
  };
}

// Export individual sound functions for direct use
export const SoundEffects = {
  success: playSuccessSound,
  error: playErrorSound,
  warning: playWarningSound,
  info: playInfoSound,
  delete: playDeleteSound,
  create: playCreateSound,
  update: playUpdateSound,
  login: playLoginSound,
  logout: playLogoutSound,
  scan: playScanSound,
  late: playLateSound,
  notification: playNotificationSound,
};

// Test PWA requirements
console.log('=== PWA Requirements Check ===');

// Check if HTTPS or localhost
const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
console.log('✓ Secure context (HTTPS/localhost):', isSecure);

// Check if service worker is registered
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(registration => {
    console.log('✓ Service Worker registered:', !!registration);
    if (registration) {
      console.log('  Scope:', registration.scope);
      console.log('  Active:', !!registration.active);
    }
  }).catch(err => {
    console.log('✗ Service Worker check failed:', err);
  });
} else {
  console.log('✗ Service Worker not supported');
}

// Check if manifest exists
const manifestLink = document.querySelector('link[rel="manifest"]');
console.log('✓ Manifest link found:', !!manifestLink);
if (manifestLink) {
  fetch(manifestLink.href)
    .then(response => response.json())
    .then(manifest => {
      console.log('✓ Manifest loaded successfully');
      console.log('  Name:', manifest.name);
      console.log('  Start URL:', manifest.start_url);
      console.log('  Display:', manifest.display);
    })
    .catch(err => {
      console.log('✗ Manifest load failed:', err);
    });
}

// Check display mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
console.log('✓ Display mode check:');
console.log('  Standalone:', isStandalone);
console.log('  Fullscreen:', isFullscreen);
console.log('  Minimal UI:', isMinimalUI);
console.log('  Is installed as PWA:', isStandalone || isFullscreen || isMinimalUI);

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('✓ beforeinstallprompt event fired!');
  console.log('  Platforms:', e.platforms);
  console.log('  User can install');
  e.preventDefault();
  // Store the event for later use
  window.deferredPrompt = e;
});

// Check after a delay
setTimeout(() => {
  console.log('\n=== PWA Installation Status ===');
  console.log('Deferred prompt available:', !!window.deferredPrompt);
  
  if (window.deferredPrompt) {
    console.log('✓ PWA can be installed!');
    console.log('To trigger install: window.deferredPrompt.prompt()');
  } else {
    console.log('✗ PWA install prompt not available yet');
    console.log('Possible reasons:');
    console.log('  - User already dismissed prompt');
    console.log('  - Site doesn\'t meet engagement criteria');
    console.log('  - Browser doesn\'t support installation');
  }
}, 3000);
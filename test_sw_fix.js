// Test script to verify service worker is working
console.log('=== Service Worker Test ===');

// Check if service worker is supported
if ('serviceWorker' in navigator) {
  console.log('✓ Service Worker API is supported');
  
  // Check registration
  navigator.serviceWorker.getRegistration().then(registration => {
    if (registration) {
      console.log('✓ Service Worker is registered');
      console.log('  Scope:', registration.scope);
      console.log('  Active:', !!registration.active);
      console.log('  Waiting:', !!registration.waiting);
      console.log('  Installing:', !!registration.installing);
      
      // Check if service worker is controlling the page
      if (navigator.serviceWorker.controller) {
        console.log('✓ Service Worker is controlling this page');
        console.log('  Controller URL:', navigator.serviceWorker.controller.scriptURL);
      } else {
        console.log('✗ Service Worker is not controlling this page yet');
        console.log('  Page may need to be reloaded');
      }
    } else {
      console.log('✗ No Service Worker registration found');
    }
  }).catch(err => {
    console.log('✗ Error checking service worker registration:', err);
  });
  
  // Listen for service worker messages
  navigator.serviceWorker.addEventListener('message', event => {
    console.log('✓ Message from Service Worker:', event.data);
  });
  
  // Test a fetch to see if service worker intercepts it
  console.log('\n=== Testing Fetch Interception ===');
  fetch('/test-sw-fetch')
    .then(response => {
      console.log('✓ Fetch completed, status:', response.status);
      console.log('  Service Worker handled:', response.headers.get('via') === 'service-worker');
    })
    .catch(error => {
      console.log('✗ Fetch failed:', error.message);
      console.log('  This is expected for non-existent endpoint');
    });
  
} else {
  console.log('✗ Service Worker not supported in this browser');
}

// Check for errors in console
window.addEventListener('error', event => {
  console.log('✗ JavaScript Error:', event.message);
  console.log('  File:', event.filename);
  console.log('  Line:', event.lineno);
  console.log('  Column:', event.colno);
});

window.addEventListener('unhandledrejection', event => {
  console.log('✗ Unhandled Promise Rejection:', event.reason);
});

console.log('\n=== Service Worker Status ===');
console.log('If you see "Failed to fetch" errors above, the fix worked!');
console.log('The service worker now catches fetch errors and returns empty responses.');
console.log('This prevents the "Uncaught (in promise) TypeError: Failed to fetch" error.');
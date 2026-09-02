import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated, selectCurrentUser, selectCurrentPortal, checkAuth } from './store/slices/authSlice';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Staff from './pages/Staff';
import Classes from './pages/Classes';
import Attendance from './pages/Attendance';
import QRAttendance from './pages/QRAttendance';
import Grades from './pages/Grades';
import Reports from './pages/Reports';
import ReportCards from './pages/ReportCards';
import FeesManagement from './pages/FeesManagement';
import TaskAssignment from './pages/TaskAssignment';
import Classroom from './pages/Classroom';
import AcademicHub from './pages/AcademicHub';
import StudentPortal from './pages/StudentPortal';
import Announcements from './pages/Announcements';
import QRCodeManagement from './pages/QRCodeManagement';
import FeeStructure from './pages/FeeStructure';
import Almanac from './pages/Almanac';
import MyTasks from './pages/MyTasks';
import Teachers from './pages/Teachers';
import GenerateChainPage from './pages/GenerateChainPage';
import ChainLandingPage from './pages/ChainLandingPage';
import Documents from './pages/Documents';
import Bin from './pages/Bin';
import Expenses from './pages/Expenses';
import ExaminationReports from './pages/ExaminationReports';
import EBook from './pages/EBook';
import Admission from './pages/Admission';
import Timetable from './pages/Timetable';


// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRedirect from './components/RoleRedirect';
import PWAInstallPrompt from './components/PWAInstallPrompt';

import { ToastProvider } from './components/Common/Toast';
import { LanguageProvider } from './contexts/LanguageContext';

import './App.css';

// Clear all caches on app load to fix stale cache issues (bump version to force clear)
const CACHE_CLEAR_VERSION = 'v6-20260622a';
if (typeof window !== 'undefined') {
  const cacheCleared = localStorage.getItem('iheza_cache_cleared');
  if (cacheCleared !== CACHE_CLEAR_VERSION && 'caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        console.log('Cleared old cache:', name);
      });
    }).then(() => {
      localStorage.setItem('iheza_cache_cleared', CACHE_CLEAR_VERSION);
      // Unregister old service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
            console.log('Unregistered old service worker');
          });
        }).then(() => {
          // Reload to get fresh content
          if (cacheCleared) {
            window.location.reload();
          }
        });
      }
    });
  }
}

// Register Service Worker with auto-update handling
// Uses try/catch and multiple strategies to handle deployment environments
// that may serve sw.js with incorrect MIME types
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Helper to attempt SW registration with a specific URL
    const attemptRegistration = (swUrl) => {
      return navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          console.log('IHEZA SW registered:', registration.scope);
          
          // Check for updates immediately and periodically.
          // NOTE: We check every 30 minutes instead of every minute. Checking
          // every minute caused repeated "Failed to update a ServiceWorker ...
          // An unknown error occurred when fetching the script" errors on
          // preview hosts that intermittently fail to serve sw.js. A 30-minute
          // interval keeps the SW fresh without hammering the server.
          registration.update().catch(() => {
            // Ignore update failures - the SW will retry on the next interval.
            // This prevents unhandled promise rejections from spamming the console.
          });
          setInterval(() => {
            registration.update().catch(() => {
              // Ignore update failures silently.
            });
          }, 30 * 60 * 1000); // Check every 30 minutes
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('New service worker found, installing...');
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available - skip waiting and reload
                  console.log('New version ready, activating...');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
          
          return registration;
        });
    };

    // Try primary registration first
    attemptRegistration('/sw.js')
      .catch((error) => {
        console.log('IHEZA SW primary registration failed:', error.message);
        // Some deployment servers serve sw.js as text/html.
        // Try with explicit Content-Type workaround: register via blob URL
        console.log('Attempting SW registration via fetch fallback...');
        fetch('/sw.js')
          .then(response => response.text())
          .then(swContent => {
            // Create a blob with correct MIME type and register from it
            const blob = new Blob([swContent], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            return attemptRegistration(blobUrl);
          })
          .catch(fallbackError => {
            console.log('IHEZA SW fallback registration also failed:', fallbackError.message);
            console.log('App will work without service worker (offline support disabled)');
          });
      });
    
    // Listen for controller change (new SW took over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New service worker activated, reloading...');
      window.location.reload();
    });
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log('Service worker updated to version:', event.data.version);
      }
    });
  });
}

// Global PWA Install Prompt Handler
// This captures the beforeinstallprompt event and exposes it globally
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Store the event so it can be triggered later
  window.deferredPrompt = e;
  console.log('PWA install prompt ready');
  // Dispatch custom event so components can react
  window.dispatchEvent(new CustomEvent('pwaInstallReady'));
});

// Track when app is installed
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  window.deferredPrompt = null;
  window.dispatchEvent(new CustomEvent('pwaInstalled'));
});

function App() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectCurrentUser);
  const currentPortal = useSelector(selectCurrentPortal);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <div className="app">
      <PWAInstallPrompt />
      <LanguageProvider>
      <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chain/:chainName/:chainCode?" element={<ChainLandingPage />} />
        
        {/* Protected Portal Routes */}
        <Route
          path="/portal/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route index element={<RoleRedirect><Dashboard /></RoleRedirect>} />
                  <Route path="dashboard" element={<RoleRedirect><Dashboard /></RoleRedirect>} />

                  <Route path="students" element={<Students />} />
                  <Route path="staff" element={<Staff />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="attendance" element={<Attendance />} />
                  <Route path="qr-attendance" element={<QRAttendance />} />
                  <Route path="grades" element={<Grades />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="report-cards" element={<ReportCards />} />
                  <Route path="fees" element={<FeesManagement />} />
                  <Route path="tasks" element={<TaskAssignment />} />
                  <Route path="classroom" element={<Classroom />} />
                  <Route path="academic-hub" element={<AcademicHub />} />
                  <Route path="timetable" element={<Timetable />} />
                  <Route path="student-portal" element={<StudentPortal />} />

                  <Route path="announcements" element={<Announcements />} />
                  <Route path="qr-management" element={<QRCodeManagement />} />
                  <Route path="fee-structure" element={<FeeStructure />} />
                  <Route path="almanac" element={<Almanac />} />
                  <Route path="my-tasks" element={<MyTasks />} />
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="generate-chain" element={<GenerateChainPage />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="bin" element={<Bin />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="examination-reports" element={<ExaminationReports />} />
                  <Route path="ebook" element={<EBook />} />
                  <Route path="admission" element={<Admission />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ToastProvider>
      </LanguageProvider>
    </div>
  );
}

export default App;

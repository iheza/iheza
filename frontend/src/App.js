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

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { ToastProvider } from './components/Common/Toast';
import { LanguageProvider } from './contexts/LanguageContext';

import './App.css';

// Clear all caches on app load to fix stale cache issues (bump version to force clear)
const CACHE_CLEAR_VERSION = 'v5-20260420a';
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('IHEZA SW registered:', registration.scope);
        
        // Check for updates immediately and periodically
        registration.update();
        setInterval(() => {
          registration.update();
        }, 60 * 1000); // Check every minute
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New service worker found, installing...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available - skip waiting and reload
              console.log('New version ready, activating...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.log('IHEZA SW registration failed:', error);
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
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
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

import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectCurrentPortal } from '../store/slices/authSlice';

/**
 * RoleRedirect
 *
 * Wraps the admin Dashboard and redirects users to the appropriate
 * portal-specific dashboard based on their current portal.
 *
 * - Student portal users are redirected to their own student portal
 *   dashboard (/portal/student-portal) instead of the admin dashboard.
 * - All other portal users (director, coordinator, principal, teacher,
 *   secretary, academic, section leader) render the wrapped children
 *   (the admin Dashboard).
 */
function RoleRedirect({ children }) {
  const currentPortal = useSelector(selectCurrentPortal);

  // Normalize portal value (strip dashes/underscores, lowercase)
  const portal = (currentPortal || '').toLowerCase().replace(/[-_]/g, '');

  // Students should land on their own portal dashboard, not the admin one
  if (portal === 'student') {
    return <Navigate to="/portal/student-portal" replace />;
  }

  // All other portals render the wrapped dashboard
  return children;
}

export default RoleRedirect;

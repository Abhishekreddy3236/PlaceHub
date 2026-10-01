const permissionRank = {
  none: 0,
  read: 1,
  write: 2,
};

export const hasPermission = (user, resource, level = 'read') => {
  if (!user) {
    return false;
  }

  if (user?.role === 'admin') {
    return true;
  }

  if (user?.role !== 'staff') {
    return false;
  }

  const current = user?.permissions?.[resource] || 'none';
  return (permissionRank[current] || 0) >= (permissionRank[level] || 0);
};

import { GLOBAL_APPLICANTS_ENABLED } from '../config/features';

export const getStaffDefaultPath = (user) => {
  if (hasPermission(user, 'users', 'read')) {
    return '/admin/students';
  }

  if (hasPermission(user, 'jobs', 'read')) {
    return '/admin/jobs';
  }

  if (GLOBAL_APPLICANTS_ENABLED && hasPermission(user, 'applications', 'read')) {
    return '/admin/applicants';
  }

  if (hasPermission(user, 'accessControl', 'read')) {
    return '/admin/access-control';
  }

  return '/unauthorized';
};

export const getAuthenticatedHomePath = (user) => {
  if (!user) {
    return '/login';
  }

  if (user?.role === 'admin') {
    return user?.mustChangePassword ? '/admin/change-password' : '/admin';
  }

  if (user?.role === 'staff') {
    return user?.mustChangePassword ? '/change-password' : getStaffDefaultPath(user);
  }

  if (user?.role === 'hr') {
    return user?.mustChangePassword ? '/hr/change-password' : '/hr/applicants';
  }

  return '/dashboard';
};

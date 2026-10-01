export const formatDisplayName = (user) => {
  if (!user) return '';

  // Apply staff formatting rules only
  if (user.role === 'staff') {
    const email = user.email;

    if (email && typeof email === 'string' && email.includes('@')) {
      const usernamePart = email.split('@')[0];

      if (usernamePart) {
        return usernamePart
          .split('.')
          .map(
            (part) =>
              part
                ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                : ''
          )
          .filter(Boolean)
          .join(' ');
      }
    }
  }

  // Existing fallback for admin, HR, students, missing email
  return user.name || user.username || '';
};
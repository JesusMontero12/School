export const initials = (first = '', last = '') => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
export const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : '');
export const formatDate = (iso) =>
  iso ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'Nunca';

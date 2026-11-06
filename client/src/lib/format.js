export function resourceId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

export function displayName(value) {
  if (!value) return '';
  if (typeof value === 'string') return '';
  return value.name || value.displayName || '';
}

export function initials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_COLORS = [
  '#0f2742',
  '#1f6b45',
  '#6b5b3e',
  '#7a3e2f',
  '#3c4f66',
  '#4a3b6b',
  '#2f5d62',
  '#5a4a3a',
];

export function avatarColor(name = '') {
  let hash = 0;
  const text = String(name);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function formatDate(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMonth(value) {
  if (!value) return 'Undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

export function formatLatency(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export const POSITION_LABELS = {
  yes: 'Yes',
  no: 'No',
  abstain: 'Abstain',
  absent: 'Absent',
};

export function positionLabel(position) {
  const key = String(position || '').toLowerCase();
  return POSITION_LABELS[key] || 'Not recorded';
}

export function officeLabel(office) {
  if (!office) return '';
  if (typeof office === 'string') return '';
  return office.name || office.slug || '';
}

export function officeSlug(office) {
  if (!office) return '';
  if (typeof office === 'string') return office;
  return office.slug || office._id || office.id || '';
}

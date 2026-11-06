export function toFieldErrors(details) {
  const errors = {};
  if (!details) return errors;

  if (Array.isArray(details)) {
    details.forEach((entry) => {
      if (!entry) return;
      let key = '';
      if (typeof entry === 'string') {
        return;
      }
      if (typeof entry.path === 'string') {
        key = entry.path;
      } else if (Array.isArray(entry.path) && entry.path.length) {
        key = String(entry.path[0]);
      } else if (typeof entry.field === 'string') {
        key = entry.field;
      } else if (typeof entry.key === 'string') {
        key = entry.key;
      }
      if (!key) return;
      const message =
        typeof entry.message === 'string'
          ? entry.message
          : typeof entry.msg === 'string'
            ? entry.msg
            : 'This value is not valid.';
      if (!errors[key]) errors[key] = message;
    });
    return errors;
  }

  if (typeof details === 'object') {
    const source =
      details.fieldErrors && typeof details.fieldErrors === 'object'
        ? details.fieldErrors
        : details;

    Object.entries(source).forEach(([key, value]) => {
      if (key === 'fieldErrors' || key === 'formErrors') return;
      if (typeof value === 'string' && value) {
        errors[key] = value;
      } else if (Array.isArray(value)) {
        const message = value
          .map((item) =>
            typeof item === 'string' ? item : item && item.message ? item.message : ''
          )
          .filter(Boolean)
          .join(' ');
        if (message) errors[key] = message;
      } else if (value && typeof value.message === 'string') {
        errors[key] = value.message;
      }
    });
  }

  return errors;
}

export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return fallback;
}

export function safeNextPath(value, fallback = '/') {
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

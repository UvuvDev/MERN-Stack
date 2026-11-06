const ICONS = {
  error: (
    <svg viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7.8 12.2l2.8 2.8 5.6-5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" />
    </svg>
  ),
};

export default function Alert({
  variant = 'info',
  title,
  children,
  className = '',
  ...rest
}) {
  const role = variant === 'error' ? 'alert' : 'status';
  return (
    <div
      className={`alert alert--${variant} ${className}`.trim()}
      role={role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      {...rest}
    >
      <span className="alert__icon" aria-hidden="true">
        {ICONS[variant] || ICONS.info}
      </span>
      <div className="alert__body">
        {title ? <strong>{title}</strong> : null}
        {typeof children === 'string' ? <p>{children}</p> : children}
      </div>
    </div>
  );
}

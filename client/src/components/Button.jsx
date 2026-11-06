import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  loadingLabel = 'Working…',
  className = '',
  type = 'button',
  disabled = false,
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

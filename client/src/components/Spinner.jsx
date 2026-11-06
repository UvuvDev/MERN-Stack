export default function Spinner({ label, className = '' }) {
  const accessibility = label
    ? { role: 'status', 'aria-label': label }
    : { 'aria-hidden': 'true' };
  return <span className={`spinner ${className}`.trim()} {...accessibility} />;
}

export function Skeleton({ width, height, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonGroup({ label = 'Loading…', children }) {
  return (
    <div className="skeleton-group" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}

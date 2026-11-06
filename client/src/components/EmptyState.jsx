export default function EmptyState({ title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <rect x="9" y="6" width="30" height="36" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 16h16M16 23h16M16 30h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <h2>{title}</h2>
      {children ? <div className="empty-state__body">{children}</div> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export default function SampleDataBanner({ compact = false }) {
  return (
    <aside
      className={`sample-banner${compact ? ' sample-banner--compact' : ''}`}
      role="note"
      aria-label="Sample data notice"
    >
      <span className="sample-banner__mark" aria-hidden="true">
        S
      </span>
      <div>
        <strong>Sample data.</strong>{' '}
        {compact
          ? 'This comparison uses fictional sample records.'
          : 'The offices, candidates, bills, and votes shown here are fictional sample data. Names do not represent real officeholders.'}
      </div>
    </aside>
  );
}

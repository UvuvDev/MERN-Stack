export default function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  asideTitle = 'Save what you compared',
  asideText = 'A verified account keeps your briefings attached to you, so you can return to the record later.',
  asideItems = [
    'Comparisons are saved with the model responses from that moment.',
    'Your history is private to your account.',
    'We never send a candidate biography or platform to a model.',
  ],
}) {
  return (
    <div className="shell auth-page">
      <section className="auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {intro ? <p className="auth-intro">{intro}</p> : null}
        <div className="auth-card__body">{children}</div>
      </section>

      <aside className="auth-aside" aria-label="About accounts">
        <p className="eyebrow eyebrow--light">Why an account?</p>
        <h2>{asideTitle}</h2>
        <p>{asideText}</p>
        <ul className="auth-aside__list">
          {asideItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="auth-aside__note">
          Browsing offices, candidate profiles, and individual votes stays public.
        </p>
      </aside>
    </div>
  );
}

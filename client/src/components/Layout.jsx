import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <rect
          x="6.5"
          y="4.5"
          width="19"
          height="23"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M11 12h10M11 16.5h10M11 21h6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="23.5" cy="8.5" r="2.4" fill="#b98a2f" />
      </svg>
    </span>
  );
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  const signedInName = user && (user.displayName || user.email);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <Link to="/" className="brand" aria-label="Record Over Rhetoric home">
            <BrandMark />
            <span className="brand-text">
              <span className="brand-name">Record Over Rhetoric</span>
              <span className="brand-tagline">Votes, not rhetoric</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Primary">
            <ul>
              <li>
                <NavLink to="/" end>
                  Compare
                </NavLink>
              </li>
              <li>
                <NavLink to="/about">About</NavLink>
              </li>
              {user ? (
                <li>
                  <NavLink to="/history">History</NavLink>
                </li>
              ) : null}
            </ul>
          </nav>

          <div className="header-actions">
            {loading ? null : user ? (
              <div className="header-user">
                <span className="header-user__name">
                  <span className="header-user__label">Signed in as</span>{' '}
                  <strong>{signedInName}</strong>
                </span>
                <Button variant="ghost" onClick={handleLogout} className="btn--small">
                  Sign out
                </Button>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn--primary header-register">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="site-main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <p className="footer-title">Record Over Rhetoric</p>
            <p className="footer-note">
              An AI-assisted reading of roll-call voting records. Not an endorsement of any candidate,
              party, or platform.
            </p>
            <p className="footer-note footer-note--small">
              This demo uses fictional sample data. Always verify a record against an official source.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Footer">
            <Link to="/about">Methodology &amp; AI disclosure</Link>
            <a href="/api/docs" target="_blank" rel="noreferrer">
              API documentation (Swagger)
            </a>
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              GitHub (placeholder)
            </a>
          </nav>
        </div>
        <div className="shell footer-legal">
          <p>© {new Date().getFullYear()} Record Over Rhetoric. A MERN course project.</p>
          <p>Civic record only · no campaign rhetoric</p>
        </div>
      </footer>
    </>
  );
}

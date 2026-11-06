import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import AuthShell from '../components/AuthShell';
import Spinner from '../components/Spinner';

export default function VerifyEmail() {
  useDocumentTitle('Verify your email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'This verification link is missing its token. Use the link from your email, or request a new one.'
  );
  const [verifiedUser, setVerifiedUser] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        'This verification link is missing its token. Use the link from your email, or request a new one.'
      );
      return undefined;
    }

    if (!requestRef.current || requestRef.current.token !== token) {
      requestRef.current = { token, promise: authApi.verifyEmail(token) };
    }

    let active = true;
    requestRef.current.promise
      .then((data) => {
        if (!active) return;
        setStatus('success');
        setVerifiedUser(data && data.user ? data.user : null);
        setMessage(
          (data && data.message) ||
            'Your email address is verified. You can now sign in and run a comparison.'
        );
      })
      .catch((error) => {
        if (!active) return;
        setStatus('error');
        setMessage(errorMessage(error, 'The verification link could not be used. It may have expired.'));
      });

    return () => {
      active = false;
    };
  }, [token]);

  const title =
    status === 'success'
      ? 'Email verified'
      : status === 'error'
        ? 'Verification problem'
        : 'Verifying your email';

  return (
    <AuthShell
      eyebrow="Email verification"
      title={title}
      intro={
        status === 'loading'
          ? 'One moment while we confirm the link from your inbox.'
          : 'Verification connects this account to a working email address.'
      }
      asideTitle="Verified accounts keep history recoverable"
      asideText="A verified email lets password recovery work and keeps your saved briefings attached to you."
    >
      {status === 'loading' ? (
        <div className="auth-status" role="status" aria-live="polite">
          <Spinner label="Verifying your email" />
          <p>Verifying the link…</p>
        </div>
      ) : null}

      {status === 'success' ? (
        <Alert variant="success" title="Address confirmed">
          <p>{message}</p>
          {verifiedUser && verifiedUser.displayName ? (
            <p>Welcome, {verifiedUser.displayName}.</p>
          ) : null}
        </Alert>
      ) : null}

      {status === 'error' ? (
        <Alert variant="error" title="Link not accepted">
          <p>{message}</p>
        </Alert>
      ) : null}

      <div className="auth-success-actions">
        <Link className="btn btn--primary" to="/login">
          Go to sign in
        </Link>
        {status === 'error' ? (
          <Link className="btn btn--outline" to="/register">
            Create an account
          </Link>
        ) : (
          <Link className="btn btn--outline" to="/">
            Back to the builder
          </Link>
        )}
      </div>

      <p className="auth-note">
        Need a new verification email? Sign in with your address and use the resend option if the
        account still needs verification.
      </p>
    </AuthShell>
  );
}

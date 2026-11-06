import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, safeNextPath, toFieldErrors } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { TextField } from '../components/Field';

export default function Login() {
  useDocumentTitle('Sign in');
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/');
  const notice = location.state && location.state.notice;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      navigate(next, { replace: true });
    }
  }, [authLoading, user, next, navigate]);

  function clearError(field) {
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const nextErrors = { ...previous };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleResend() {
    if (!email.trim()) {
      setErrors((previous) => ({ ...previous, email: 'Enter your email address first.' }));
      return;
    }
    setResending(true);
    setResendMessage('');
    setResendError('');
    try {
      await authApi.resendVerification(email.trim());
      setResendMessage('If that account needs verification, a fresh link is on its way.');
    } catch (error) {
      setResendError(errorMessage(error, 'Could not resend the verification email.'));
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    setFormError(null);
    setResendMessage('');
    setResendError('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(error);
      const fieldErrors = toFieldErrors(error && error.details);
      if (Object.keys(fieldErrors).length) {
        setErrors((previous) => ({ ...previous, ...fieldErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const needsVerification = Boolean(formError && formError.code === 'EMAIL_NOT_VERIFIED');

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      intro="Sign in to run a comparison and keep its briefing in your history."
    >
      {notice ? (
        <Alert variant="info" title="One quick step">
          <p>{notice}</p>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="error" title="Sign in failed">
          <p>{errorMessage(formError)}</p>
          {needsVerification && email.trim() ? (
            <div className="alert__action">
              <Button variant="outline" loading={resending} onClick={handleResend}>
                Resend verification email
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {resendMessage ? (
        <Alert variant="success" title="Verification email">
          <p>{resendMessage}</p>
        </Alert>
      ) : null}

      {resendError ? (
        <Alert variant="error" title="Could not resend">
          <p>{resendError}</p>
        </Alert>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearError('email');
          }}
          error={errors.email}
          required
        />
        <TextField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearError('password');
          }}
          error={errors.password}
          required
        />

        <div className="auth-form__row">
          <Link className="text-link" to="/forgot-password">
            Forgot your password?
          </Link>
        </div>

        <Button
          type="submit"
          className="btn--block"
          loading={submitting}
          loadingLabel="Signing in…"
        >
          Sign in
        </Button>
      </form>

      <p className="auth-switch">
        New to Record Over Rhetoric? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}

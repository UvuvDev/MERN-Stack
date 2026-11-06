import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { errorMessage, toFieldErrors } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { TextField } from '../components/Field';

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter the email address for your account.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
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

  if (sent) {
    return (
      <AuthShell
        eyebrow="Password recovery"
        title="Check your inbox"
        intro="We keep this response generic on purpose, so it never reveals whether an account exists."
        asideTitle="Reset links expire"
        asideText="A password reset link is valid for one hour. Request another if it expires before you use it."
      >
        <Alert variant="success" title="Request received">
          <p>
            If an account exists for {email.trim()}, a password reset link is on its way. The link
            expires in one hour.
          </p>
        </Alert>

        <div className="auth-success-actions">
          <Link className="btn btn--primary" to="/login">
            Back to sign in
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setSent(false);
              setFormError(null);
            }}
          >
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Reset your password"
      intro="Enter your account email and we will send a reset link if an account exists."
      asideTitle="A generic response, by design"
      asideText="Password recovery should not confirm which email addresses have accounts. The message is the same either way."
    >
      {formError ? (
        <Alert variant="error" title="Request not sent">
          <p>{errorMessage(formError)}</p>
        </Alert>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="forgot-email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors({});
          }}
          error={errors.email}
          hint="Use the address you registered with."
          required
        />

        <Button
          type="submit"
          className="btn--block"
          loading={submitting}
          loadingLabel="Sending reset link…"
        >
          Send reset link
        </Button>
      </form>

      <p className="auth-switch">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
      <p className="auth-note">
        No account yet? <Link to="/register">Create one</Link>.
      </p>
    </AuthShell>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, toFieldErrors } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { TextField } from '../components/Field';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_HINT = 'At least 8 characters, including one letter and one number.';

export default function Register() {
  useDocumentTitle('Create an account');
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [createdMessage, setCreatedMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  function clearError(field) {
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const nextErrors = { ...previous };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (displayName.trim().length < 2) {
      nextErrors.displayName = 'Enter a display name of at least 2 characters.';
    }
    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.';
    }
    if (!password) {
      nextErrors.password = 'Choose a password.';
    } else if (!PASSWORD_RULE.test(password)) {
      nextErrors.password = PASSWORD_HINT;
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const data = await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      setCreatedEmail(email.trim());
      setCreatedMessage(
        (data && data.message) ||
          'Your account was created. Verify your email address to sign in.'
      );
      setCreated(true);
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

  async function handleResend() {
    setResending(true);
    setResendMessage('');
    setResendError('');
    try {
      await authApi.resendVerification(createdEmail);
      setResendMessage('A fresh verification email is on its way. Check your inbox and spam folder.');
    } catch (error) {
      setResendError(errorMessage(error, 'Could not resend the verification email.'));
    } finally {
      setResending(false);
    }
  }

  if (created) {
    return (
      <AuthShell
        eyebrow="One more step"
        title="Check your email"
        intro={`We sent a verification link to ${createdEmail}. Open it to activate your account, then sign in.`}
        asideTitle="Why verify an email?"
        asideText="Verification keeps saved comparisons tied to a real inbox and lets password recovery work."
      >
        <Alert variant="success" title="Account created">
          <p>{createdMessage}</p>
        </Alert>

        {resendMessage ? (
          <Alert variant="info" title="Verification email">
            <p>{resendMessage}</p>
          </Alert>
        ) : null}

        {resendError ? (
          <Alert variant="error" title="Could not resend">
            <p>{resendError}</p>
          </Alert>
        ) : null}

        <div className="auth-success-actions">
          <Button
            variant="outline"
            loading={resending}
            loadingLabel="Resending…"
            onClick={handleResend}
          >
            Resend verification email
          </Button>
          <Link className="btn btn--primary" to="/login">
            Go to sign in
          </Link>
        </div>

        <p className="auth-note">
          Wrong address?{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setCreated(false);
              setResendMessage('');
              setResendError('');
            }}
          >
            Edit the form
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Create an account"
      title="Start with the record"
      intro="A verified account lets you run comparisons and keep a private history of briefings."
    >
      {formError ? (
        <Alert variant="error" title="Account not created">
          <p>{errorMessage(formError)}</p>
        </Alert>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="register-name"
          label="Full name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            clearError('displayName');
          }}
          error={errors.displayName}
          hint="This is how your account is greeted. It is not sent to any AI model."
          required
        />
        <TextField
          id="register-email"
          label="Email address (your login)"
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
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearError('password');
          }}
          error={errors.password}
          hint={PASSWORD_HINT}
          required
        />

        <Button
          type="submit"
          className="btn--block"
          loading={submitting}
          loadingLabel="Creating account…"
        >
          Create account
        </Button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

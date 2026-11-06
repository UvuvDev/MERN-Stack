import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { errorMessage, toFieldErrors } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { TextField } from '../components/Field';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_HINT = 'At least 8 characters, including one letter and one number.';

export default function ResetPassword() {
  useDocumentTitle('Reset password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!password) {
      nextErrors.password = 'Choose a new password.';
    } else if (!PASSWORD_RULE.test(password)) {
      nextErrors.password = PASSWORD_HINT;
    }
    if (password && confirm !== password) {
      nextErrors.confirm = 'The two passwords do not match.';
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
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

  if (!token) {
    return (
      <AuthShell
        eyebrow="Password recovery"
        title="Reset link incomplete"
        intro="This page needs the token from the password reset email."
        asideTitle="Links expire after one hour"
        asideText="For your safety, reset links are single-use and short-lived."
      >
        <Alert variant="error" title="No reset token">
          <p>Request a fresh password reset email and use the link inside it.</p>
        </Alert>
        <div className="auth-success-actions">
          <Link className="btn btn--primary" to="/forgot-password">
            Request a new link
          </Link>
          <Link className="btn btn--outline" to="/login">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="Password recovery"
        title="Password updated"
        intro="Your new password is active. Sign in to continue to the comparison builder."
        asideTitle="Use a unique password"
        asideText="A password manager can generate and remember a strong, unique password for each account."
      >
        <Alert variant="success" title="Reset complete">
          <p>Your password was changed successfully.</p>
        </Alert>
        <div className="auth-success-actions">
          <Link className="btn btn--primary" to="/login">
            Sign in with the new password
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Choose a new password"
      intro="Pick something new. The reset link becomes invalid once it is used."
      asideTitle="Password rules"
      asideText="Passwords need at least 8 characters, including one letter and one number."
    >
      {formError ? (
        <Alert variant="error" title="Password not updated">
          <p>{errorMessage(formError)}</p>
        </Alert>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((previous) => ({ ...previous, password: undefined }));
          }}
          error={errors.password}
          hint={PASSWORD_HINT}
          required
        />
        <TextField
          id="reset-confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setErrors((previous) => ({ ...previous, confirm: undefined }));
          }}
          error={errors.confirm}
          required
        />

        <Button
          type="submit"
          className="btn--block"
          loading={submitting}
          loadingLabel="Updating password…"
        >
          Update password
        </Button>
      </form>

      <p className="auth-switch">
        Need a new link? <Link to="/forgot-password">Request another reset email</Link>.
      </p>
    </AuthShell>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui/Empty';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;
  if (user)
    return <Navigate to={from?.startsWith('/app') ? from : '/app'} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sign in right now.'
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Pick up where the last window left off."
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="link">
            Create one — it's free
          </Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error" role="alert">
            <Icon name="info" size={14} />
            {error}
          </div>
        )}
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </label>
        <button
          className="btn btn-primary btn-lg btn-block"
          type="submit"
          disabled={submitting}
        >
          {submitting && <Spinner />}
          {submitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui/Empty';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../lib/auth';

export default function Register() {
  const { user, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your account right now.'
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free plan, no card. Both pairs, every window, the weekly outlook."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="link">
            Sign in
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
          <span>Name</span>
          <input
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoFocus
          />
        </label>
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
          />
        </label>
        <label className="field">
          <span>Password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="8+ characters"
            showStrength
          />
        </label>
        <button
          className="btn btn-primary btn-lg btn-block"
          type="submit"
          disabled={submitting}
        >
          {submitting && <Spinner />}
          {submitting ? 'Creating account' : 'Create account'}
        </button>
        <p className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>
          FXSignal is for research and education. Signals are not financial
          advice and nothing here places trades.
        </p>
      </form>
    </AuthLayout>
  );
}

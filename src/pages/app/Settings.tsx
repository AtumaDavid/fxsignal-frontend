import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui/Empty';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { AlertSettings } from '../../components/AlertSettings';
import { authApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayDate, tzLabel } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';

type Notice = { tone: 'success' | 'error'; text: string } | null;

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await updateProfile(name.trim());
      setNotice({ tone: 'success', text: 'Profile saved.' });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      {notice && (
        <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
      )}
      <label className="field">
        <span>Name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={80}
          required
          autoComplete="name"
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" value={user?.email ?? ''} disabled />
        <small>
          Member since {user ? dayDate(user.createdAt, 'local') : '—'}
        </small>
      </label>
      <div className="actions">
        <button
          className="btn btn-primary"
          disabled={
            saving || name.trim().length < 2 || name.trim() === user?.name
          }
        >
          {saving && <Spinner />} Save changes
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      setNotice({ tone: 'error', text: 'The new passwords do not match.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await authApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setNotice({ tone: 'success', text: 'Password updated.' });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not update password.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      {notice && (
        <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
      )}
      <label className="field">
        <span>Current password</span>
        <PasswordInput
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span>New password</span>
        <PasswordInput
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          showStrength
        />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
      </label>
      <div className="actions">
        <button
          className="btn btn-secondary"
          disabled={saving || !current || next.length < 8}
        >
          {saving && <Spinner />} Update password
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  const location = useLocation();
  // Deep links such as /app/settings#alerts (from the bell). Runs after the
  // shell's scroll-to-top on navigation.
  useEffect(() => {
    if (!location.hash) return;
    const id = setTimeout(
      () =>
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: 'smooth' }),
      50
    );
    return () => clearTimeout(id);
  }, [location.hash]);

  const { logout } = useAuth();
  const { timeZone, setTimeZone } = usePrefs();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your profile, sign-in and how times are shown.</p>
        </div>
      </div>

      <div>
        <section className="settings-section">
          <div>
            <h2>Profile</h2>
            <p>How you appear in the app.</p>
          </div>
          <ProfileForm />
        </section>

        <section className="settings-section" id="alerts">
          <div>
            <h2>Alerts</h2>
            <p>
              Get told when a signal is published, triggers, hits its target or
              stop, or is cancelled or exited early, and when your own journal
              trade closes.
            </p>
          </div>
          <AlertSettings />
        </section>

        <section className="settings-section">
          <div>
            <h2>Display</h2>
            <p>
              Stored in this browser. Sessions and windows are always scheduled
              in UTC.
            </p>
          </div>
          <div className="settings-form">
            <div className="field">
              <span>Show times in</span>
              <div className="segmented" style={{ width: 'fit-content' }}>
                <button
                  aria-pressed={timeZone === 'local'}
                  onClick={() => setTimeZone('local')}
                >
                  Local ({tzLabel('local')})
                </button>
                <button
                  aria-pressed={timeZone === 'utc'}
                  onClick={() => setTimeZone('utc')}
                >
                  UTC
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div>
            <h2>Password</h2>
            <p>At least 8 characters. You stay signed in on this device.</p>
          </div>
          <PasswordForm />
        </section>

        <section className="settings-section">
          <div>
            <h2>Session</h2>
            <p>Sign out of FXSignal on this device.</p>
          </div>
          <div>
            <button className="btn btn-danger" onClick={() => void logout()}>
              <Icon name="logout" size={14} /> Sign out
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { notificationsApi } from '../lib/api';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupported,
} from '../lib/push';
import type {
  AlertGroup,
  AlertPrefs,
  AlertSettings as Settings,
} from '../lib/types';

const EVENTS: { key: AlertGroup; label: string; hint: string }[] = [
  {
    key: 'newSignal',
    label: 'New signals',
    hint: 'A new trade is published for a session window.',
  },
  {
    key: 'entry',
    label: 'Entry triggered',
    hint: 'Price trades into a signal’s entry zone.',
  },
  {
    key: 'result',
    label: 'Target or stop hit',
    hint: 'As soon as it shows on a closed 15-minute candle.',
  },
  {
    key: 'checkpoint',
    label: 'Cancelled / exit suggested',
    hint: 'The H1 checkpoint cancels a setup or suggests an early exit.',
  },
  {
    key: 'myTrades',
    label: 'My journal trades',
    hint: 'Your logged trade reaches your own stop or target.',
  },
];

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function AlertSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    notificationsApi
      .settings()
      .then(setSettings)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Alerts are unavailable.')
      );
    currentSubscription()
      .then((sub) => setPushOn(Boolean(sub)))
      .catch(() => undefined);
  }, []);

  async function save(prefs: AlertPrefs) {
    setSettings((s) => (s ? { ...s, prefs } : s));
    try {
      await notificationsApi.saveSettings(prefs);
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save.',
      });
    }
  }

  async function togglePush(next: boolean) {
    if (!settings?.vapidPublicKey && next) return;
    setBusy('push');
    setNotice(null);
    try {
      if (next) await enablePush(settings!.vapidPublicKey!);
      else await disablePush();
      setPushOn(next);
      setNotice({
        tone: 'success',
        text: next
          ? 'Push notifications are on for this browser.'
          : 'Push turned off for this browser.',
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not change push.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    setNotice(null);
    try {
      await notificationsApi.test();
      setNotice({
        tone: 'success',
        text: 'Test alert sent. Check the bell, your inbox and this device.',
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not send.',
      });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!settings) return <div className="skeleton" style={{ height: 160 }} />;
  const { prefs } = settings;

  return (
    <div className="settings-form" style={{ maxWidth: 520 }}>
      {notice && (
        <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
      )}

      <div className="pref-list">
        <div className="pref-row">
          <div>
            <strong>In-app bell</strong>
            <span>Always on — every alert is kept in the bell at the top.</span>
          </div>
          <span className="tag">On</span>
        </div>
        <div className="pref-row">
          <div>
            <strong>Email</strong>
            <span>
              {settings.emailAvailable
                ? `Sent to ${settings.email}.`
                : 'Not set up on the server yet (SMTP settings in the API .env).'}
            </span>
          </div>
          <Switch
            label="Email alerts"
            checked={settings.emailAvailable && prefs.channels.email}
            disabled={!settings.emailAvailable}
            onChange={(email) =>
              void save({ ...prefs, channels: { ...prefs.channels, email } })
            }
          />
        </div>
        <div className="pref-row">
          <div>
            <strong>Push on this device</strong>
            <span>
              {!settings.pushAvailable
                ? 'Not set up on the server yet (VAPID keys in the API .env).'
                : !pushSupported()
                  ? 'This browser does not support push. On iPhone, add FXSignal to the Home Screen first.'
                  : 'Shows alerts even when FXSignal is closed. Turn it on per device.'}
            </span>
          </div>
          {busy === 'push' ? (
            <Spinner />
          ) : (
            <Switch
              label="Push notifications"
              checked={pushOn && prefs.channels.push}
              disabled={!settings.pushAvailable || !pushSupported()}
              onChange={(next) => {
                void togglePush(next);
                if (next && !prefs.channels.push)
                  void save({
                    ...prefs,
                    channels: { ...prefs.channels, push: true },
                  });
              }}
            />
          )}
        </div>
      </div>

      <span className="label" style={{ marginTop: 6 }}>
        Alert me about
      </span>
      <div className="pref-list">
        {EVENTS.map((event) => (
          <div className="pref-row" key={event.key}>
            <div>
              <strong>{event.label}</strong>
              <span>{event.hint}</span>
            </div>
            <Switch
              label={event.label}
              checked={prefs.events[event.key]}
              onChange={(on) =>
                void save({
                  ...prefs,
                  events: { ...prefs.events, [event.key]: on },
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          className="btn btn-secondary"
          onClick={() => void test()}
          disabled={busy !== null}
        >
          {busy === 'test' ? <Spinner /> : <Icon name="bell" size={14} />} Send
          a test alert
        </button>
      </div>
    </div>
  );
}

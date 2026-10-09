import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { notificationsApi } from '../lib/api';
import { currentSubscription, enablePush, pushBlocker } from '../lib/push';

const KEY = 'fxsignal_alerts_banner_snoozed_until';
/** "Not now" hides it for a week, then it asks again. */
const SNOOZE_MS = 7 * 24 * 3_600_000;

function snoozed() {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Asks for push alerts on this device, once, from the Overview. Alerts are
 * the core of the product and most people never open Settings → Alerts.
 * The browser permission is only requested when the button is pressed.
 */
export function AlertsBanner() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (snoozed()) return;
    let cancelled = false;
    void (async () => {
      const [settings, sub] = await Promise.all([
        notificationsApi.settings().catch(() => null),
        currentSubscription().catch(() => null),
      ]);
      if (cancelled || !settings?.pushAvailable || sub) return;
      setVapidKey(settings.vapidPublicKey);
      setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const snooze = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // Hidden for this visit only.
    }
    setShow(false);
  };

  async function turnOn() {
    const blocker = pushBlocker();
    // iPhone (not installed), in-app browsers, blocked permission: the
    // settings page explains the exact steps for this device.
    if (blocker || !vapidKey) {
      navigate('/app/settings#alerts');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await enablePush(vapidKey);
      const { prefs } = await notificationsApi.settings();
      if (!prefs.channels.push)
        await notificationsApi.saveSettings({
          ...prefs,
          channels: { ...prefs.channels, push: true },
        });
      setDone(true);
      setTimeout(() => setShow(false), 4_000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not turn on alerts.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="alerts-banner" aria-label="Turn on alerts">
      <span className="alerts-banner-icon">
        <Icon name="bell" size={16} />
      </span>
      <div className="alerts-banner-copy">
        {done ? (
          <>
            <strong>Alerts are on for this device</strong>
            <span>
              You'll be notified for new signals, each take-profit, stop moves
              and exits. Fine-tune them in Settings → Alerts.
            </span>
          </>
        ) : (
          <>
            <strong>Don't miss the next move</strong>
            <span>
              Get notified the moment a signal is published, a take-profit is
              hit, or the system says to move your stop or exit — even when
              FXSignal is closed.
            </span>
            {error && <span className="alerts-banner-error">{error}</span>}
          </>
        )}
      </div>
      {!done && (
        <div className="alerts-banner-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void turnOn()}
            disabled={busy}
          >
            {busy ? <Spinner /> : 'Turn on alerts'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={snooze}
          >
            Not now
          </button>
        </div>
      )}
    </section>
  );
}

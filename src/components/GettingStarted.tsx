import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { currentSubscription } from '../lib/push';

const KEY = 'fxsignal_getting_started_done';

function dismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** First-visit guide: how to use a signal in three steps. Dismissible. */
export function GettingStarted() {
  const [hidden, setHidden] = useState(dismissed);
  const [alertsOn, setAlertsOn] = useState(false);

  useEffect(() => {
    if (hidden) return;
    currentSubscription()
      .then((sub) => setAlertsOn(Boolean(sub)))
      .catch(() => undefined);
  }, [hidden]);

  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true);
  };

  return (
    <section className="panel getting-started" aria-label="How to use FXSignal">
      <div className="panel-head">
        <div>
          <h2>How to use a signal</h2>
          <p>
            Three steps. You can reopen the full method any time under
            Methodology.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={close}>
          Got it
        </button>
      </div>
      <ol className="gs-steps">
        <li>
          <span className="gs-n">1</span>
          <div>
            <strong>Read the "Next step"</strong>
            <p>
              Every signal card says what to do now: wait for the entry, hold,
              take profit, or skip.
            </p>
          </div>
        </li>
        <li>
          <span className="gs-n">2</span>
          <div>
            <strong>Open the plan, then log your trade</strong>
            <p>
              The plan sizes the position for your account. "Log trade" saves it
              to your journal, and the exit is filled in automatically when your
              stop or target is hit.
            </p>
          </div>
        </li>
        <li>
          <span className="gs-n">3</span>
          <div>
            <strong>Turn on alerts</strong>
            <p>
              Get told when an entry triggers, a target or stop is hit, or an
              exit is suggested.
            </p>
            {alertsOn ? (
              <span className="tag tag-up">
                <Icon name="check" size={11} /> Alerts on for this device
              </span>
            ) : (
              <Link
                to="/app/settings#alerts"
                className="btn btn-primary btn-sm"
              >
                <Icon name="bell" size={13} /> Turn on alerts
              </Link>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}

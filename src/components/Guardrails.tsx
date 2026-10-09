import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Switch } from './AlertSettings';
import { money, readSizerPrefs, type Currency } from './PositionSizer';
import { Select } from './ui/Select';
import { Spinner } from './ui/Empty';
import { useDashboard } from '../lib/dashboard';
import {
  todayRisk,
  useRiskPrefs,
  type RiskPrefs,
  type TodayRisk,
} from '../lib/guardrails';
import { useJournal } from '../lib/journal';
import { usePrefs } from '../lib/prefs';

/** Today's guardrail status, or null when guardrails are off. */
export function useTodayRisk(): {
  risk: TodayRisk | null;
  prefs: RiskPrefs | null;
} {
  const { prefs } = useRiskPrefs();
  const { data: journal } = useJournal();
  const { data } = useDashboard();
  const { timeZone } = usePrefs();
  if (!prefs || !journal) return { risk: null, prefs };
  const priceOf = (pair: string) =>
    data?.prices.find((p) => p.pairCode === pair)?.price ?? null;
  return {
    risk: todayRisk(journal.trades, prefs, priceOf, timeZone),
    prefs,
  };
}

/**
 * Shown on Overview and Signals when a guardrail is reached (or close).
 * It only warns; trading decisions stay with the user.
 */
export function GuardrailBanner() {
  const { risk, prefs } = useTodayRisk();
  if (!risk || !prefs) return null;
  const pct = risk.lossPct.toFixed(1);
  let tone: 'stop' | 'warn' | null = null;
  let title = '';
  let body = '';
  if (risk.lossLimitHit) {
    tone = 'stop';
    title = `You've lost ${pct}% today — your daily limit is ${prefs.dailyLossPct}%`;
    body =
      'Consider stopping for today. The next session will still be there tomorrow.';
  } else if (risk.tradeLimitHit) {
    tone = 'warn';
    title = `You've taken ${risk.tradesToday} trade${risk.tradesToday === 1 ? '' : 's'} today — your limit is ${prefs.maxTradesPerDay}`;
    body = 'Consider waiting for tomorrow instead of adding another one.';
  } else if (risk.lossNear) {
    tone = 'warn';
    title = `You're down ${pct}% today, close to your ${prefs.dailyLossPct}% limit`;
    body = 'Consider sizing down or stopping early.';
  }
  if (!tone) return null;
  return (
    <section className={`guardrail-banner ${tone}`} role="alert">
      <Icon name="shield" size={16} />
      <div>
        <strong>{title}</strong>
        <span>
          {body}
          {risk.estimated &&
            ' (Some trades have no lot size, so their result is estimated from your risk per trade.)'}
        </span>
      </div>
      <Link to="/app/settings#risk" className="btn btn-ghost btn-sm">
        Guardrails
      </Link>
    </section>
  );
}

const HINT_KEY = 'fxsignal_guardrail_hint_hidden';

/** Lets people know guardrails exist while they are off. Dismissible. */
export function GuardrailHint() {
  const { prefs } = useRiskPrefs();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden || !prefs || prefs.enabled) return null;
  const hide = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true);
  };
  return (
    <div className="guardrail-hint">
      <Icon name="shield" size={15} />
      <span>
        <strong>Risk guardrails</strong> — get a warning when you hit a daily
        loss limit or a maximum number of trades per day. Off until you turn
        them on.
      </span>
      <Link to="/app/settings#risk" className="btn btn-secondary btn-sm">
        Set up
      </Link>
      <button
        type="button"
        className="icon-btn"
        aria-label="Hide"
        onClick={hide}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'JPY', label: 'JPY' },
];

/** Settings → Risk guardrails. */
export function GuardrailSettings() {
  const { prefs, save } = useRiskPrefs();
  const { risk } = useTodayRisk();
  const [form, setForm] = useState<{
    enabled: boolean;
    dailyLossPct: string;
    maxTradesPerDay: string;
    balance: string;
    currency: Currency;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!prefs || form) return;
    const sizer = readSizerPrefs();
    setForm({
      enabled: prefs.enabled,
      dailyLossPct: prefs.dailyLossPct?.toString() ?? '',
      maxTradesPerDay: prefs.maxTradesPerDay?.toString() ?? '',
      // Start from the position size calculator's balance.
      balance: prefs.balance?.toString() ?? sizer.balance,
      currency: prefs.balance ? prefs.currency : sizer.currency,
    });
  }, [prefs, form]);

  if (!form) return <div className="skeleton" style={{ height: 160 }} />;

  const num = (value: string) => (value.trim() === '' ? null : Number(value));

  async function persist(next: typeof form) {
    if (!next) return;
    const values: RiskPrefs = {
      enabled: next.enabled,
      dailyLossPct: num(next.dailyLossPct),
      maxTradesPerDay: num(next.maxTradesPerDay),
      balance: num(next.balance),
      currency: next.currency,
    };
    if (
      [values.dailyLossPct, values.maxTradesPerDay, values.balance].some(
        (v) => v !== null && (!Number.isFinite(v) || v <= 0)
      )
    ) {
      setNotice({ tone: 'error', text: 'Use positive numbers.' });
      return;
    }
    if (values.maxTradesPerDay !== null)
      values.maxTradesPerDay = Math.round(values.maxTradesPerDay);
    setSaving(true);
    setNotice(null);
    try {
      await save(values);
      setNotice({
        tone: 'success',
        text: values.enabled ? 'Guardrails are on.' : 'Guardrails are off.',
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save.',
      });
    } finally {
      setSaving(false);
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void persist(form);
  };

  return (
    <form className="settings-form" style={{ maxWidth: 520 }} onSubmit={submit}>
      {notice && (
        <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
      )}
      <div className="pref-list">
        <div className="pref-row">
          <div>
            <strong>Guardrails</strong>
            <span>
              {form.enabled
                ? 'On. You are warned on Overview, Signals and when you log a trade.'
                : 'Off. Turn on to be warned when you reach your limits.'}
            </span>
          </div>
          <Switch
            label="Risk guardrails"
            checked={form.enabled}
            onChange={(enabled) => {
              const next = { ...form, enabled };
              setForm(next);
              void persist(next);
            }}
          />
        </div>
      </div>

      <div className="guardrail-fields">
        <label className="field">
          <span>Daily loss limit (% of account)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.dailyLossPct}
            onChange={(e) => setForm({ ...form, dailyLossPct: e.target.value })}
            placeholder="3"
          />
        </label>
        <label className="field">
          <span>Max trades per day</span>
          <input
            className="input"
            inputMode="numeric"
            value={form.maxTradesPerDay}
            onChange={(e) =>
              setForm({ ...form, maxTradesPerDay: e.target.value })
            }
            placeholder="3"
          />
        </label>
        <label className="field">
          <span>Account balance</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Currency</span>
          <Select
            label="Account currency"
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
            options={CURRENCIES}
            active={false}
            size="md"
          />
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12.5 }}>
        Counted from your journal, in your display time zone: trades logged
        today, and the result of trades closed today. It only warns — it never
        blocks a trade.
        {risk &&
          ` Today: ${risk.tradesToday} trade${risk.tradesToday === 1 ? '' : 's'}, ${risk.pnl >= 0 ? '+' : '−'}${money(Math.abs(risk.pnl), form.currency)}.`}
      </p>
      <div className="actions">
        <button className="btn btn-secondary" disabled={saving}>
          {saving && <Spinner />} Save limits
        </button>
      </div>
    </form>
  );
}

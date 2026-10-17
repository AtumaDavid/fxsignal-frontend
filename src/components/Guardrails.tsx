import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Switch } from './AlertSettings';
import { money, readSizerPrefs, type Currency } from './PositionSizer';
import { Select } from './ui/Select';
import { Spinner } from './ui/Empty';
import { useDashboard } from '../lib/dashboard';
import {
  accountRisk,
  useRiskPrefs,
  type AccountRisk,
  type RiskPrefs,
} from '../lib/guardrails';
import { useJournal } from '../lib/journal';
import { usePrefs } from '../lib/prefs';

/** Guardrail status (today, week, exposure, drawdown), or null when off. */
export function useTodayRisk(): {
  risk: AccountRisk | null;
  prefs: RiskPrefs | null;
} {
  const { prefs, mt5 } = useRiskPrefs();
  const { data: journal } = useJournal();
  const { data } = useDashboard();
  const { timeZone } = usePrefs();
  if (!prefs || !journal) return { risk: null, prefs };
  const priceOf = (pair: string) =>
    data?.prices.find((p) => p.pairCode === pair)?.price ?? null;
  return {
    risk: accountRisk(journal.trades, prefs, priceOf, timeZone, mt5),
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
  const heavy = risk.exposure.filter((e) => e.overLimit);
  if (risk.drawdownHit || risk.weekLimitHit) {
    tone = 'stop';
    title = `Trading paused: ${risk.pauseReason}`;
    body = risk.drawdownHit
      ? `Consider stopping until you have reviewed the losing trades.${risk.drawdownSource === 'mt5' ? ' New-signal alerts are paused while your MT5 equity is past the limit.' : ''}`
      : 'Consider stopping until next week. The setups will still be there.';
  } else if (risk.lossLimitHit) {
    tone = 'stop';
    title = `You've lost ${pct}% today — your daily limit is ${prefs.dailyLossPct}%`;
    body =
      'Consider stopping for today. The next session will still be there tomorrow.';
  } else if (heavy.length > 0) {
    tone = 'warn';
    title = `${heavy.map((e) => `${e.currency} ${e.netLots > 0 ? '+' : ''}${e.netLots} lots`).join(', ')} — above your ${prefs.maxCurrencyLots}-lot limit`;
    body =
      'Your open trades stack the same currency. Consider closing or reducing one before adding more.';
  } else if (risk.openLimitHit) {
    tone = 'warn';
    title = `${risk.openPositions} open trades — your limit is ${prefs.maxOpenPositions}`;
    body = 'Consider managing what is open before adding another trade.';
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
    weeklyLossPct: string;
    maxOpenPositions: string;
    maxCurrencyLots: string;
    drawdownPausePct: string;
    maxRiskPerTradePct: string;
    commissionPerLot: string;
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
      weeklyLossPct: prefs.weeklyLossPct?.toString() ?? '',
      maxOpenPositions: prefs.maxOpenPositions?.toString() ?? '',
      maxCurrencyLots: prefs.maxCurrencyLots?.toString() ?? '',
      drawdownPausePct: prefs.drawdownPausePct?.toString() ?? '',
      maxRiskPerTradePct: prefs.maxRiskPerTradePct?.toString() ?? '',
      commissionPerLot: prefs.commissionPerLot?.toString() ?? '',
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
      weeklyLossPct: num(next.weeklyLossPct),
      maxOpenPositions: num(next.maxOpenPositions),
      maxCurrencyLots: num(next.maxCurrencyLots),
      drawdownPausePct: num(next.drawdownPausePct),
      maxRiskPerTradePct: num(next.maxRiskPerTradePct),
      commissionPerLot: num(next.commissionPerLot),
    };
    if (
      [
        values.dailyLossPct,
        values.maxTradesPerDay,
        values.balance,
        values.weeklyLossPct,
        values.maxOpenPositions,
        values.maxCurrencyLots,
        values.drawdownPausePct,
        values.maxRiskPerTradePct,
      ].some((v) => v != null && (!Number.isFinite(v) || v <= 0)) ||
      (values.commissionPerLot != null &&
        (!Number.isFinite(values.commissionPerLot) || values.commissionPerLot < 0))
    ) {
      setNotice({ tone: 'error', text: 'Use positive numbers.' });
      return;
    }
    if (values.maxTradesPerDay !== null)
      values.maxTradesPerDay = Math.round(values.maxTradesPerDay);
    if (values.maxOpenPositions != null)
      values.maxOpenPositions = Math.round(values.maxOpenPositions);
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
        {(
          [
            ['weeklyLossPct', 'Weekly loss limit (% of account)', '6', 'decimal'],
            ['drawdownPausePct', 'Pause after drawdown (% from peak)', '10', 'decimal'],
            ['maxRiskPerTradePct', 'Max risk per trade (%)', '2', 'decimal'],
            ['maxOpenPositions', 'Max open trades', '2', 'numeric'],
            ['maxCurrencyLots', 'Max net lots per currency (USD, EUR, JPY)', 'none', 'decimal'],
            ['commissionPerLot', `Commission per lot, round turn (${form.currency})`, 'none', 'decimal'],
          ] as const
        ).map(([key, label, placeholder, mode]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              className="input"
              inputMode={mode}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 12.5 }}>
        Counted from your journal, in your display time zone: trades logged
        today, results closed today and this week, open trades and their
        currency exposure. Drawdown uses your MT5 equity when the sync add-on
        runs, otherwise your journal's last 30 days. It only warns — it never
        blocks a trade — but past the drawdown limit with MT5 linked, new-signal
        alerts pause. Commission per lot is applied to hand-logged trades;
        MT5 trades use the broker's own.
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

/** Open trades by currency: net lots long (+) or short (−) USD, EUR and JPY. */
export function ExposurePanel() {
  const { risk, prefs } = useTodayRisk();
  if (!risk || !prefs) return null;
  return (
    <section className="panel exposure">
      <div className="panel-head">
        <div>
          <h2>Exposure</h2>
          <p>
            {risk.openPositions} open trade{risk.openPositions === 1 ? '' : 's'}
            {prefs.maxOpenPositions != null && ` · limit ${prefs.maxOpenPositions}`}
            {risk.drawdownPct !== null &&
              ` · drawdown ${risk.drawdownPct.toFixed(1)}% (${risk.drawdownSource === 'mt5' ? 'MT5 equity' : 'journal, 30 days'})`}
          </p>
        </div>
      </div>
      <div className="exposure-grid">
        {risk.exposure.map((e) => (
          <div key={e.currency} className={`exposure-cell ${e.overLimit ? 'over' : ''}`}>
            <span>{e.currency}</span>
            <strong className={e.netLots > 0 ? 'up' : e.netLots < 0 ? 'down' : ''}>
              {e.netLots > 0 ? '+' : e.netLots < 0 ? '−' : ''}
              {Math.abs(e.netLots).toFixed(2)} lots
            </strong>
            <em>
              {e.netLots === 0
                ? 'flat'
                : e.netLots > 0
                  ? 'long'
                  : 'short'}
              {e.positions > 0 && ` · ${e.positions} trade${e.positions === 1 ? '' : 's'}`}
            </em>
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 12, margin: '0 18px 14px' }}>
        Long EUR/USD is long EUR and short USD; long USD/JPY is long USD and
        short JPY. Two trades on the same side of USD are one bigger USD bet.
      </p>
    </section>
  );
}

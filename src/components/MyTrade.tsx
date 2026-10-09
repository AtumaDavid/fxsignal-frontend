import { useTodayRisk } from './Guardrails';
import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { price, signedPips } from '../lib/format';
import { useJournal } from '../lib/journal';
import { useDashboard } from '../lib/dashboard';
import { readSizerPrefs, sizeFor } from './PositionSizer';
import type { Prediction, UserTrade } from '../lib/types';

function toInput(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function parse(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Where the engine's own trade on this signal closed: target, stop, or the
 * mark-to-close price. Null while it is open or when it never filled.
 */
export function engineExit(
  p: Prediction
): { price: number; label: string } | null {
  const o = p.outcome;
  if (!o || o.resolvedPrice === null) return null;
  const mid = (p.entryLow + p.entryHigh) / 2;
  if (o.status === 'BREAKEVEN') return { price: mid, label: 'breakeven' };
  // Three targets book a third at each step: log the average exit.
  if (o.status === 'HIT' && p.target3Price && o.movementPips !== null) {
    const pip = p.pairCode === 'EUR/USD' ? 0.0001 : 0.01;
    const sign = p.direction === 'SHORT' ? -1 : 1;
    return { price: mid + sign * o.movementPips * pip, label: 'average exit' };
  }
  if (o.status === 'HIT') return { price: o.resolvedPrice, label: 'target' };
  if (o.status === 'MISSED') return { price: o.resolvedPrice, label: 'stop' };
  if (o.status === 'CLOSED_EARLY')
    return { price: o.resolvedPrice, label: 'suggested exit' };
  if (o.status === 'EXPIRED' && o.movementPips !== null)
    return { price: o.resolvedPrice, label: 'close' };
  return null;
}

function precision(p: Prediction) {
  return p.pairCode === 'EUR/USD' ? 5 : 3;
}

function TradeForm({
  prediction,
  trade,
  onDone,
}: {
  prediction: Prediction;
  trade: UserTrade | null;
  onDone: () => void;
}) {
  const { save } = useJournal();
  const { risk, prefs: riskPrefs } = useTodayRisk();
  const neutral = prediction.direction === 'NEUTRAL';
  const [side, setSide] = useState<'LONG' | 'SHORT' | ''>(
    trade?.side ?? (neutral ? '' : (prediction.direction as 'LONG' | 'SHORT'))
  );
  const { data } = useDashboard();
  // New entries start from what the signal published, so logging a trade
  // that followed the plan is one click: entry at the zone middle, exit at
  // the engine's result once it has one, size from the calculator settings.
  const planned = (() => {
    const mid = (prediction.entryLow + prediction.entryHigh) / 2;
    const size = sizeFor(
      prediction,
      readSizerPrefs(),
      (pair) => data?.prices.find((q) => q.pairCode === pair)?.price ?? null
    );
    return {
      entry: mid.toFixed(precision(prediction)),
      exit: engineExit(prediction)?.price.toFixed(precision(prediction)) ?? '',
      lots: size.lots && size.lots > 0 ? size.lots.toFixed(2) : '',
      stop: prediction.invalidationPrice.toFixed(precision(prediction)),
      target: prediction.targetPrice.toFixed(precision(prediction)),
    };
  })();
  const prefilled = !trade;
  const [entry, setEntry] = useState(
    trade ? toInput(trade.entryPrice) : planned.entry
  );
  const [exit, setExit] = useState(
    trade ? toInput(trade.exitPrice) : planned.exit
  );
  const [lots, setLots] = useState(trade ? toInput(trade.lots) : planned.lots);
  const [stop, setStop] = useState(
    trade ? toInput(trade.stopPrice) : planned.stop
  );
  const [target, setTarget] = useState(
    trade ? toInput(trade.targetPrice) : planned.target
  );
  const [notes, setNotes] = useState(trade?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const values = {
      entry: parse(entry),
      exit: parse(exit),
      lots: parse(lots),
      stop: parse(stop),
      target: parse(target),
    };
    if (Object.values(values).some((v) => Number.isNaN(v))) {
      setError('Prices and size must be numbers.');
      return;
    }
    if (!side) {
      setError('This was a neutral call — choose the side you took.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save(prediction.id, {
        side,
        entryPrice: values.entry,
        exitPrice: values.exit,
        lots: values.lots,
        stopPrice: values.stop,
        targetPrice: values.target,
        notes: notes.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the trade.'
      );
      setSaving(false);
    }
  }

  const mid = price(
    prediction.pairCode,
    (prediction.entryLow + prediction.entryHigh) / 2
  );

  return (
    <form className="trade-form" onSubmit={submit}>
      {prefilled && (
        <p className="faint" style={{ fontSize: 12.5 }}>
          Filled from the signal: entry at the middle of the zone
          {planned.exit
            ? `, exit at the engine's ${engineExit(prediction)?.label}`
            : ''}
          {planned.lots ? ', size from your calculator settings' : ''}. Change
          anything that differs from your actual fills.
        </p>
      )}
      {prefilled && risk && (risk.tradeLimitHit || risk.lossLimitHit) && (
        <div className="alert alert-warning">
          {risk.lossLimitHit
            ? `Guardrail: you've lost ${risk.lossPct.toFixed(1)}% today, past your ${riskPrefs?.dailyLossPct}% limit. Consider stopping for today.`
            : `Guardrail: this would be trade ${risk.tradesToday + 1} today; your limit is ${riskPrefs?.maxTradesPerDay}.`}
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <span>Side</span>
        <div className="segmented" style={{ width: 'fit-content' }}>
          {(['LONG', 'SHORT'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
            >
              {value === 'LONG' ? 'Long' : 'Short'}
            </button>
          ))}
        </div>
      </div>
      <div className="trade-grid">
        <label className="field">
          <span>Entry price</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder={mid}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Exit price</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="Still open"
            value={exit}
            onChange={(e) => setExit(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Lots</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0.50"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Your stop</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="None"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Your target</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="None"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <div className="field trade-auto-hint">
          <span>Auto exit</span>
          <small>
            With a stop or target set, the exit is filled in for you when price
            reaches it (checked on every 15-minute close).
          </small>
        </div>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea
          className="input textarea"
          rows={3}
          maxLength={2000}
          placeholder="Why you took it, how you managed it, what you'd do differently"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving}>
          {saving && <Spinner />} Save trade
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onDone}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "I took this trade": the user's own entry, exit, size and notes on a signal. */
export function MyTrade({
  prediction,
  autoOpen = false,
}: {
  prediction: Prediction;
  /** Start with the form open (the card's "Log trade" button). */
  autoOpen?: boolean;
}) {
  const { data, error, tradeFor, remove, save } = useJournal();
  const [editing, setEditing] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [closing, setClosing] = useState(false);
  const trade = tradeFor(prediction.id);
  const result = engineExit(prediction);
  // "Log trade": open the form once the journal has loaded, if not logged yet.
  if (autoOpen && !autoOpened && data && !trade && !prediction.continuesId) {
    setAutoOpened(true);
    setEditing(true);
  }

  if (error && !data)
    return (
      <p className="faint" style={{ fontSize: 12.5 }}>
        {error}
      </p>
    );
  if (editing) {
    return (
      <TradeForm
        prediction={prediction}
        trade={trade}
        onDone={() => setEditing(false)}
      />
    );
  }
  if (!trade && prediction.continuesId) {
    return (
      <p className="faint" style={{ fontSize: 12.5 }}>
        This window holds an earlier open trade. Log it on that original signal
        so it is only counted once.
      </p>
    );
  }
  if (!trade) {
    return (
      <div className="trade-empty">
        <p>Took this one? Log it to compare your results with the engine's.</p>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setEditing(true)}
          disabled={!data}
        >
          <Icon name="plus" size={13} /> I took this trade
        </button>
      </div>
    );
  }

  const pair = prediction.pairCode;
  return (
    <div className="trade-card">
      <div className="kv">
        <div>
          <span>Side</span>
          <strong>{trade.side === 'LONG' ? 'Long' : 'Short'}</strong>
        </div>
        <div>
          <span>Size</span>
          <strong>{trade.lots !== null ? `${trade.lots} lots` : '—'}</strong>
        </div>
        <div>
          <span>Entry → exit</span>
          <strong>
            {price(pair, trade.entryPrice)} →{' '}
            {trade.exitPrice !== null ? price(pair, trade.exitPrice) : 'open'}
          </strong>
        </div>
        <div>
          <span>Your result</span>
          <strong
            className={
              trade.pips === null
                ? ''
                : trade.pips > 0
                  ? 'up'
                  : trade.pips < 0
                    ? 'down'
                    : ''
            }
          >
            {trade.pips === null ? 'Open' : `${signedPips(trade.pips)}p`}
          </strong>
        </div>
        <div>
          <span>Your stop / target</span>
          <strong>
            {price(pair, trade.stopPrice)} / {price(pair, trade.targetPrice)}
          </strong>
        </div>
        <div>
          <span>Exit</span>
          <strong>
            {trade.exitPrice === null
              ? trade.stopPrice !== null || trade.targetPrice !== null
                ? 'Watching'
                : 'Open'
              : trade.exitReason === 'target'
                ? 'Target (auto)'
                : trade.exitReason === 'stop'
                  ? 'Stop (auto)'
                  : 'Manual'}
          </strong>
        </div>
      </div>
      {trade.notes && <p className="trade-notes">{trade.notes}</p>}
      {trade.exitPrice === null && result && (
        <div className="trade-empty">
          <p>
            The signal has closed at its {result.label} (
            {price(pair, result.price)}). Close your trade there too?
          </p>
          <button
            className="btn btn-secondary btn-sm"
            disabled={closing}
            onClick={async () => {
              setClosing(true);
              await save(prediction.id, {
                side: trade.side,
                entryPrice: trade.entryPrice,
                exitPrice: result.price,
                lots: trade.lots,
                notes: trade.notes,
              }).catch(() => undefined);
              setClosing(false);
            }}
          >
            {closing && <Spinner />} Close at {price(pair, result.price)}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={removing}
          onClick={async () => {
            if (!window.confirm('Remove this trade from your journal?')) return;
            setRemoving(true);
            await remove(prediction.id).catch(() => undefined);
            setRemoving(false);
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

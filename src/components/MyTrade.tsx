import { useTodayRisk } from './Guardrails';
import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { ConfirmModal } from './ui/ConfirmModal';
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
  // the engine's result once it has one, stop/target from the signal, size
  // from the calculator settings (0.01 lots when the calculator has no size).
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
      lots:
        size.lots && size.lots > 0 ? size.lots.toFixed(2) : '0.01',
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
          Filled from the signal: entry at the middle of the zone, stop and
          target from the plan
          {planned.exit
            ? `, exit at the engine's ${engineExit(prediction)?.label}`
            : ''}
          , size {planned.lots} lots by default. Change anything that differs
          from your actual fills.
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
          <small>
            <button
              type="button"
              className="link"
              onClick={() => entry.trim() && setExit(entry.trim())}
              data-tip="Scratch the trade at your entry: saved as a breakeven (0 pips), not a win or loss."
            >
              Exit at entry (breakeven)
            </button>
          </small>
        </label>
        <label className="field">
          <span>Lots</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0.01"
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
  const { data: dashboard } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState<{
    price: number;
    reason: 'manual' | 'breakeven';
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [confirmBEStop, setConfirmBEStop] = useState(false);
  const trade = tradeFor(prediction.id);
  const result = engineExit(prediction);
  // Best guess at "the price right now" for an early exit: live tick first,
  // then the dashboard price, then the entry.
  const livePrice =
    prediction.live?.lastPrice ??
    dashboard?.prices.find((q) => q.pairCode === prediction.pairCode)?.price ??
    trade?.entryPrice ??
    (prediction.entryLow + prediction.entryHigh) / 2;
  const [closePrice, setClosePrice] = useState<string | null>(null);

  async function closeAt(exitPrice: number, reason: 'manual' | 'breakeven') {
    if (!trade) return;
    setClosing(true);
    await save(prediction.id, {
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice,
      lots: trade.lots,
      stopPrice: trade.stopPrice,
      targetPrice: trade.targetPrice,
      notes: trade.notes,
      exitReason: reason,
    }).catch(() => undefined);
    setClosing(false);
    setConfirmClose(null);
  }
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
  const mid = (prediction.entryLow + prediction.entryHigh) / 2;
  // Your stop already sits at the entry: a return scratches at breakeven.
  const stopAtEntry =
    trade.entryPrice !== null &&
    trade.stopPrice !== null &&
    Math.abs(trade.stopPrice - trade.entryPrice) < trade.entryPrice * 1e-9;
  // The plan protects itself: TP1 booked (stop trails to entry) or the live
  // engine stop is already at the entry.
  const planStopAtEntry =
    prediction.live?.stopNow !== null &&
    prediction.live?.stopNow !== undefined &&
    Math.abs(prediction.live.stopNow - mid) < mid * 1e-9;
  const planProtects =
    (prediction.live?.tpHits ?? 0) >= 1 || planStopAtEntry;

  async function moveStopToEntry() {
    if (!trade || trade.entryPrice === null) return;
    setMoving(true);
    await save(prediction.id, {
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      lots: trade.lots,
      stopPrice: trade.entryPrice,
      targetPrice: trade.targetPrice,
      notes: trade.notes,
    }).catch(() => undefined);
    setMoving(false);
    setConfirmBEStop(false);
  }
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
            {trade.pips === null
              ? 'Open'
              : trade.exitReason === 'breakeven'
                ? 'Breakeven'
                : `${signedPips(trade.pips)}p`}
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
              ? stopAtEntry
                ? 'BE protected'
                : trade.stopPrice !== null || trade.targetPrice !== null
                  ? 'Watching'
                  : 'Open'
              : trade.exitReason === 'target'
                ? 'Target (auto)'
                : trade.exitReason === 'stop'
                  ? 'Stop (auto)'
                  : trade.exitReason === 'breakeven'
                    ? 'Breakeven'
                    : 'Manual'}
          </strong>
        </div>
      </div>
      {trade.notes && <p className="trade-notes">{trade.notes}</p>}
      {trade.exitPrice === null &&
        trade.entryPrice !== null &&
        planProtects &&
        !stopAtEntry && (
          <div className="trade-empty">
            <p>
              TP1 booked — the plan moves the stop to your entry (
              {price(pair, trade.entryPrice)}). Move yours too with one tap;
              if price comes back you scratch automatically at breakeven.
            </p>
            <button
              className="btn btn-secondary btn-sm"
              disabled={moving}
              onClick={() => setConfirmBEStop(true)}
            >
              {moving && <Spinner />} Move stop to breakeven
            </button>
          </div>
        )}
      {trade.exitPrice === null && result && (
        <div className="trade-empty">
          <p>
            The signal has closed at its {result.label} (
            {price(pair, result.price)}). Close your trade there too?
          </p>
          <button
            className="btn btn-secondary btn-sm"
            disabled={closing}
            onClick={() =>
              setConfirmClose({ price: result.price, reason: 'manual' })
            }
          >
            {closing && <Spinner />} Close at {price(pair, result.price)}
          </button>
        </div>
      )}
      {trade.exitPrice === null && (
        <div className="trade-close">
          <div className="trade-close-head">
            <span>
              {trade.stopPrice !== null || trade.targetPrice !== null
                ? 'Stop / target watched'
                : 'Open trade'}
            </span>
            <span className="tag">
              {trade.exitReason === null ? 'open' : trade.exitReason}
            </span>
          </div>
          <p>
            {stopAtEntry
              ? 'Breakeven-protected: your stop sits at your entry — a return scratches automatically at 0 pips and the journal records breakeven.'
              : trade.stopPrice !== null || trade.targetPrice !== null
                ? 'Your stop or target closes this trade automatically when a 15-minute candle closes through it — you will get a journal alert. Or leave early below.'
                : 'No stop or target set, so this trade never closes on its own. Set them with Edit, or leave early below.'}
          </p>
          <div className="trade-close-row">
            <input
              className="input"
              inputMode="decimal"
              aria-label="Exit price for early close"
              value={closePrice ?? livePrice.toFixed(precision(prediction))}
              onChange={(e) => setClosePrice(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={closing}
              onClick={() => {
                const value = Number(
                  closePrice ?? livePrice.toFixed(precision(prediction))
                );
                if (!Number.isFinite(value) || value <= 0) return;
                setConfirmClose({ price: value, reason: 'manual' });
              }}
            >
              {closing && <Spinner />} Close trade now
            </button>
            {trade.entryPrice !== null && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={closing}
                data-tip="Scratch the trade at your entry: 0 pips, kept out of wins and losses."
                onClick={() =>
                  setConfirmClose({
                    price: trade.entryPrice!,
                    reason: 'breakeven',
                  })
                }
              >
                Breakeven
              </button>
            )}
          </div>
        </div>
      )}
      {trade.exitPrice !== null && (
        <p className="faint" style={{ fontSize: 12.5 }}>
          Closed{' '}
          {trade.exitReason === 'target'
            ? 'at your target (automatic)'
            : trade.exitReason === 'stop'
              ? 'at your stop (automatic)'
              : trade.exitReason === 'breakeven'
                ? 'at breakeven — scratched at entry, no gain no loss'
                : trade.exitReason === 'mt5'
                  ? 'via MT5 sync'
                  : 'manually'}
          {trade.exitedAt
            ? ` · ${new Date(trade.exitedAt).toLocaleString()}`
            : ''}
          . Edit to change the exit, or remove it from your journal.
        </p>
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
          onClick={() => setConfirmRemove(true)}
        >
          Remove
        </button>
      </div>
      {confirmRemove && (
        <ConfirmModal
          title="Remove this trade?"
          message="It will be removed from your journal and your totals. The signal itself is not affected. This cannot be undone."
          confirmLabel="Remove trade"
          danger
          busy={removing}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setRemoving(true);
            await remove(prediction.id).catch(() => undefined);
            setRemoving(false);
            setConfirmRemove(false);
          }}
        />
      )}
      {confirmClose !== null && (
        <ConfirmModal
          title={
            confirmClose.reason === 'breakeven'
              ? 'Close at breakeven?'
              : 'Close this trade?'
          }
          message={
            confirmClose.reason === 'breakeven'
              ? `Your exit will be recorded at your entry (${price(pair, confirmClose.price)}): 0 pips, counted as a breakeven scratch — not a win or loss.`
              : `Your exit will be recorded at ${price(pair, confirmClose.price)}. Pips are computed from your entry at ${price(pair, trade.entryPrice)}. You can edit the exit afterwards.`
          }
          confirmLabel={
            confirmClose.reason === 'breakeven' ? 'Close at breakeven' : 'Close trade'
          }
          busy={closing}
          onCancel={() => setConfirmClose(null)}
          onConfirm={() => void closeAt(confirmClose.price, confirmClose.reason)}
        />
      )}
      {confirmBEStop && trade.entryPrice !== null && (
        <ConfirmModal
          title="Move stop to breakeven?"
          message={`Your stop moves to your entry (${price(pair, trade.entryPrice)}). The trade stays open: if price comes back, the auto-exit scratches it at 0 pips and your journal records breakeven.`}
          confirmLabel="Move stop to entry"
          busy={moving}
          onCancel={() => setConfirmBEStop(false)}
          onConfirm={() => void moveStopToEntry()}
        />
      )}
    </div>
  );
}

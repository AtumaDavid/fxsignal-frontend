import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { price, signedPips } from '../lib/format';
import { useJournal } from '../lib/journal';
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
  const neutral = prediction.direction === 'NEUTRAL';
  const [side, setSide] = useState<'LONG' | 'SHORT' | ''>(
    trade?.side ?? (neutral ? '' : (prediction.direction as 'LONG' | 'SHORT'))
  );
  const [entry, setEntry] = useState(toInput(trade?.entryPrice));
  const [exit, setExit] = useState(toInput(trade?.exitPrice));
  const [lots, setLots] = useState(toInput(trade?.lots));
  const [notes, setNotes] = useState(trade?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const values = {
      entry: parse(entry),
      exit: parse(exit),
      lots: parse(lots),
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
export function MyTrade({ prediction }: { prediction: Prediction }) {
  const { data, error, tradeFor, remove } = useJournal();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const trade = tradeFor(prediction.id);

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
      </div>
      {trade.notes && <p className="trade-notes">{trade.notes}</p>}
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

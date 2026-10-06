import { Icon } from './Icon';
import {
  PAIR_NAMES,
  callLabel,
  directionTone,
  duration,
  price,
  time,
  tzLabel,
  useNow,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { LiveProgress, Prediction, TimeframeVote } from '../lib/types';

const TF_SHORT: Record<string, string> = {
  MONTHLY: 'M',
  WEEKLY: 'W',
  DAILY: 'D',
  H4: 'H4',
  H1: 'H1',
  M15: 'M15',
};

export function engineLabel(engine: Prediction['engine']) {
  return engine === 'DEEPSEEK' ? 'Model-reviewed' : 'Rules only';
}

/**
 * Stop → entry → target laid out in the direction of the trade, so risk always
 * reads left and reward right (a short's axis is mirrored). The last known
 * price is marked when it is available.
 */
export function PriceLadder({
  prediction,
  last,
}: {
  prediction: Prediction;
  last?: number | null;
}) {
  const p = prediction;
  const mid = (p.entryLow + p.entryHigh) / 2;
  // NEUTRAL calls still carry geometry; orient by where the target sits.
  const rising =
    p.direction === 'LONG' ||
    (p.direction === 'NEUTRAL' && p.targetPrice >= mid);
  const points = [p.invalidationPrice, p.entryLow, p.entryHigh, p.targetPrice];
  if (last !== null && last !== undefined) points.push(last);
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const pad = (hi - lo) * 0.06 || 1e-6;
  const min = lo - pad;
  const max = hi + pad;
  const pos = (value: number) => {
    const pct = ((value - min) / (max - min)) * 100;
    return rising ? pct : 100 - pct;
  };
  const span = (a: number, b: number) => ({
    left: `${Math.min(pos(a), pos(b))}%`,
    width: `${Math.abs(pos(a) - pos(b))}%`,
  });
  const nearEdge = rising ? p.entryLow : p.entryHigh;
  const farEdge = rising ? p.entryHigh : p.entryLow;

  const pipSize = p.pairCode === 'EUR/USD' ? 0.0001 : 0.01;
  const pipsFromMid = (value: number) => Math.abs(value - mid) / pipSize;

  return (
    <div className="ladder">
      <div
        className="ladder-track"
        role="img"
        aria-label={`Invalidation ${price(p.pairCode, p.invalidationPrice)}, entry ${price(p.pairCode, p.entryLow)} to ${price(p.pairCode, p.entryHigh)}, target ${price(p.pairCode, p.targetPrice)}`}
      >
        <span className="ladder-rail" />
        <span
          className="ladder-seg risk"
          style={span(p.invalidationPrice, nearEdge)}
        />
        <span
          className="ladder-seg reward"
          style={span(farEdge, p.targetPrice)}
        />
        <span className="ladder-zone" style={span(p.entryLow, p.entryHigh)} />
        <span
          className="ladder-tick stop"
          style={{ left: `${pos(p.invalidationPrice)}%` }}
        />
        <span
          className="ladder-tick target"
          style={{ left: `${pos(p.targetPrice)}%` }}
        />
        {last !== null && last !== undefined && (
          <span className="ladder-now" style={{ left: `${pos(last)}%` }}>
            <span>{price(p.pairCode, last)}</span>
          </span>
        )}
      </div>
      <div className="ladder-labels">
        <div>
          <span>Invalidation</span>
          <strong>{price(p.pairCode, p.invalidationPrice)}</strong>
          <em>−{pipsFromMid(p.invalidationPrice).toFixed(1)}p</em>
        </div>
        <div>
          <span>Entry zone</span>
          <strong>
            {price(p.pairCode, p.entryLow)}–
            {price(p.pairCode, p.entryHigh).slice(-3)}
          </strong>
          <em>{((p.entryHigh - p.entryLow) / pipSize).toFixed(1)}p wide</em>
        </div>
        <div>
          <span>Target</span>
          <strong>{price(p.pairCode, p.targetPrice)}</strong>
          <em>+{pipsFromMid(p.targetPrice).toFixed(1)}p</em>
        </div>
      </div>
    </div>
  );
}

/** Role of each timeframe in the intraday model (older signals have no roles). */
const TF_ROLE: Record<string, string> = {
  DAILY: 'context',
  H4: 'context',
  H1: 'execution',
  M15: 'confirm',
};

/** Signals from the current model vote on Daily, H4, H1 and M15 only. */
export function isContextModel(votes: TimeframeVote[]) {
  return !votes.some(
    (v) => v.timeframe === 'MONTHLY' || v.timeframe === 'WEEKLY'
  );
}

export function TimeframeVotes({ votes }: { votes: TimeframeVote[] }) {
  const roles = isContextModel(votes);
  return (
    <div
      className="votes"
      style={{ gridTemplateColumns: `repeat(${votes.length}, minmax(0, 1fr))` }}
    >
      {votes.map((vote) => (
        <div
          key={vote.timeframe}
          className={`vote ${directionTone(vote.bias)}`}
          title={`${vote.timeframe}: ${vote.bias.toLowerCase()} (${vote.score})`}
        >
          <b>{TF_SHORT[vote.timeframe] ?? vote.timeframe}</b>
          <i />
          <span className="num">
            {vote.score > 0 ? `+${vote.score}` : vote.score}
          </span>
          {roles && TF_ROLE[vote.timeframe] && (
            <em className="vote-role">{TF_ROLE[vote.timeframe]}</em>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Where the open signal stands, replayed from the newest M15 candles with the
 * same rules used to score it at expiry.
 */
export function LiveStatus({
  prediction,
  live,
}: {
  prediction: Prediction;
  live: LiveProgress;
}) {
  const { timeZone } = usePrefs();
  const p = prediction;
  if (live.state === 'neutral') return null;

  const pipSize = p.pairCode === 'EUR/USD' ? 0.0001 : 0.01;
  const signedPips = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}p`;

  let headline: string;
  let detail: string;
  let tone: 'up' | 'down' | 'flat' | '' = '';
  if (live.state === 'waiting') {
    const last = live.lastPrice;
    const distance =
      last === null
        ? null
        : last > p.entryHigh
          ? (last - p.entryHigh) / pipSize
          : last < p.entryLow
            ? (p.entryLow - last) / pipSize
            : 0;
    headline = 'Waiting for entry';
    detail =
      distance === null
        ? 'Price has not traded into the entry zone yet'
        : `Price ${price(p.pairCode, last)} · ${distance.toFixed(1)}p from the zone`;
  } else if (live.state === 'running') {
    tone = (live.pips ?? 0) > 0 ? 'up' : (live.pips ?? 0) < 0 ? 'down' : '';
    headline = `Running ${live.pips !== null ? signedPips(live.pips) : ''}`;
    detail = `Entry triggered ${live.filledAt ? time(live.filledAt, timeZone) : ''}${
      live.progress !== null
        ? live.progress >= 0
          ? ` · ${live.progress}% of the way to target`
          : ` · ${Math.abs(live.progress)}% of the way to the stop`
        : ''
    }`;
  } else {
    const hit = live.state === 'target';
    tone = hit ? 'up' : 'down';
    headline = hit ? 'Target reached' : 'Invalidated';
    detail = `${live.closedAt ? time(live.closedAt, timeZone) : ''} · ${
      live.pips !== null ? signedPips(live.pips) : ''
    } · final result is recorded when the window closes`;
  }

  const progress = live.progress ?? 0;
  return (
    <div className={`live ${live.state}`} aria-live="polite">
      <div className="live-top">
        <span
          className={`dot ${live.state === 'running' ? 'dot-live' : tone ? `dot-${tone}` : ''}`}
        />
        <strong className={tone}>{headline}</strong>
        <span className="live-detail">{detail}</span>
        {live.asOf && (
          <span className="live-asof">
            as of {time(live.asOf, timeZone)} {tzLabel(timeZone)}
          </span>
        )}
      </div>
      {(live.state === 'running' ||
        live.state === 'target' ||
        live.state === 'stopped') && (
        <div className="live-bar" aria-hidden="true">
          <span className="live-bar-mid" />
          <span
            className={`live-bar-fill ${progress >= 0 ? 'up' : 'down'}`}
            style={
              progress >= 0
                ? { left: '50%', width: `${progress / 2}%` }
                : { right: '50%', width: `${Math.abs(progress) / 2}%` }
            }
          />
          <em className="live-bar-l">Stop</em>
          <em className="live-bar-r">Target</em>
        </div>
      )}
    </div>
  );
}

/**
 * Shown when the H1 checkpoint has acted on a signal: cancelled before entry
 * (no trade) or an early exit suggested on strong evidence.
 */
export function CheckpointStatus({ prediction }: { prediction: Prediction }) {
  const { timeZone } = usePrefs();
  const o = prediction.outcome;
  if (!o || (o.status !== 'CANCELLED' && o.status !== 'CLOSED_EARLY'))
    return null;
  const cancelled = o.status === 'CANCELLED';
  const pips = o.movementPips;
  return (
    <div className="live checkpoint" role="status">
      <div className="live-top">
        <span className="dot dot-flat" />
        <strong className="flat">
          {cancelled
            ? 'Cancelled before entry'
            : `Exit suggested${pips !== null ? ` ${pips > 0 ? '+' : pips < 0 ? '−' : ''}${Math.abs(pips).toFixed(1)}p` : ''}`}
        </strong>
        <span className="live-detail">
          {o.evaluatedAt ? `H1 close ${time(o.evaluatedAt, timeZone)}` : ''}
          {!cancelled && o.resolvedPrice !== null
            ? ` · at ${price(prediction.pairCode, o.resolvedPrice)}`
            : ''}
        </span>
      </div>
      {o.note && (
        <p className="checkpoint-note">
          {o.note.replace(/^(Cancelled before entry|Exit suggested): /, '')}
        </p>
      )}
      <p className="checkpoint-note faint">
        {cancelled
          ? 'Not a trade, not scored. The pair is re-read at a later H1 close once H1 agrees with the context again.'
          : 'Counted in net pips, not in the target/stop hit rate. A new setup can follow at a later H1 close.'}
      </p>
    </div>
  );
}

export function SignalTicket({
  prediction,
  last,
  onOpen,
}: {
  prediction: Prediction;
  last?: number | null;
  onOpen?: () => void;
}) {
  const { timeZone } = usePrefs();
  const now = useNow(30_000);
  const p = prediction;
  const tone = directionTone(p.direction);
  const start = new Date(p.validFrom).getTime();
  const end = new Date(p.expiresAt).getTime();
  const left = end - now;
  const elapsed = Math.min(
    100,
    Math.max(0, ((now - start) / (end - start)) * 100)
  );

  return (
    <article className="ticket">
      <div className="ticket-head">
        <div className="ticket-pair">
          <div>
            <h3>{p.pairCode}</h3>
            <p>{PAIR_NAMES[p.pairCode]}</p>
          </div>
        </div>
        <span className="tag">{engineLabel(p.engine)}</span>
      </div>

      <div className="ticket-call">
        <div className={`ticket-direction ${tone}`}>
          {callLabel(p)}
          <small>
            {p.continuesId
              ? 'Managing the open trade from an earlier window · no new entry'
              : p.direction === 'NEUTRAL'
                ? 'No trade this window — stand aside'
                : `${p.session} window · until ${time(p.expiresAt, timeZone)} ${tzLabel(timeZone)}`}
          </small>
        </div>
        <div className="ticket-confidence">
          <div className="ticket-confidence-top">
            <span>Confidence</span>
            <span className="num">{p.confidence}%</span>
          </div>
          <div className="meter meter-ink">
            <span style={{ width: `${p.confidence}%` }} />
          </div>
        </div>
      </div>

      <CheckpointStatus prediction={p} />
      {p.live && <LiveStatus prediction={p} live={p.live} />}

      <PriceLadder prediction={p} last={p.live?.lastPrice ?? last} />

      <div className="ticket-stats">
        <div>
          <span>Reward : risk</span>
          <strong>
            {p.riskReward !== null ? `${p.riskReward.toFixed(2)}R` : '—'}
          </strong>
        </div>
        <div>
          <span>Risk</span>
          <strong>
            {p.stopPips !== null ? `${p.stopPips.toFixed(1)}p` : '—'}
          </strong>
        </div>
        <div>
          <span>Reward</span>
          <strong>
            {p.targetPips !== null ? `${p.targetPips.toFixed(1)}p` : '—'}
          </strong>
        </div>
        <div>
          <span>H1 ATR</span>
          <strong>
            {p.atrPips !== null ? `${p.atrPips.toFixed(1)}p` : '—'}
          </strong>
        </div>
      </div>

      {p.timeframeBias && p.timeframeBias.length > 0 && (
        <div className="ticket-votes">
          <div className="ticket-votes-head">
            <span>Timeframe votes</span>
            <span>
              {isContextModel(p.timeframeBias)
                ? 'D · H4 context → H1 execution → M15'
                : 'monthly → M15'}
            </span>
          </div>
          <TimeframeVotes votes={p.timeframeBias} />
        </div>
      )}

      <div className="ticket-foot">
        <div className="grow ticket-expiry">
          <div className="ticket-expiry-top">
            <span>
              {left > 0
                ? `${p.outcome?.status === 'CANCELLED' || p.outcome?.status === 'CLOSED_EARLY' ? 'Window ends in' : 'Expires in'} ${duration(left)}`
                : 'Expired — settling'}
            </span>
          </div>
          <div className="meter">
            <span style={{ width: `${elapsed}%` }} />
          </div>
        </div>
        {onOpen && (
          <button className="btn btn-secondary btn-sm" onClick={onOpen}>
            Reasoning <Icon name="arrowRight" size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

export function TicketSkeleton() {
  return (
    <div className="ticket" aria-hidden="true">
      <div className="panel-body stack">
        <div className="skeleton" style={{ height: 18, width: 120 }} />
        <div className="skeleton" style={{ height: 30, width: 90 }} />
        <div className="skeleton" style={{ height: 34 }} />
        <div className="skeleton" style={{ height: 52 }} />
        <div className="skeleton" style={{ height: 44 }} />
      </div>
    </div>
  );
}

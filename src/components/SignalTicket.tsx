import { Icon, type IconName } from './Icon';
import { InfoTip } from './ui/InfoTip';
import { nextStep, type StepTone } from '../lib/nextStep';
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
import { tradeTargets } from '../lib/targets';
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
  const tps = tradeTargets(p);
  const finalTarget = tps?.tp3 ?? p.targetPrice;
  const hits = p.live?.tpHits ?? 0;
  const points = [p.invalidationPrice, p.entryLow, p.entryHigh, finalTarget];
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
    <div className={`ladder${tps ? ' ladder-3tp' : ''}`}>
      <div
        className="ladder-track"
        role="img"
        aria-label={`Invalidation ${price(p.pairCode, p.invalidationPrice)}, entry ${price(p.pairCode, p.entryLow)} to ${price(p.pairCode, p.entryHigh)}, ${tps ? `TP1 ${price(p.pairCode, tps.tp1)}, TP2 ${price(p.pairCode, tps.tp2)}, TP3 ${price(p.pairCode, tps.tp3)}` : `target ${price(p.pairCode, p.targetPrice)}`}`}
      >
        <span className="ladder-rail" />
        <span
          className="ladder-seg risk"
          style={span(p.invalidationPrice, nearEdge)}
        />
        <span
          className="ladder-seg reward"
          style={span(farEdge, finalTarget)}
        />
        <span className="ladder-zone" style={span(p.entryLow, p.entryHigh)} />
        <span
          className="ladder-tick stop"
          style={{ left: `${pos(p.invalidationPrice)}%` }}
        />
        {tps ? (
          [tps.tp1, tps.tp2, tps.tp3].map((level, i) => (
            <span
              key={i}
              className={`ladder-tick target tp${i + 1}${hits > i ? ' hit' : ''}`}
              style={{ left: `${pos(level)}%` }}
              data-tip={`TP${i + 1} ${price(p.pairCode, level)}: close a third here.`}
            />
          ))
        ) : (
          <span
            className="ladder-tick target"
            style={{ left: `${pos(p.targetPrice)}%` }}
          />
        )}
        {last !== null && last !== undefined && (
          <span
            className="ladder-now"
            style={{ left: `${pos(last)}%` }}
            data-tip="Last price, from the latest 15-minute candle."
          >
            <span>{price(p.pairCode, last)}</span>
          </span>
        )}
      </div>
      <div className="ladder-labels">
        <div>
          <span data-tip="Stop loss. If price trades here the idea is wrong; the trade is closed at this price.">
            Stop
          </span>
          <strong>{price(p.pairCode, p.invalidationPrice)}</strong>
          <em>−{pipsFromMid(p.invalidationPrice).toFixed(1)}p</em>
        </div>
        <div>
          <span data-tip="Enter anywhere inside this range, after a 15-minute candle closes in the trade direction. No fill here means no trade.">
            Entry zone
          </span>
          <strong>
            {price(p.pairCode, p.entryLow)}–
            {price(p.pairCode, p.entryHigh).slice(-3)}
          </strong>
          <em>{((p.entryHigh - p.entryLow) / pipSize).toFixed(1)}p wide</em>
        </div>
        {!tps && (
          <div>
            <span data-tip="Take profit. Always at least twice the distance to the stop (2R), measured from the middle of the zone.">
              Target
            </span>
            <strong>{price(p.pairCode, p.targetPrice)}</strong>
            <em>+{pipsFromMid(p.targetPrice).toFixed(1)}p</em>
          </div>
        )}
      </div>
      {tps && (
        <div className="ladder-labels ladder-targets">
          {[
            {
              level: tps.tp1,
              tip: 'TP1 (1R). Close a third, then move the stop to your entry: the trade can no longer lose.',
            },
            {
              level: tps.tp2,
              tip: 'TP2 (the 2R target). Close another third, then move the stop to TP1.',
            },
            {
              level: tps.tp3,
              tip: 'TP3 (one more R). Close the last third.',
            },
          ].map(({ level, tip }, i) => (
            <div key={i} className={hits > i ? 'hit' : undefined}>
              <span data-tip={tip}>
                TP{i + 1}
                {hits > i ? ' ✓' : ' · ⅓'}
              </span>
              <strong>{price(p.pairCode, level)}</strong>
              <em>+{pipsFromMid(level).toFixed(1)}p</em>
            </div>
          ))}
        </div>
      )}
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
  const managed = tradeTargets(p) !== null;
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
    const hits = live.tpHits ?? 0;
    const stage =
      hits >= 2
        ? 'TP1 + TP2 booked · stop at TP1'
        : hits === 1
          ? 'TP1 booked · stop at entry'
          : null;
    const toward = managed ? 'TP3' : 'target';
    headline = `Running ${live.pips !== null ? signedPips(live.pips) : ''}`;
    detail = stage
      ? `${stage}${live.progress !== null && live.progress >= 0 ? ` · ${live.progress}% of the way to ${toward}` : ''}`
      : `Entry triggered ${live.filledAt ? time(live.filledAt, timeZone) : ''}${
          live.progress !== null
            ? live.progress >= 0
              ? ` · ${live.progress}% of the way to ${toward}`
              : ` · ${Math.abs(live.progress)}% of the way to the stop`
            : ''
        }`;
  } else {
    const hit = live.state === 'target';
    const hits = live.tpHits ?? 0;
    tone = hit ? 'up' : 'down';
    headline = !hit
      ? 'Invalidated'
      : !managed
        ? 'Target reached'
        : hits >= 3
          ? 'All 3 targets hit'
          : hits === 2
            ? 'TP2 hit · last third closed at TP1'
            : 'TP1 hit · rest closed at entry';
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
          <span
            className="live-asof"
            data-tip="Progress is replayed from closed 15-minute candles, so it can be up to about 15 minutes behind the live price."
          >
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
          <em className="live-bar-r">{managed ? 'TP3' : 'Target'}</em>
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

const STEP_ICON: Record<StepTone, IconName> = {
  act: 'arrowRight',
  wait: 'clock',
  hold: 'check',
  done: 'check',
  skip: 'close',
  exit: 'info',
};

/** The one thing to do with this signal right now. Leads every card. */
export function NextStepBox({ prediction }: { prediction: Prediction }) {
  const now = useNow(30_000);
  const step = nextStep(prediction, now);
  return (
    <div className={`next-step step-${step.tone}`} role="status">
      <span className="next-step-icon">
        <Icon name={STEP_ICON[step.tone]} size={14} />
      </span>
      <div>
        <span
          className="next-step-label"
          data-tip="What to do with this signal right now. It updates as price moves."
        >
          Next step
        </span>
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
      </div>
    </div>
  );
}

export function SignalTicket({
  prediction,
  last,
  onOpen,
  onLogTrade,
}: {
  prediction: Prediction;
  last?: number | null;
  /** Opens the full plan (chart, size, reasoning). */
  onOpen?: () => void;
  /** Opens the plan straight at "My trade". */
  onLogTrade?: () => void;
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
  const finished =
    p.outcome?.status !== undefined && p.outcome.status !== 'PENDING';
  const tradeable = p.direction !== 'NEUTRAL' && !p.continuesId;
  const showProgress =
    p.live &&
    (p.live.state === 'running' ||
      p.live.state === 'target' ||
      p.live.state === 'stopped');

  return (
    <article className="ticket">
      <div className="ticket-head">
        <div className="ticket-pair">
          <div>
            <h3>{p.pairCode}</h3>
            <p>
              {p.carried
                ? `${p.session} ${time(p.validFrom, timeZone)} trade · ${p.carried.reconfirmed ? 're-confirmed' : 'checked'} by ${p.carried.window}`
                : `${p.session} window · ${
                    left > 0
                      ? `until ${time(p.expiresAt, timeZone)} ${tzLabel(timeZone)}`
                      : 'ended'
                  }`}
            </p>
          </div>
        </div>
        <div className="ticket-head-right">
          {p.carried && (
            <span
              className={`tag ${p.carried.reconfirmed ? 'tag-up' : ''}`}
              data-tip={
                p.carried.reconfirmed
                  ? `The ${p.carried.window} analysis agreed with this open trade, so no new signal was published. It is still the same trade and is counted once.`
                  : `The ${p.carried.window} analysis turned neutral. The trade keeps its own stop and target; there is no new entry.`
              }
            >
              {p.carried.reconfirmed ? 'Still valid' : 'Not re-confirmed'}
            </span>
          )}
          <div className={`ticket-direction ${tone}`}>{callLabel(p)}</div>
        </div>
      </div>

      <div className="ticket-body">
        <NextStepBox prediction={p} />
        {showProgress && !finished && (
          <LiveStatus prediction={p} live={p.live!} />
        )}
      </div>

      {tradeable && (
        <PriceLadder prediction={p} last={p.live?.lastPrice ?? last} />
      )}

      {tradeable && (
        <div className="ticket-stats ticket-stats-3">
          <div>
            <span>
              Reward : risk{' '}
              <InfoTip label="reward to risk">
                How much the target pays for each unit risked to the stop. 2R
                means a win makes twice what a loss costs.
              </InfoTip>
            </span>
            <strong>
              {p.riskReward !== null ? `${p.riskReward.toFixed(2)}R` : '—'}
            </strong>
          </div>
          <div>
            <span>Risk to stop</span>
            <strong>
              {p.stopPips !== null ? `${p.stopPips.toFixed(1)} pips` : '—'}
            </strong>
          </div>
          <div>
            <span>
              Confidence{' '}
              <InfoTip label="confidence">
                How strongly the daily, 4-hour, 1-hour and 15-minute charts
                agree. It is not the chance of winning.
              </InfoTip>
            </span>
            <strong>{p.confidence}%</strong>
          </div>
        </div>
      )}

      <div className="ticket-foot">
        <div className="grow ticket-expiry">
          {p.carried ? (
            <span>Followed until its target or stop</span>
          ) : (
            <>
              <span>
                {left > 0
                  ? `${finished ? 'Window ends in' : 'Time left'} ${duration(left)}`
                  : 'Window ended'}
              </span>
              <div className="meter">
                <span style={{ width: `${elapsed}%` }} />
              </div>
            </>
          )}
        </div>
        {onLogTrade && tradeable && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onLogTrade}
            data-tip="Save this trade to your journal, prefilled from the signal. The exit is filled in automatically when your stop or target is hit."
          >
            Log trade
          </button>
        )}
        {onOpen && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpen}
            data-tip="The full plan: chart, position size for your account, your trade and why this call was made."
          >
            Open plan <Icon name="arrowRight" size={13} />
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

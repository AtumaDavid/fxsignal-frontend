import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { LiveStatus, PriceLadder, engineLabel } from './SignalTicket';
import { SignalChart } from './Charts';
import { MyTrade } from './MyTrade';
import { PositionSizer } from './PositionSizer';
import {
  PAIR_NAMES,
  dateTime,
  callLabel,
  directionTone,
  price,
  signedPips,
  tzLabel,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { Prediction } from '../lib/types';

const OUTCOME_LABEL = {
  HIT: 'Target hit',
  MISSED: 'Invalidated',
  EXPIRED: 'Expired',
  PENDING: 'Open',
} as const;

export function SignalDetail({
  prediction,
  last,
}: {
  prediction: Prediction;
  last?: number | null;
}) {
  const { timeZone } = usePrefs();
  const p = prediction;
  const outcome = p.outcome;

  return (
    <>
      <div className="detail-section">
        <span className="label">Levels</span>
        {p.live && p.live.state !== 'neutral' && (
          <div className="live-flush">
            <LiveStatus prediction={p} live={p.live} />
          </div>
        )}
        <PriceLadder prediction={p} last={p.live?.lastPrice ?? last} />
      </div>

      {new Date(p.expiresAt).getTime() > Date.now() &&
        p.direction !== 'NEUTRAL' &&
        p.stopPips !== null && (
          <div className="detail-section">
            <span className="label">Position size</span>
            <PositionSizer prediction={p} />
          </div>
        )}

      <div className="detail-section">
        <span className="label">My trade</span>
        <MyTrade prediction={p} />
      </div>

      <div className="detail-section">
        <span className="label">Reasoning</span>
        <p className="prose">{p.rationale}</p>
      </div>

      {p.playbook && (
        <div className="detail-section">
          <span className="label">Session playbook</span>
          <div className="callout">{p.playbook}</div>
        </div>
      )}

      {p.factors.length > 0 && (
        <div className="detail-section">
          <span className="label">Factors</span>
          <ul className="factor-list">
            {p.factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {p.timeframeBias && p.timeframeBias.length > 0 && (
        <div className="detail-section">
          <span className="label">Timeframe votes</span>
          <div className="panel table-wrap">
            <table className="table vote-table">
              <thead>
                <tr>
                  <th>Timeframe</th>
                  <th>Bias</th>
                  <th className="r">Score (−100…+100)</th>
                </tr>
              </thead>
              <tbody>
                {p.timeframeBias.map((vote) => (
                  <tr key={vote.timeframe}>
                    <td className="strong mono">{vote.timeframe}</td>
                    <td>
                      <span className={`tag tag-${directionTone(vote.bias)}`}>
                        {vote.bias.toLowerCase()}
                      </span>
                    </td>
                    <td className="r num">
                      {vote.score > 0 ? `+${vote.score}` : vote.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="detail-section">
        <span className="label">Specification</span>
        <div className="kv">
          <div>
            <span>Published</span>
            <strong>{dateTime(p.validFrom, timeZone)}</strong>
          </div>
          <div>
            <span>Expires</span>
            <strong>{dateTime(p.expiresAt, timeZone)}</strong>
          </div>
          <div>
            <span>Reward : risk</span>
            <strong>
              {p.riskReward !== null ? `${p.riskReward.toFixed(2)}R` : '—'}
            </strong>
          </div>
          <div>
            <span>Confidence</span>
            <strong>{p.confidence}%</strong>
          </div>
          <div>
            <span>Risk / reward</span>
            <strong>
              {p.stopPips ?? '—'}p / {p.targetPips ?? '—'}p
            </strong>
          </div>
          <div>
            <span>H1 ATR</span>
            <strong>{p.atrPips !== null ? `${p.atrPips}p` : '—'}</strong>
          </div>
          <div>
            <span>Engine</span>
            <strong>{engineLabel(p.engine)}</strong>
          </div>
          <div>
            <span>Model</span>
            <strong>{p.modelName ?? '—'}</strong>
          </div>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>
          Times shown in {tzLabel(timeZone)}. Pips measured from the middle of
          the entry zone.
        </span>
      </div>

      {outcome && outcome.status !== 'PENDING' && (
        <div className="detail-section">
          <span className="label">Outcome</span>
          <div className="kv">
            <div>
              <span>Result</span>
              <strong>{OUTCOME_LABEL[outcome.status]}</strong>
            </div>
            <div>
              <span>Move</span>
              <strong>{signedPips(outcome.movementPips)}p</strong>
            </div>
            <div>
              <span>Settled at</span>
              <strong>{price(p.pairCode, outcome.resolvedPrice)}</strong>
            </div>
            <div>
              <span>Evaluated</span>
              <strong>
                {outcome.evaluatedAt
                  ? dateTime(outcome.evaluatedAt, timeZone)
                  : '—'}
              </strong>
            </div>
          </div>
          {outcome.note && (
            <p className="faint" style={{ fontSize: 12.5 }}>
              {outcome.note}
            </p>
          )}
        </div>
      )}

      <p className="disclaimer">
        <Icon name="info" size={14} />
        Algorithmic market context for research. Not a recommendation to buy or
        sell, and not financial advice.
      </p>
    </>
  );
}

export function SignalDrawer({
  prediction,
  last,
  onClose,
}: {
  prediction: Prediction;
  last?: number | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Parents re-render on timers; keep the latest handler without re-running
  // the mount effect (which would steal focus every tick).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const tone = directionTone(prediction.direction);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-drawer-title"
      >
        <div className="drawer-head">
          <div>
            <h2 id="signal-drawer-title">
              {prediction.pairCode}
              <span className={`tag tag-${tone}`}>
                {callLabel(prediction)}
              </span>
            </h2>
            <span className="faint" style={{ fontSize: 12 }}>
              {PAIR_NAMES[prediction.pairCode]} · {prediction.session} window
            </span>
          </div>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="detail-section">
            <span className="label">Price action</span>
            <div className="panel">
              <SignalChart prediction={prediction} height={260} />
            </div>
          </div>
          <SignalDetail prediction={prediction} last={last} />
        </div>
      </aside>
    </>
  );
}

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import {
  LiveStatus,
  NextStepBox,
  PriceLadder,
  TimeframeVotes,
  engineLabel,
} from './SignalTicket';
import { InfoTip } from './ui/InfoTip';
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
  CLOSED_EARLY: 'Closed early',
  CANCELLED: 'Cancelled before entry',
  EXPIRED: 'Expired',
  PENDING: 'Open',
} as const;

export function SignalDetail({
  prediction,
  last,
  summary = true,
  chart = false,
  focusTrade = false,
  wide = false,
}: {
  prediction: Prediction;
  last?: number | null;
  /** Show the next step + levels (off where the card is already beside it). */
  summary?: boolean;
  /** Include the price chart. */
  chart?: boolean;
  /** Open "My trade" ready to log. */
  focusTrade?: boolean;
  /** Two columns: chart + reasoning left, size + trade right. */
  wide?: boolean;
}) {
  const { timeZone } = usePrefs();
  const p = prediction;
  const outcome = p.outcome;
  const tradeable = p.direction !== 'NEUTRAL' && !p.continuesId;
  const open =
    new Date(p.expiresAt).getTime() > Date.now() &&
    (outcome?.status ?? 'PENDING') === 'PENDING';
  const showProgress =
    p.live &&
    (p.live.state === 'running' ||
      p.live.state === 'target' ||
      p.live.state === 'stopped');

  const summaryBlock = (
    <>
      {summary && (
        <div className="detail-section">
          <NextStepBox prediction={p} />
          {showProgress && (
            <div className="live-flush">
              <LiveStatus prediction={p} live={p.live!} />
            </div>
          )}
          {tradeable && (
            <PriceLadder prediction={p} last={p.live?.lastPrice ?? last} />
          )}
        </div>
      )}
    </>
  );
  const chartBlock = (
    <>
      {chart && (
        <div className="detail-section">
          <span className="label">Chart</span>
          <div className="panel">
            <SignalChart prediction={p} height={wide ? 380 : 260} />
          </div>
        </div>
      )}
    </>
  );
  const sizeBlock = (
    <>
      {tradeable && open && p.stopPips !== null && (
        <div className="detail-section">
          <span className="label">
            Position size{' '}
            <InfoTip label="position size">
              Lots that risk your chosen % of the account if the stop is hit.
              Saved on this device.
            </InfoTip>
          </span>
          <PositionSizer prediction={p} />
        </div>
      )}
    </>
  );
  const tradeBlock = (
    <>
      <div className="detail-section" id="my-trade">
        <span className="label">My trade</span>
        <MyTrade prediction={p} autoOpen={focusTrade} />
      </div>
    </>
  );
  const whyBlock = (
    <>
      <div className="detail-section">
        <span className="label">Why this trade</span>
        {p.playbook && <div className="callout">{p.playbook}</div>}
        <p className="prose">{p.rationale}</p>
        {p.factors.length > 0 && (
          <ul className="factor-list">
            {p.factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
  const techBlock = (
    <>
      <details className="more">
        <summary>
          Technical details
          <Icon name="chevron" size={15} />
        </summary>
        <div className="more-body">
          {p.timeframeBias && p.timeframeBias.length > 0 && (
            <div className="detail-section">
              <span className="label">Timeframe votes</span>
              <TimeframeVotes votes={p.timeframeBias} />
            </div>
          )}
          <div className="kv">
            <div>
              <span>Published</span>
              <strong>{dateTime(p.validFrom, timeZone)}</strong>
            </div>
            <div>
              <span>Window ends</span>
              <strong>{dateTime(p.expiresAt, timeZone)}</strong>
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
            {outcome && outcome.status !== 'PENDING' && (
              <>
                <div>
                  <span>Result</span>
                  <strong>{OUTCOME_LABEL[outcome.status]}</strong>
                </div>
                <div>
                  <span>Settled at</span>
                  <strong>{price(p.pairCode, outcome.resolvedPrice)}</strong>
                </div>
              </>
            )}
          </div>
          {outcome?.note && outcome.status !== 'PENDING' && (
            <p className="faint" style={{ fontSize: 12.5 }}>
              {outcome.note}
            </p>
          )}
          <span className="faint" style={{ fontSize: 12 }}>
            Times in {tzLabel(timeZone)}. Pips are measured from the middle of
            the entry zone.
          </span>
        </div>
      </details>
    </>
  );
  const noteBlock = (
    <>
      <p className="disclaimer">
        <Icon name="info" size={14} />
        Market analysis for research and education, not a recommendation to buy
        or sell.
      </p>
    </>
  );

  if (wide)
    return (
      <div className="plan-grid">
        <div className="plan-main">
          {summaryBlock}
          {chartBlock}
          {whyBlock}
        </div>
        <div className="plan-side">
          {sizeBlock}
          {tradeBlock}
          {techBlock}
          {noteBlock}
        </div>
      </div>
    );
  return (
    <>
      {summaryBlock}
      {chartBlock}
      {sizeBlock}
      {tradeBlock}
      {whyBlock}
      {techBlock}
      {noteBlock}
    </>
  );
}

export function SignalDrawer({
  prediction,
  last,
  onClose,
  focus,
}: {
  prediction: Prediction;
  last?: number | null;
  onClose: () => void;
  /** Open straight at "My trade" (from the card's "Log trade"). */
  focus?: 'trade';
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Parents re-render on timers; keep the latest handler without re-running
  // the mount effect (which would steal focus every tick).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    if (focus === 'trade') {
      // Let the chart and sizer lay out first, then jump to "My trade".
      setTimeout(() => {
        bodyRef.current
          ?.querySelector('#my-trade')
          ?.scrollIntoView({ block: 'start' });
      }, 80);
    }
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
              <span className={`tag tag-${tone}`}>{callLabel(prediction)}</span>
            </h2>
            <span className="faint" style={{ fontSize: 12 }}>
              {PAIR_NAMES[prediction.pairCode]} · {prediction.session} window ·
              trade plan
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
        <div className="drawer-body" ref={bodyRef}>
          <SignalDetail
            prediction={prediction}
            last={last}
            chart
            wide
            focusTrade={focus === 'trade'}
          />
        </div>
      </aside>
    </>
  );
}

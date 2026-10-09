import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SignalTicket } from '../components/SignalTicket';
import { Brand } from '../components/ui/Brand';
import { useAuth } from '../lib/auth';
import type { Prediction } from '../lib/types';

const NAV = [
  { href: '/track-record', label: 'Track record' },
  { href: '/#method', label: 'Method' },
  { href: '/#anatomy', label: 'The signal' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

/** Illustrative tickets for the product frame — clearly labelled as such. */
function useExampleSignals(): Prediction[] {
  return useMemo(() => {
    const now = Date.now();
    const windowStart = Math.floor(now / 21_600_000) * 21_600_000;
    const base = {
      windowKey: 'example',
      engine: 'RULE_BASED' as const,
      modelName: null,
      rationale: '',
      factors: [],
      session: 'London',
      playbook: null,
      validFrom: new Date(windowStart).toISOString(),
      expiresAt: new Date(windowStart + 21_600_000).toISOString(),
      createdAt: new Date(windowStart).toISOString(),
      outcome: null,
    };
    return [
      {
        ...base,
        id: 'ex-1',
        pairCode: 'EUR/USD',
        direction: 'SHORT',
        confidence: 64,
        entryLow: 1.1249,
        entryHigh: 1.1261,
        targetPrice: 1.12,
        invalidationPrice: 1.128,
        stopPips: 25,
        targetPips: 55,
        riskReward: 2.2,
        atrPips: 18.4,
        timeframeBias: [
          { timeframe: 'DAILY', bias: 'BEARISH', score: -74 },
          { timeframe: 'H4', bias: 'BEARISH', score: -71 },
          { timeframe: 'H1', bias: 'BEARISH', score: -54 },
          { timeframe: 'M15', bias: 'BEARISH', score: -38 },
        ],
      },
      {
        ...base,
        id: 'ex-2',
        pairCode: 'USD/JPY',
        direction: 'LONG',
        engine: 'DEEPSEEK',
        confidence: 58,
        entryLow: 157.74,
        entryHigh: 157.88,
        targetPrice: 158.43,
        invalidationPrice: 157.53,
        stopPips: 28,
        targetPips: 62,
        riskReward: 2.21,
        atrPips: 21.7,
        timeframeBias: [
          { timeframe: 'DAILY', bias: 'BULLISH', score: 36 },
          { timeframe: 'H4', bias: 'BULLISH', score: 48 },
          { timeframe: 'H1', bias: 'BULLISH', score: 37 },
          { timeframe: 'M15', bias: 'BULLISH', score: 44 },
        ],
      },
    ];
  }, []);
}

export function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-nav">
      <div className="lp-container">
        <Brand />
        <nav aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-actions">
          {user ? (
            <Link to="/app" className="btn btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost hide-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
          <button
            className="icon-btn lp-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </div>
      {open && (
        <div className="lp-mobile">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          {!user && <Link to="/login">Sign in</Link>}
        </div>
      )}
    </header>
  );
}

function Hero() {
  const examples = useExampleSignals();
  return (
    <section className="lp-hero">
      <div className="lp-container">
        <div className="lp-kicker">
          <span className="dot dot-live" /> EUR/USD · USD/JPY · London, New York
          & Asia sessions
        </div>
        <h1>
          Intraday FX reads,{' '}
          <span>with the levels written down and the results kept.</span>
        </h1>
        <p className="lp-hero-sub">
          FXSignal takes its direction from the daily and 4-hour charts,
          executes on the 1-hour and confirms on the 15-minute, then publishes
          one call per window on two major pairs: direction, entry zone,
          invalidation, a target of at least 2R, and the reasoning. When the
          window closes, the call is replayed against the price path and goes
          into a public track record — hits and misses alike.
        </p>
        <div className="lp-hero-ctas">
          <Link to="/register" className="btn btn-primary btn-lg">
            Create a free account
          </Link>
          <a href="#method" className="btn btn-secondary btn-lg">
            How signals are made
          </a>
        </div>
        <p className="lp-hero-meta">
          Free plan includes every signal. No card required.
        </p>

        <div
          className="lp-frame"
          aria-label="Product preview with illustrative data"
        >
          <div className="lp-frame-bar">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Overview · current window</span>
            <span className="lp-frame-note">illustrative data</span>
          </div>
          <div className="lp-frame-body">
            <SignalTicket prediction={examples[0]} last={1.12537} />
            <SignalTicket prediction={examples[1]} last={157.862} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Facts() {
  const facts = [
    ['2 pairs', 'EUR/USD and USD/JPY, nothing else'],
    ['D · H4 → H1 → M15', 'Context, execution, confirmation'],
    ['3 session windows', 'Asia 00 · London 07 · New York 12 UTC'],
    ['Every call scored', 'Replayed against M15 candles'],
  ];
  return (
    <div className="lp-container">
      <div className="lp-facts">
        {facts.map(([title, note]) => (
          <div className="lp-fact" key={title}>
            <strong>{title}</strong>
            <span>{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Method() {
  const steps = [
    {
      n: '01',
      title: 'Read the structure',
      copy: 'EMA 20/50/200, RSI, ATR and swing structure on four timeframes, each with one job. The daily and 4-hour set the direction; the 1-hour must agree before anything is executed; the 15-minute only confirms the timing.',
      list: [
        'context · daily 55 / H4 45',
        'execution · H1 must not oppose',
        'confirmation · M15 adjusts confidence',
      ],
    },
    {
      n: '02',
      title: 'Commit to levels',
      copy: 'The entry zone and stop come from H1 volatility and the last ten H1 bars of structure. The target is set at least twice the risk away. If the structure needs a stop too wide for 1:2, there is no trade that window.',
      list: [
        'entry zone 8–28 pips (H1 ATR)',
        'stop beyond H1 structure, ≤ 60 pips',
        'target ≥ 2R, always',
      ],
    },
    {
      n: '03',
      title: 'Score it honestly',
      copy: 'Each call is replayed candle by candle. No fill in its window means no trade; a filled trade is followed until its target or stop trades, even after newer signals appear. If stop and target share a candle, the stop counts first.',
      list: [
        'fills at zone midpoint',
        'followed to target or stop',
        'signed pips, kept forever',
      ],
    },
  ];
  return (
    <section className="lp-section" id="method">
      <div className="lp-container">
        <div className="lp-section-head">
          <div>
            <span className="lp-eyebrow">Method</span>
            <h2>Three steps, every one of them inspectable.</h2>
          </div>
          <p>
            No black box. Each signal shows the six timeframe votes, the risk in
            pips and the reasoning, and the methodology page documents every
            rule, including how results are counted.
          </p>
        </div>
        <div className="lp-steps">
          {steps.map((step) => (
            <div className="lp-step" key={step.n}>
              <span className="lp-step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <ul>
                {step.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Anatomy() {
  const examples = useExampleSignals();
  const notes = [
    [
      'A plain next step',
      'Every card says what to do now — wait for the entry, hold, take profit, exit or skip — with the prices you need.',
    ],
    [
      'Levels on one line',
      'Stop, entry zone and target, drawn in the trade’s direction with the last price marked, so you can see at a glance where price sits.',
    ],
    [
      'Risk you can size',
      'Reward-to-risk and pips to the stop, plus a calculator that turns your balance and risk % into a lot size.',
    ],
    [
      'Reasoning on demand',
      'Open the plan for the chart, the timeframe votes (daily and H4 context, H1 execution, M15 confirmation) and why the call was made.',
    ],
  ];
  return (
    <section className="lp-section" id="anatomy">
      <div className="lp-container">
        <div className="lp-anatomy">
          <div>
            <span className="lp-eyebrow">The signal</span>
            <h2 style={{ marginBottom: 32 }}>
              Everything you need to agree or disagree.
            </h2>
            <div className="lp-notes">
              {notes.map(([title, copy], index) => (
                <div className="lp-note" key={title}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SignalTicket prediction={examples[0]} last={1.12537} />
        </div>
      </div>
    </section>
  );
}

function Weekend() {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <div className="lp-section-head">
          <div>
            <span className="lp-eyebrow">Weekends</span>
            <h2>When the market closes, the preparation starts.</h2>
          </div>
          <p>
            From Friday's close to Sunday's open there are no intraday calls.
            Instead, each pair gets a week-ahead outlook built from the higher
            timeframes and the economic calendar.
          </p>
        </div>
        <div className="lp-weekend">
          <div className="stack">
            <span className="label">Each outlook includes</span>
            <ul className="factor-list">
              <li>Bias and conviction from monthly down to H1</li>
              <li>
                Support and resistance worth marking, with distance from price
              </li>
              <li>
                Bull, base and bear scenarios, each with a trigger and a target
              </li>
              <li>The week's scheduled catalysts for USD, EUR and JPY</li>
              <li>
                A plan: which sessions to work and what invalidates the week
              </li>
            </ul>
          </div>
          <div className="stack">
            <span className="label">Example scenarios · EUR/USD</span>
            <div>
              <div className="scenario">
                <b className="up">Bull</b>
                <p>
                  H1 closes and holds above 1.1280, breaking the intraday bear
                  structure
                </p>
                <span className="num">→ 1.13310</span>
              </div>
              <div className="scenario">
                <b>Base</b>
                <p>
                  Rejection in the 1.1267–1.1280 band, then a grind back toward
                  the swing low
                </p>
                <span className="num">→ 1.12160</span>
              </div>
              <div className="scenario">
                <b className="down">Bear</b>
                <p>Daily close below 1.1216 with H1 holding lower highs</p>
                <span className="num">→ 1.11800</span>
              </div>
            </div>
            <span className="faint" style={{ fontSize: 12 }}>
              Illustrative.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      cadence: 'forever',
      blurb: 'The full signal feed on both pairs.',
      features: [
        'Every intraday signal, both pairs',
        'Weekend week-ahead outlook',
        'Economic calendar',
        '7-day signal history',
        'Personal trade journal',
      ],
      cta: 'Start free',
      primary: false,
    },
    {
      name: 'Pro',
      price: '$19',
      cadence: 'per month',
      blurb: 'For traders who want to judge the engine on its record.',
      features: [
        'Everything in Free',
        '365-day signal history',
        'Performance by pair and session',
        'Up to 200 history rows per query',
      ],
      cta: 'Start with Pro',
      primary: true,
    },
  ];
  return (
    <section className="lp-section" id="pricing">
      <div className="lp-container">
        <div className="lp-section-head">
          <div>
            <span className="lp-eyebrow">Pricing</span>
            <h2>Every signal is free. Pro is for the record.</h2>
          </div>
          <p>Upgrade or move back to Free at any time from your account.</p>
        </div>
        <div className="plans">
          {plans.map((plan) => (
            <div className="plan" key={plan.name}>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.cadence}</span>
              </div>
              <p>{plan.blurb}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Icon name="check" size={14} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`btn btn-lg ${plan.primary ? 'btn-primary' : 'btn-secondary'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    [
      'Is this financial advice?',
      'No. FXSignal is market context for research and education. It does not know your account, does not place trades and does not recommend buying or selling anything.',
    ],
    [
      'Why only two pairs?',
      'EUR/USD and USD/JPY are the deepest FX markets and are driven by three central banks whose calendars are easy to follow. A small watchlist keeps every call checkable.',
    ],
    [
      'How is the hit rate calculated?',
      'Only trades whose entry zone actually traded are scored. Reaching the target first is a hit, reaching the invalidation first is a miss, and a candle that touches both counts as a miss. Neutral calls and untriggered entries are listed but not scored.',
    ],
    [
      'Where does the data come from?',
      'Prices come from Twelve Data and the economic calendar from Trading Economics. If a provider is down, no signal is published for that window rather than an invented one.',
    ],
    [
      'What does "Model-reviewed" mean?',
      'The rule engine always runs. When enabled, a language model reviews its output with the same indicator data, may adjust it, and writes the session playbook. Its levels go through the same limits.',
    ],
    [
      'What happens on weekends?',
      'Spot FX closes Friday 22:00 UTC and reopens Sunday 22:00 UTC. Over the weekend each pair gets a week-ahead outlook instead of intraday signals.',
    ],
  ];
  return (
    <section className="lp-section" id="faq">
      <div className="lp-container">
        <div className="lp-section-head">
          <div>
            <span className="lp-eyebrow">FAQ</span>
            <h2>Questions</h2>
          </div>
        </div>
        <div className="lp-faq">
          {faqs.map(([q, a], index) => (
            <details key={q} open={index === 0}>
              <summary>
                {q}
                <Icon name="plus" size={16} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <Nav />
      <Hero />
      <Facts />
      <Method />
      <Anatomy />
      <Weekend />
      <Pricing />
      <Faq />
      <section className="lp-cta">
        <div className="lp-container">
          <h2>See the next window’s call before the London open.</h2>
          <p>Free account, both pairs, the full method.</p>
          <div className="lp-hero-ctas">
            <Link to="/register" className="btn btn-primary btn-lg">
              Create a free account
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Sign in
            </Link>
          </div>
        </div>
      </section>
      <footer className="lp-footer">
        <div className="lp-container">
          <div style={{ display: 'grid', gap: 10 }}>
            <Brand />
            <span>© {new Date().getFullYear()} FXSignal</span>
          </div>
          <nav aria-label="Footer">
            <Link to="/track-record">Track record</Link>
            <a href="#method">Method</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link to="/login">Sign in</Link>
          </nav>
          <p className="risk">
            Trading foreign exchange on margin carries a high level of risk and
            may not be suitable for all investors. FXSignal publishes
            algorithmic market analysis for research and education only. It is
            not investment advice, past results do not guarantee future results,
            and you are solely responsible for your trading decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}

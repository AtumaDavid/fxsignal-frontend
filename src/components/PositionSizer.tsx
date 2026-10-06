import { useEffect, useState } from 'react';
import { Select } from './ui/Select';
import { useDashboard } from '../lib/dashboard';
import type { Prediction } from '../lib/types';

type Currency = 'USD' | 'EUR' | 'JPY';

const CURRENCY_OPTIONS: { value: Currency; label: string; hint: string }[] = [
  { value: 'USD', label: 'USD', hint: 'US dollar' },
  { value: 'EUR', label: 'EUR', hint: 'Euro' },
  { value: 'JPY', label: 'JPY', hint: 'Yen' },
];

interface SizerPrefs {
  balance: string;
  riskPct: string;
  currency: Currency;
}

const PREF_KEY = 'fxsignal_sizer';
const DEFAULTS: SizerPrefs = {
  balance: '10000',
  riskPct: '1',
  currency: 'USD',
};
const LOT_UNITS = 100_000;

export function readSizerPrefs(): SizerPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SizerPrefs>) }
      : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Lot size for a signal from the saved balance / risk / currency.
 *
 * Pip value of one standard lot (100,000 units), in USD:
 *   EUR/USD → $10 (the quote currency is USD);
 *   USD/JPY → ¥1,000 per pip ÷ USD/JPY.
 * Converted to the account currency with the two pairs FXSignal already
 * prices (EUR via EUR/USD, JPY via USD/JPY). Rounded down to 0.01 lots so the
 * risk budget is never exceeded.
 */
export function sizeFor(
  prediction: Prediction,
  prefs: SizerPrefs,
  lastPrice: (pair: Prediction['pairCode']) => number | null
) {
  const mid = (prediction.entryLow + prediction.entryHigh) / 2;
  const quote = (pair: Prediction['pairCode']) =>
    pair === prediction.pairCode ? mid : lastPrice(pair);
  const eurusd = quote('EUR/USD');
  const usdjpy = quote('USD/JPY');
  const pipValueUsd =
    prediction.pairCode === 'EUR/USD' ? 10 : usdjpy ? 1000 / usdjpy : null;
  const toAccount =
    prefs.currency === 'USD'
      ? 1
      : prefs.currency === 'EUR'
        ? eurusd
          ? 1 / eurusd
          : null
        : usdjpy;
  const pipValueLot =
    pipValueUsd !== null && toAccount !== null ? pipValueUsd * toAccount : null;

  const balance = Number(prefs.balance);
  const riskPct = Number(prefs.riskPct);
  const stopPips = prediction.stopPips;
  const valid =
    Number.isFinite(balance) &&
    balance > 0 &&
    Number.isFinite(riskPct) &&
    riskPct > 0 &&
    riskPct <= 100;
  const riskAmount = valid ? (balance * riskPct) / 100 : null;
  const rawLots =
    riskAmount !== null && pipValueLot && stopPips
      ? riskAmount / (stopPips * pipValueLot)
      : null;
  const lots = rawLots === null ? null : Math.floor(rawLots * 100) / 100;
  return { valid, pipValueLot, riskAmount, lots, stopPips };
}

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}

/** Lot-size calculator for a signal; runs entirely in the browser. */
export function PositionSizer({ prediction }: { prediction: Prediction }) {
  const { data } = useDashboard();
  const [prefs, setPrefs] = useState<SizerPrefs>(readSizerPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {
      // Inputs reset next visit.
    }
  }, [prefs]);

  const { valid, pipValueLot, riskAmount, lots, stopPips } = sizeFor(
    prediction,
    prefs,
    (pair) => data?.prices.find((p) => p.pairCode === pair)?.price ?? null
  );
  const actualRisk =
    lots !== null && pipValueLot && stopPips
      ? lots * stopPips * pipValueLot
      : null;
  const reward =
    lots !== null && pipValueLot && prediction.targetPips
      ? lots * prediction.targetPips * pipValueLot
      : null;

  const set = (patch: Partial<SizerPrefs>) =>
    setPrefs((p) => ({ ...p, ...patch }));

  return (
    <div className="sizer">
      <div className="sizer-inputs">
        <label className="field">
          <span>Account balance</span>
          <div className="input-group">
            <input
              className="input"
              inputMode="decimal"
              value={prefs.balance}
              onChange={(e) =>
                set({ balance: e.target.value.replace(/[^\d.]/g, '') })
              }
              aria-label="Account balance"
            />
            <Select
              label="Account currency"
              value={prefs.currency}
              onChange={(currency) => set({ currency })}
              options={CURRENCY_OPTIONS}
              size="md"
              attached
              active={false}
              minWidth={140}
            />
          </div>
        </label>
        <label className="field">
          <span>Risk per trade</span>
          <div className="input-group">
            <input
              className="input"
              inputMode="decimal"
              value={prefs.riskPct}
              onChange={(e) =>
                set({ riskPct: e.target.value.replace(/[^\d.]/g, '') })
              }
              aria-label="Risk percent"
            />
            <span className="input-suffix">%</span>
          </div>
        </label>
      </div>

      {!valid ? (
        <p className="faint" style={{ fontSize: 12.5 }}>
          Enter a balance and a risk between 0 and 100%.
        </p>
      ) : pipValueLot === null || !stopPips ? (
        <p className="faint" style={{ fontSize: 12.5 }}>
          A current price is needed to convert pip value to {prefs.currency}; it
          appears once the market feed has data.
        </p>
      ) : (
        <>
          <div className="kv">
            <div>
              <span>Position size</span>
              <strong>
                {lots !== null && lots > 0
                  ? `${lots.toFixed(2)} lots`
                  : '< 0.01 lots'}
              </strong>
            </div>
            <div>
              <span>Units</span>
              <strong>
                {lots !== null && lots > 0
                  ? new Intl.NumberFormat('en-US').format(
                      Math.round(lots * LOT_UNITS)
                    )
                  : '—'}
              </strong>
            </div>
            <div>
              <span>Risk at stop ({stopPips.toFixed(1)}p)</span>
              <strong className="down">
                {actualRisk !== null && lots
                  ? money(actualRisk, prefs.currency)
                  : '—'}
              </strong>
            </div>
            <div>
              <span>Reward at target</span>
              <strong className="up">
                {reward !== null && lots ? money(reward, prefs.currency) : '—'}
              </strong>
            </div>
            <div>
              <span>Pip value (this size)</span>
              <strong>
                {lots ? money(lots * pipValueLot, prefs.currency) : '—'}
              </strong>
            </div>
            <div>
              <span>Risk budget</span>
              <strong>
                {riskAmount !== null ? money(riskAmount, prefs.currency) : '—'}
              </strong>
            </div>
          </div>
          {lots !== null && lots < 0.01 && (
            <p className="faint" style={{ fontSize: 12.5 }}>
              The risk budget is too small for a {stopPips.toFixed(1)}-pip stop
              at the 0.01-lot minimum. Raise the risk or skip this one.
            </p>
          )}
          <p className="faint" style={{ fontSize: 12 }}>
            Rounded down to 0.01 lots so the risk is never exceeded. Assumes a
            fill at the middle of the entry zone; spread and commission are not
            included.
          </p>
        </>
      )}
    </div>
  );
}

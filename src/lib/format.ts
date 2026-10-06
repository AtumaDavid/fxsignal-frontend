import { useEffect, useState } from 'react';
import type { Direction, PairCode } from './types';
import type { TimeZonePref } from './prefs';

export const PAIRS: PairCode[] = ['EUR/USD', 'USD/JPY'];

export const PAIR_NAMES: Record<PairCode, string> = {
  'EUR/USD': 'Euro / US Dollar',
  'USD/JPY': 'US Dollar / Japanese Yen',
};

const PIP: Record<PairCode, number> = { 'EUR/USD': 0.0001, 'USD/JPY': 0.01 };

/** Prices at quote precision: 5 decimals for EUR/USD, 3 for USD/JPY. */
export function price(pair: PairCode, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—';
  return value.toFixed(pair === 'EUR/USD' ? 5 : 3);
}

export function pipsBetween(pair: PairCode, a: number, b: number) {
  return (a - b) / PIP[pair];
}

export function signedPips(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}`;
}

export function signedPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function directionLabel(direction: Direction) {
  return direction === 'LONG'
    ? 'Long'
    : direction === 'SHORT'
      ? 'Short'
      : 'Neutral';
}

/** Label for a published call: a hold manages an earlier open trade. */
export function callLabel(p: {
  direction: Direction;
  continuesId?: string | null;
}) {
  return p.continuesId ? 'Hold' : directionLabel(p.direction);
}

export function directionTone(direction: Direction | 'BULLISH' | 'BEARISH') {
  return direction === 'LONG' || direction === 'BULLISH'
    ? 'up'
    : direction === 'SHORT' || direction === 'BEARISH'
      ? 'down'
      : 'flat';
}

function tzOption(tz: TimeZonePref) {
  return tz === 'utc' ? { timeZone: 'UTC' } : {};
}

export function tzLabel(tz: TimeZonePref) {
  if (tz === 'utc') return 'UTC';
  const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? 'local';
}

export function time(value: string | Date, tz: TimeZonePref) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...tzOption(tz),
  }).format(new Date(value));
}

export function dayDate(value: string | Date, tz: TimeZonePref) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...tzOption(tz),
  }).format(new Date(value));
}

export function dateTime(value: string | Date, tz: TimeZonePref) {
  return `${dayDate(value, tz)}, ${time(value, tz)}`;
}

export function longDate(value: Date, tz: TimeZonePref) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...tzOption(tz),
  }).format(value);
}

/** "2h 05m", "3d 4h", "12m" — for countdowns. */
export function duration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

export function relative(value: string, now = Date.now()) {
  const diff = new Date(value).getTime() - now;
  const label = duration(Math.abs(diff));
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

/** Re-renders every `intervalMs` and returns the current timestamp. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** A UTC hour of today as a clock time in the given zone, e.g. 7 → "08:00". */
export function utcHourAs(hour: number, tz: TimeZonePref) {
  const d = new Date();
  d.setUTCHours(hour % 24, 0, 0, 0);
  return time(d, tz);
}

/** "07:00 – 10:00" for a UTC hour range, in the chosen zone. */
export function hourRange(start: number, end: number, tz: TimeZonePref) {
  return `${utcHourAs(start, tz)} – ${utcHourAs(end, tz)}`;
}

/** True when the browser's zone is currently offset from UTC. */
export function localDiffersFromUtc() {
  return new Date().getTimezoneOffset() !== 0;
}

import { useEffect, useMemo, useState } from 'react';
import { EventRow } from '../../components/Market';
import { Empty } from '../../components/ui/Empty';
import { getEvents } from '../../lib/api';
import { longDate, tzLabel } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import type { MarketEvent } from '../../lib/types';

type ImpactFilter = 'ALL' | 'MEDIUM' | 'HIGH';
const CURRENCIES = ['USD', 'EUR', 'JPY'] as const;

export default function Calendar() {
  const { timeZone } = usePrefs();
  const [events, setEvents] = useState<MarketEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactFilter>('MEDIUM');
  const [currency, setCurrency] = useState<'ALL' | (typeof CURRENCIES)[number]>(
    'ALL'
  );

  useEffect(() => {
    const controller = new AbortController();
    getEvents(controller.signal)
      .then(setEvents)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'The calendar is unavailable.'
          );
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const filtered = (events ?? []).filter(
      (e) =>
        (impact === 'ALL' ||
          (impact === 'HIGH' ? e.impact === 'HIGH' : e.impact !== 'LOW')) &&
        (currency === 'ALL' || e.currency === currency)
    );
    const byDay = new Map<string, MarketEvent[]>();
    for (const event of filtered) {
      const key = longDate(new Date(event.eventDate), timeZone);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
    return [...byDay.entries()];
  }, [events, impact, currency, timeZone]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>
            Scheduled releases for the three currencies behind EUR/USD and
            USD/JPY. High-impact events inside a signal window lower that
            signal's confidence.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="toolbar">
          <div className="segmented" aria-label="Impact">
            {(
              [
                ['ALL', 'All'],
                ['MEDIUM', 'Medium +'],
                ['HIGH', 'High only'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={impact === key}
                onClick={() => setImpact(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="Currency">
            {(['ALL', ...CURRENCIES] as const).map((key) => (
              <button
                key={key}
                aria-pressed={currency === key}
                onClick={() => setCurrency(key)}
              >
                {key === 'ALL' ? 'All' : key}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <span className="toolbar-note">Times in {tzLabel(timeZone)}</span>
        </div>

        {events === null && !error ? (
          <div className="panel-body stack">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 36 }} />
            ))}
          </div>
        ) : error ? (
          <Empty icon="calendar" title="Calendar unavailable">
            {error}
          </Empty>
        ) : groups.length === 0 ? (
          <Empty icon="calendar" title="No upcoming events">
            {events && events.length > 0
              ? 'Nothing matches these filters. Try including lower-impact releases.'
              : 'The calendar fills from the economic data provider once it is connected and returning events.'}
          </Empty>
        ) : (
          groups.map(([day, items]) => (
            <div className="day-group" key={day}>
              <div className="day-label">{day}</div>
              <div className="rows">
                {items.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

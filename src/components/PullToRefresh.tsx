import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/** How far (px, after resistance) the page must be pulled to refresh. */
const TRIGGER = 70;
const MAX = 110;

/**
 * Pull-to-refresh for touch screens. Installed apps (Home Screen) lose the
 * browser's own pull-to-refresh, so the app provides it: pull down from the
 * very top of the page and release to reload.
 * Ignored inside scrolling panels, drawers, charts and form fields.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const ignore = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          '.drawer, .bell-panel, .modal, canvas, input, textarea, select, [data-no-ptr]'
        )
      );

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || ignore(e.target)) {
        start.current = null;
        return;
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      distance.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      // Only a mostly-vertical pull from the very top counts.
      if (dy <= 0 || window.scrollY > 0 || dx > dy) {
        if (distance.current) setPull(0);
        distance.current = 0;
        return;
      }
      distance.current = Math.min(MAX, dy * 0.5); // resistance
      setPull(distance.current);
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      if (distance.current >= TRIGGER) {
        setRefreshing(true);
        setPull(TRIGGER);
        window.location.reload();
        return;
      }
      distance.current = 0;
      setPull(0);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      className="ptr"
      style={{ transform: `translate(-50%, ${pull - 44}px)` }}
      role="status"
      aria-live="polite"
    >
      <span
        className={`ptr-icon${refreshing ? ' spinning' : ''}`}
        style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
      >
        <Icon name="refresh" size={16} />
      </span>
      <span>
        {refreshing
          ? 'Refreshing…'
          : ready
            ? 'Release to refresh'
            : 'Pull to refresh'}
      </span>
    </div>
  );
}

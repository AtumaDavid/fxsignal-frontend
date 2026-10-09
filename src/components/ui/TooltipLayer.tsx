import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Tip {
  text: string;
  left: number;
  top: number;
  below: boolean;
}

const DELAY_MS = 350;
const GAP = 8;
const MAX_WIDTH = 260;

/**
 * One tooltip for the whole app: any element with a `data-tip` attribute
 * explains itself on mouse hover (after a short delay) or keyboard focus.
 * Rendered in a portal and clamped to the viewport, so it is never clipped
 * by panels, tables or the drawer. Touch devices use the tap "?" tips.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const place = (el: Element) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      const rect = el.getBoundingClientRect();
      const below = rect.top < 72;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, MAX_WIDTH / 2 + 8),
        window.innerWidth - MAX_WIDTH / 2 - 8
      );
      setTip({
        text,
        left,
        top: below ? rect.bottom + GAP : rect.top - GAP,
        below,
      });
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const el =
        (event.target as Element | null)?.closest?.('[data-tip]') ?? null;
      if (el === current.current) return;
      window.clearTimeout(timer.current);
      current.current = el;
      setTip(null);
      if (el) timer.current = window.setTimeout(() => place(el), DELAY_MS);
    };
    const onFocus = (event: FocusEvent) => {
      const el =
        (event.target as Element | null)?.closest?.('[data-tip]') ?? null;
      if (!el) return;
      current.current = el;
      place(el);
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      className={`tooltip${tip.below ? ' below' : ''}`}
      role="tooltip"
      style={{ left: tip.left, top: tip.top, maxWidth: MAX_WIDTH }}
    >
      {tip.text}
    </div>,
    document.body
  );
}

import { useEffect, useId, useRef, useState } from 'react';

/** A small "?" that explains a term. Click or tap to open; works on mobile. */
export function InfoTip({
  children,
  label,
}: {
  children: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !wrap.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className="tip" ref={wrap}>
      <button
        type="button"
        className="tip-btn"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open && (
        <span className="tip-pop" role="tooltip" id={id}>
          {children}
        </span>
      )}
    </span>
  );
}

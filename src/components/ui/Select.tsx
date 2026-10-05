import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Secondary text on the right of the option, e.g. a time range. */
  hint?: string;
}

interface Position {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MENU_GAP = 6;
const MENU_MAX = 300;

/**
 * Custom select (WAI-ARIA listbox pattern): a button that opens a menu in a
 * portal, so it is never clipped by a scrolling drawer or table. Keyboard:
 * ↑/↓ move, Home/End jump, Enter/Space choose, Esc/Tab close, letters jump
 * to the next matching option.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
  attached = false,
  active,
  minWidth,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Accessible name; also the menu heading. */
  label: string;
  size?: 'sm' | 'md';
  /** Joined to the input on its left (input groups). */
  attached?: boolean;
  /** Highlight as an applied filter. Defaults to "not the first option". */
  active?: boolean;
  minWidth?: number;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const typeahead = useRef({ text: '', at: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];
  const isActive = active ?? selectedIndex > 0;

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - MENU_GAP - 8;
    const above = rect.top - MENU_GAP - 8;
    const wanted = Math.min(MENU_MAX, options.length * 34 + 10);
    const width = Math.max(rect.width, minWidth ?? 180);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    // Open upward only when there is clearly more room there.
    setPosition(
      below >= wanted || below >= above
        ? {
            left,
            width,
            top: rect.bottom + MENU_GAP,
            maxHeight: Math.min(MENU_MAX, below),
          }
        : {
            left,
            width,
            bottom: window.innerHeight - rect.top + MENU_GAP,
            maxHeight: Math.min(MENU_MAX, above),
          }
    );
  }, [options.length, minWidth]);

  const openMenu = useCallback(() => {
    setHighlight(selectedIndex);
    place();
    setOpen(true);
  }, [place, selectedIndex]);

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && option.value !== value) onChange(option.value);
      close();
    },
    [options, value, onChange, close]
  );

  // Focus the list on open and keep the highlighted option in view.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  // Close on outside press; follow the button when the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      )
        return;
      close(false);
    };
    const onMove = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close, place]);

  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKey(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlight((h) => Math.min(last, h + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case 'Home':
        event.preventDefault();
        setHighlight(0);
        break;
      case 'End':
        event.preventDefault();
        setHighlight(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(highlight);
        break;
      case 'Escape':
        event.preventDefault();
        // Don't let a surrounding drawer or dialog close too.
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const now = Date.now();
          const ta = typeahead.current;
          ta.text =
            now - ta.at < 600
              ? ta.text + event.key.toLowerCase()
              : event.key.toLowerCase();
          ta.at = now;
          const start = ta.text.length > 1 ? highlight : highlight + 1;
          for (let i = 0; i < options.length; i += 1) {
            const index = (start + i) % options.length;
            if (options[index].label.toLowerCase().startsWith(ta.text)) {
              setHighlight(index);
              break;
            }
          }
        }
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`dd-trigger dd-${size}${attached ? ' dd-attached' : ''}${isActive ? ' dd-active' : ''}${open ? ' dd-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
      >
        <span className="dd-value">{selected?.label}</span>
        <Icon name="chevron" size={14} className="dd-chevron" />
      </button>
      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            className="dd-menu"
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-opt-${highlight}`}
            onKeyDown={onListKey}
            style={{
              left: position.left,
              // A floor, not a cap: long labels widen the menu instead of truncating.
              minWidth: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`dd-option${index === highlight ? ' dd-highlight' : ''}`}
                  onPointerMove={() => setHighlight(index)}
                  onClick={() => choose(index)}
                >
                  <span className="dd-check" aria-hidden="true">
                    {isSelected && <Icon name="check" size={13} />}
                  </span>
                  <span className="dd-label">{option.label}</span>
                  {option.hint && (
                    <span className="dd-hint">{option.hint}</span>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}

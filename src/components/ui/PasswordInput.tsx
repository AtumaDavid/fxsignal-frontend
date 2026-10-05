import { useId, useState } from 'react';

function strength(value: string) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.max(1, score);
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder,
  showStrength = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  showStrength?: boolean;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();
  const score = strength(value);
  return (
    <>
      <div className="password-field">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={showStrength ? hintId : undefined}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {showStrength && value && (
        <>
          <div className={`strength s${score}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <small id={hintId}>
            {value.length < 8
              ? `${8 - value.length} more characters needed`
              : `${LABELS[score]} password`}
          </small>
        </>
      )}
    </>
  );
}

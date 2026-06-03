'use client';

import { Eye, EyeOff } from '@untitledui/icons';
import { useState, type ChangeEvent, type CSSProperties } from 'react';

// Webflow-styled password input with an integrated show/hide eyeball toggle.
// Keeps the existing Speevy form-field look (the `formfields w-input` /
// `textfield w-input` classes) so it is visually identical to the plain
// password inputs it replaces, just with an eye/eye-off button on the right.
//
// Visibility is local UI state only: toggling flips the rendered input between
// `type="password"` and `type="text"`. It never transmits or stores anything
// extra, and it only ever reveals whatever value is currently in the field.
//
// `showToggle` lets callers suppress the eye when there is nothing real to
// reveal (e.g. the opportunity editor's "a password is set" placeholder, which
// is just masking glyphs standing in for a server-side hash). When suppressed,
// the field is always rendered as `type="password"` regardless of prior toggle
// state, so the placeholder glyphs can never be exposed as if they were a value.

type WebflowPasswordFieldProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  dataName?: string;
  showToggle?: boolean;
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
};

const toggleStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: 12,
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  margin: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  lineHeight: 0,
};

const iconStyle: CSSProperties = {
  width: 18,
  height: 18,
};

// Leave room on the right so typed text never slides under the toggle button.
const inputStyle: CSSProperties = {
  paddingRight: 40,
};

export function WebflowPasswordField({
  value,
  onChange,
  name,
  id,
  placeholder,
  className = 'formfields w-input',
  maxLength = 256,
  required = false,
  autoComplete = 'off',
  disabled = false,
  dataName,
  showToggle = true,
}: WebflowPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  // Only reveal when a toggle is actually offered; otherwise a stale `visible`
  // could expose placeholder glyphs once the toggle is hidden.
  const revealed = visible && showToggle;

  return (
    <div style={wrapperStyle}>
      <input
        className={className}
        style={showToggle ? inputStyle : undefined}
        maxLength={maxLength}
        name={name}
        id={id}
        data-name={dataName}
        placeholder={placeholder}
        type={revealed ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
      {showToggle ? (
        <button
          type="button"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          onClick={() => setVisible((current) => !current)}
          style={toggleStyle}
        >
          {revealed ? <EyeOff style={iconStyle} /> : <Eye style={iconStyle} />}
        </button>
      ) : null}
    </div>
  );
}

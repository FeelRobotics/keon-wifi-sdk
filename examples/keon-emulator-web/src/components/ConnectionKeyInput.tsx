import { useRef } from 'react';
import { useAppStore } from '@/store/appStore';

const KEY_LENGTH = 8;

/**
 * Device Connection Key input with automatic uppercase conversion.
 * Enforces exactly 8 characters (base-31 format from the OAuth server).
 */
export function ConnectionKeyInput() {
  const key = useAppStore((s) => s.deviceConnectionKey);
  const setKey = useAppStore((s) => s.setDeviceConnectionKey);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase().slice(0, KEY_LENGTH);
    setKey(upper);
  };

  const handleUse = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // The key is already in the store; "Use" triggers any downstream effects via the store.
    // Parent (App) reads deviceConnectionKey from store on provisioning calls.
  };

  const isValid = key.length === KEY_LENGTH;

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="dck-input">
        Device Connection Key
      </label>
      <div className="input-row">
        <input
          id="dck-input"
          ref={inputRef}
          type="text"
          className={`form-input monospace ${isValid ? 'valid' : ''}`}
          value={key}
          onChange={handleChange}
          maxLength={KEY_LENGTH}
          placeholder="8 characters"
          spellCheck={false}
          autoCapitalize="characters"
          aria-label="Device Connection Key (8 uppercase characters)"
        />
        <button
          className="btn btn-secondary"
          onClick={handleUse}
          disabled={!isValid}
          title={isValid ? 'Apply this connection key' : `Key must be exactly ${KEY_LENGTH} characters`}
        >
          Use
        </button>
      </div>
      {key.length > 0 && !isValid && (
        <span className="form-hint">
          {KEY_LENGTH - key.length} character{KEY_LENGTH - key.length !== 1 ? 's' : ''} remaining
        </span>
      )}
    </div>
  );
}

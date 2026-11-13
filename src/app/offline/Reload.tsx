'use client';

/** Once the connection is back, one tap tries the page again. */
export function Reload() {
  return (
    <button type="button" onClick={() => window.location.reload()} className="btn-primary pressable mt-7">
      Try again
    </button>
  );
}

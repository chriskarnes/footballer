import { startTransition } from 'react';

/** A labelled form field in the app's text-field style, with an optional hint under it. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-field">
      <span>{label}</span>
      {children}
      {hint && <small className="mt-1.5 block text-body-sm text-on-surface-variant">{hint}</small>}
    </label>
  );
}

/** What the server action said went wrong, if it did. */
export function FormError({ error }: { error?: string | null }) {
  return error ? <p role="alert" className="text-body font-semibold text-on-surface">{error}</p> : null;
}

/**
 * A form's onSubmit that sends it to a useActionState action without React
 * resetting it. <form action={fn}> clears every field after each submit, even
 * one that comes back with an error, so a trainer fixing a bad video link lost
 * the name and notes they'd typed.
 */
export function keepOnError(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(fd));
  };
}

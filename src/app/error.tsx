'use client';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * When a page or a tap fails outright (no signal mid-request, a server
 * hiccup), this replaces Next's bare "Application error" screen. It keeps the
 * app's frame around it, says what to do, and offers the two ways out.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="animate-pop pt-6">
      <p className="eyebrow mb-3">{offline ? 'No signal' : 'Something went wrong'}</p>
      <h1 className="h-page">{offline ? 'You’re offline' : 'That didn’t load'}</h1>
      <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
        {offline
          ? 'Nothing you’ve done is lost. Try again when you have signal.'
          : 'It’s probably nothing you did. Try again, and if it keeps happening, go back to Train.'}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={() => retry()} className="btn-primary btn-big pressable w-full">Try again</button>
        <Link href="/" className="btn-ghost pressable min-h-13 w-full">Back to Train</Link>
      </div>
    </div>
  );
}

import { Brand } from '@/components/Brand';

/**
 * Served by the service worker when a navigation fails with no connection.
 * Kept static and dependency-free so it is always in the cache.
 */
export default function Offline() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <Brand />
      <h1 className="h-page mt-8">You&rsquo;re offline</h1>
      <p className="mt-2.5 text-body-lg leading-relaxed text-on-surface-variant">
        The app needs a connection to load a new session. Anything already open keeps
        working — including the drill you&rsquo;re in the middle of.
      </p>
      {/* A plain link to this same address, not a script: this page is served
          from the cache, and its scripts may not be, so a button that needed
          them did nothing. */}
      <a href="" className="btn-primary pressable mt-7">Try again</a>
    </div>
  );
}

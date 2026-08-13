import { Brand } from '@/components/Brand';

/**
 * Served by the service worker when a navigation fails with no connection.
 * Kept static and dependency-free so it is always in the cache.
 */
export default function Offline() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <Brand />
      <h1 className="h-page mt-8">You&apos;re offline</h1>
      <p className="mt-2.5 max-w-xs text-[14.5px] leading-relaxed text-on-surface-variant">
        Train.futbol needs a connection to load a new session. Anything already open keeps
        working — including the drill you&apos;re in the middle of.
      </p>
      <p className="mt-6 text-[13px] font-semibold text-on-surface-variant">
        Reconnect and pull down to reload.
      </p>
    </div>
  );
}

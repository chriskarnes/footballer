'use client';
import { useEffect, useState } from 'react';
import { finishSetup, saveYou } from '@/app/coach/setup/actions';

/**
 * Setup step one, inline: the owner's name as players see it, and the
 * academy's time zone. A new academy's zone is the default, New York, so
 * until they've saved this it starts at the zone their browser is in.
 */
export function SetupYou({ name, timeZone, fresh }: { name: string; timeZone: string; fresh: boolean }) {
  const [n, setN] = useState(name);
  const [tz, setTz] = useState(timeZone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // The full list after mount: the server's and the browser's can differ,
  // and a <select> that differs breaks hydration.
  const [zones, setZones] = useState<string[]>([timeZone]);
  useEffect(() => {
    const all = Intl.supportedValuesOf('timeZone');
    setZones(all.includes(timeZone) ? all : [timeZone, ...all]);
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (fresh && mine && all.includes(mine)) setTz(mine);
  }, [fresh, timeZone]);

  return (
    <form className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setErr('');
            const r = await saveYou(n, tz);
            setBusy(false);
            if (!r.ok) setErr(r.error);
          }}>
      <label className="block">
        <span className="text-[14px] font-bold text-on-surface">Your name</span>
        <span className="mt-0.5 block text-[14px] text-on-surface-variant">Players see your first name: &ldquo;Mike is getting your training ready.&rdquo;</span>
        <input value={n} onChange={(e) => setN(e.target.value)} required maxLength={60} autoComplete="name"
               className="mt-2 min-h-12 w-full rounded-xl border border-outline bg-transparent px-3.5 text-[16px] font-semibold text-on-surface outline-none focus:border-on-surface" />
      </label>
      <label className="block">
        <span className="text-[14px] font-bold text-on-surface">Your time zone</span>
        <span className="mt-0.5 block text-[14px] text-on-surface-variant">Your players&rsquo; weeks start on Monday here.</span>
        <select value={tz} onChange={(e) => setTz(e.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-outline bg-transparent px-3 text-[15px] font-semibold text-on-surface outline-none focus:border-on-surface">
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy} className="btn-primary pressable w-full">
        {busy ? 'Saving…' : 'Save'}
      </button>
      {err && <p role="status" className="text-[14px] font-semibold text-on-surface">{err}</p>}
    </form>
  );
}

/** The last step's button: lists the academy and puts the checklist away. */
export function FinishSetup({ name, ready }: { name: string; ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mt-4">
      <button type="button" disabled={!ready || busy} className="btn-primary btn-big pressable w-full disabled:opacity-40"
              onClick={async () => {
                setBusy(true); setErr('');
                const r = await finishSetup();
                setBusy(false);
                if (r && !r.ok) setErr(r.error);
              }}>
        {busy ? 'One moment…' : `Open ${name}`}
      </button>
      <p className="mt-2 text-[14px] text-on-surface-variant">
        {ready ? 'Players can then find you by name in Find your trainer.' : 'Finish steps 1 to 4 first.'}
      </p>
      {err && <p role="status" className="mt-2 text-[14px] font-semibold text-on-surface">{err}</p>}
    </div>
  );
}

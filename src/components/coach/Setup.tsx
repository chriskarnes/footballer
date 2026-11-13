'use client';
import { useEffect, useState } from 'react';
import { finishSetup, saveYou, setListed } from '@/app/coach/setup/actions';

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
      {/* The app's text field, with its focus ring, like every other form. */}
      <label className="text-field">
        <span>Your name</span>
        <input value={n} onChange={(e) => setN(e.target.value)} required maxLength={60} autoComplete="name" />
        <small className="mt-1.5 block text-body text-on-surface-variant">Players see your first name: &ldquo;Mike is getting your training ready.&rdquo;</small>
      </label>
      <label className="text-field">
        <span>Your time zone</span>
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </select>
        <small className="mt-1.5 block text-body text-on-surface-variant">Your players&rsquo; weeks start on Monday here.</small>
      </label>
      <button type="submit" disabled={busy} className="btn-primary pressable w-full">
        {busy ? 'Saving…' : 'Save'}
      </button>
      {err && <p role="alert" className="text-body font-semibold text-on-surface">{err}</p>}
    </form>
  );
}

/** The last step's button: puts the checklist away and, if they want, lists the academy. */
export function FinishSetup({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [listed, setListedOn] = useState(true);
  return (
    <div className="mt-4">
      <Listing on={listed} onChange={setListedOn} />
      <button type="button" disabled={!ready || busy} className="btn-primary btn-big pressable mt-4 w-full"
              onClick={async () => {
                setBusy(true); setErr('');
                const r = await finishSetup(listed);
                setBusy(false);
                if (r && !r.ok) setErr(r.error);
              }}>
        {busy ? 'One moment…' : 'Finish setup'}
      </button>
      {!ready && <p className="mt-2 text-body text-on-surface-variant">Finish steps 1 to 4 first.</p>}
      {err && <p role="alert" className="mt-2 text-body font-semibold text-on-surface">{err}</p>}
    </div>
  );
}

/** Whether the academy is in Find your trainer, once setup is done: saves on tap. */
export function ListedSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Listing on={on} disabled={busy} onChange={async (next) => {
        setOn(next); setBusy(true); setErr('');
        const r = await setListed(next);
        setBusy(false);
        if (!r.ok) { setOn(!next); setErr(r.error); }
      }} />
      {err && <p role="alert" className="mt-2 text-body font-semibold text-on-surface">{err}</p>}
    </div>
  );
}

function Listing({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
             className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
      <span>
        <span className="block text-body font-semibold text-on-surface">Show in Find your trainer</span>
        <span className="block text-body text-on-surface-variant">
          {on ? 'Players can find you by name, then ask to join.' : 'Only players with your invite link can join.'}
        </span>
      </span>
    </label>
  );
}

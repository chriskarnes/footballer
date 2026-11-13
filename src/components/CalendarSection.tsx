'use client';
import { useEffect, useState } from 'react';
import { Chip, CheckIcon } from './Chip';
import { ConfirmSheet } from './ConfirmSheet';

export type CalendarFeed = {
  token: string; include_plan: boolean; include_speed: boolean;
  start_time: string | null; time_zone: string;
};

const zone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

/**
 * Training in the player's own calendar, as a subscription: one tap in Apple
 * or Google Calendar and the days fill themselves in, then tick as sessions
 * are finished.
 *
 * Nothing new is asked to turn it on — the plan and the speed year already
 * say which days. The two settings are what to include and whether sessions
 * are all-day banners (the default, since most players train "after school
 * sometime") or start at a set time. The zone is the device's, sent with
 * every change, so a timed 5 pm stays 5 pm where the player is.
 */
export function CalendarSection({ initial, speed = true, plan = true }: {
  initial: CalendarFeed | null;
  /** Whether they have Plan (the weekly plan is built from the drill library). */
  plan?: boolean;
  /** Whether they get Speed & Stamina: off when their trainer has it off. */
  speed?: boolean;
}) {
  const [feed, setFeed] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'off' | null>(null);
  // The site's own origin, read after mount — this also renders on the server.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  async function call(method: string, body?: object) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/calendar', {
        method, headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Couldn’t save that. Try again.');
      return j;
    } catch (e: any) {
      setErr(e instanceof Error && !(e instanceof TypeError) && e.message ? e.message : 'Couldn’t save that. Try again.'); return null;
    } finally { setBusy(false); }
  }

  const update = async (patch: Partial<CalendarFeed>) => {
    if (!feed) return;
    setFeed({ ...feed, ...patch }); // optimistic; the response replaces it
    const j = await call('PATCH', { ...patch, time_zone: zone() });
    if (j) setFeed(j); else setFeed(feed);
  };

  if (!feed) {
    return (
      <section className="mt-10">
        <h2 className="h-sec mb-3">Calendar</h2>
        <div className="card p-5">
          <div className="h-card">Put your training in your calendar</div>
          <p className="mt-1 text-body leading-snug text-on-surface-variant">
            {speed ? 'Your plan and speed sessions appear' : 'Your sessions appear'} on the right days in Apple or Google Calendar, and
            tick off as you finish them.
          </p>
          <button type="button" disabled={busy} className="btn-ghost pressable mt-4 w-full"
                  onClick={async () => { const j = await call('POST', { time_zone: zone() }); if (j) setFeed(j); }}>
            {busy ? 'One moment…' : 'Add to my calendar'}
          </button>
          {err && <p role="status" className="mt-2 text-body-sm font-semibold text-error">Couldn&rsquo;t turn it on: {err}</p>}
        </div>
      </section>
    );
  }

  const https = `${origin}/cal/${feed.token}.ics`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const timed = feed.start_time !== null;

  return (
    <section className="mt-9">
      <h2 className="h-sec mb-3">Calendar</h2>
      <div className="card p-5">
        <div className="h-card">Subscribe</div>
        <p className="mt-1 text-body leading-snug text-on-surface-variant">
          Add it once. Apple Calendar picks up changes within the hour; Google can take up to a day.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <a href={webcal} className="btn-primary btn-sm pressable">Apple Calendar</a>
          <a href={google} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm pressable">Google Calendar</a>
        </div>
        <button type="button" className="btn-ghost btn-sm pressable mt-2.5 w-full"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(https); setCopied(true); setTimeout(() => setCopied(false), 2000); }
                  catch { setErr('Couldn’t copy — long-press the Apple button instead.'); }
                }}>
          {copied ? 'Copied' : 'Copy link (Outlook, others)'}
        </button>

        {(plan || speed) && <>
        <p className="mb-2.5 mt-6 text-body font-bold text-on-surface">Include</p>
        <div className="flex flex-wrap gap-2">
          {plan && <Chip on={feed.include_plan} onClick={() => update({ include_plan: !feed.include_plan })}>Weekly plan</Chip>}
          {speed && <Chip on={feed.include_speed} onClick={() => update({ include_speed: !feed.include_speed })}>Speed &amp; Stamina</Chip>}
        </div>
        </>}

        <p className="mb-2.5 mt-6 text-body font-bold text-on-surface">Show sessions</p>
        <div className="segmented" role="radiogroup" aria-label="Show sessions">
          <button type="button" role="radio" aria-checked={!timed} onClick={() => update({ start_time: null })}
                  className={`segment pressable ${!timed ? 'segment-on' : ''}`}>
            <CheckIcon className="seg-check" />All day
          </button>
          <button type="button" role="radio" aria-checked={timed} onClick={() => !timed && update({ start_time: '17:00' })}
                  className={`segment pressable ${timed ? 'segment-on' : ''}`}>
            <CheckIcon className="seg-check" />At a time
          </button>
        </div>
        {timed && (
          <label className="text-field mt-3">
            <input type="time" value={feed.start_time ?? '17:00'} step={900} aria-label="Start time"
                   onChange={(e) => e.target.value && setFeed({ ...feed, start_time: e.target.value })}
                   onBlur={(e) => e.target.value && update({ start_time: e.target.value })} />
          </label>
        )}
        <p className="mt-2 text-caption text-on-surface-variant">
          {timed
            ? 'Each session starts then and lasts as long as it takes. Two on one day run back to back.'
            : 'Each session sits at the top of its day, without blocking any time.'}
        </p>

        {err && <p role="status" className="mt-3 text-body-sm font-semibold text-error">{err}</p>}

        <div className="mt-6 flex gap-5 border-t border-outline-variant pt-4 text-body-sm font-semibold text-on-surface-variant">
          <button type="button" className="underline underline-offset-4" onClick={() => setConfirm('reset')}>Reset link</button>
          <button type="button" className="underline underline-offset-4" onClick={() => setConfirm('off')}>Turn off</button>
        </div>
      </div>

      <ConfirmSheet open={confirm === 'reset'} title="Reset your calendar link?" busy={busy}
        body="The old link stops working. Calendars subscribed to it go empty until you subscribe again with the new one."
        confirmLabel="Reset link" onCancel={() => setConfirm(null)}
        onConfirm={async () => { const j = await call('POST', { reset: true }); if (j) setFeed(j); setConfirm(null); }} />
      <ConfirmSheet open={confirm === 'off'} title="Turn off the calendar?" busy={busy}
        body="The link stops working and your sessions leave any calendar subscribed to it."
        confirmLabel="Turn off" onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (await call('DELETE')) setFeed(null); setConfirm(null); }} />
    </section>
  );
}

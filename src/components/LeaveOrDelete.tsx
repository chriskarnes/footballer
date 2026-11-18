'use client';
import { useState } from 'react';
import { deleteAccount, leaveAcademy } from '@/app/me/account-actions';
import { browserClient } from '@/lib/supabase/client';
import { notePageCacheUser } from '@/lib/page-cache';
import { pendingFinish, pendingPlan, pendingWorkout } from '@/lib/pending';
import { offline } from '@/lib/plain-error';
import { ConfirmSheet } from './ConfirmSheet';

const ROW = 'pressable flex min-h-14 w-full items-center px-4 text-left text-body-lg font-bold text-on-surface';

/**
 * The two ways out that aren't signing out: leaving this academy, and
 * deleting the account altogether. Each says what goes and what stays
 * before anything happens, and deleting says it can't be undone. At the
 * bottom of My profile.
 */
export function LeaveOrDelete({ academy, owner }: {
  /** The academy this page is on, when the player or trainer is in it. */
  academy?: string | null;
  /** They own it: neither leaving nor deleting, until it's handed over. */
  owner?: boolean;
}) {
  const [asking, setAsking] = useState<'leave' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Something to read after the account has gone (a card payment that
  // couldn't be stopped): shown here until they tap OK, then the page goes.
  const [note, setNote] = useState('');

  async function go() {
    const what = asking;
    if (!what) return;
    setBusy(true); setErr('');
    const r = await (what === 'leave' ? leaveAcademy() : deleteAccount()).catch(offline);
    setBusy(false); setAsking(null);
    if (!r.ok) { setErr(r.error); return; }
    if (what === 'delete') {
      // The account is gone; so is everything of theirs on this phone.
      try { await browserClient().auth.signOut({ scope: 'local' }); } catch { /* nothing left to sign out of */ }
      pendingWorkout.clear(); pendingPlan.clear(); pendingFinish.clear();
      await notePageCacheUser(null);
      // Read before the page goes: there's no account left to tell later.
      if ('note' in r && r.note) { setNote(r.note); return; }
    }
    // A full load: every page behind this one was drawn for a member.
    window.location.assign(what === 'delete' ? '/' : '/me');
  }

  // In the app's own words and type, not the browser's alert, which on a
  // phone is a system box that looks like nothing else here.
  if (note) {
    return (
      <div role="alert" className="p-4">
        <p className="text-body font-semibold leading-snug text-on-surface">{note}</p>
        <button type="button" className="btn-primary pressable mt-4 w-full" onClick={() => window.location.assign('/')}>OK</button>
      </div>
    );
  }

  return (
    <>
      {academy && !owner && (
        <button type="button" className={ROW} onClick={() => { setErr(''); setAsking('leave'); }}>Leave {academy}</button>
      )}
      <button type="button" className={ROW} onClick={() => { setErr(''); setAsking('delete'); }}>Delete my account</button>
      {err && <p role="alert" className="px-4 py-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      <ConfirmSheet open={asking === 'leave'} busy={busy} title={`Leave ${academy ?? 'this academy'}?`} confirmLabel="Leave"
        body={`You’ll stop getting sessions and notes from ${academy ?? 'this academy'}. What you’ve done stays.`}
        onCancel={() => setAsking(null)} onConfirm={go} />
      <ConfirmSheet open={asking === 'delete'} busy={busy} title="Delete your account?" confirmLabel="Delete"
        body={owner
          ? 'You own an academy, so this can’t be done yet: its players would be left with nobody. Ask us to hand it over or close it first.'
          : 'This deletes your sign-in and everything kept under it: your profile and photo, your training history, your weeks, your calendar link, and your place in any academy. It can’t be undone.'}
        onCancel={() => setAsking(null)} onConfirm={go} />
    </>
  );
}

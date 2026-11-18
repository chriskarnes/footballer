'use client';
import Link from 'next/link';
import { shortDate } from '@/lib/dates';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmSheet } from './ConfirmSheet';

export type SavedPlan = { id: string; name: string; active: boolean; created_at: string };

/**
 * Every saved week, one of them in use ("active" in the data; "this week's
 * plan" to the player). It's the one the Plan tab opens to, Train's "today"
 * card reads, and This week measures.
 *
 * Each row has a calendar button — the Plan tab's own calendar, so the two
 * read as the same thing. Not in use, it's the grey tonal button rename and
 * delete use: something you can press. In use, it's filled, with a tick in
 * it: filled is what's in effect, everywhere in this app, and the tick is a
 * second difference that doesn't depend on telling grey from black. The
 * week in use also sits first. No tags — the button says it.
 *
 * Switching is one tap. It used to ask first, in a sheet; nothing is lost
 * by switching and switching back is the same tap, so the question was only
 * in the way. Deleting still asks.
 */
export function SavedPlans({ plans: initial, timeZone = 'UTC' }: { plans: SavedPlan[]; /** The academy's, for "Saved Nov 13". */ timeZone?: string }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initial);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<SavedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function call(method: 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true); setErr('');
    try {
      const res = await fetch(method === 'DELETE' ? `/api/plans?id=${body.id}` : '/api/plans', {
        method, headers: { 'content-type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(body),
      });
      if (!res.ok) setErr('Couldn’t save that. Try again.');
      return res.ok;
    } catch { setErr('No signal. Try again.'); return false; } finally { setBusy(false); }
  }

  async function rename(id: string) {
    const name = draft.trim();
    if (!name) return;
    if (await call('PATCH', { id, name })) {
      setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
      setRenaming(null);
    }
  }

  async function activate(plan: SavedPlan) {
    if (await call('PATCH', { id: plan.id, follow: true })) {
      // The week in use moves to the top, where it's read first.
      setPlans((ps) => ps.map((p) => ({ ...p, active: p.id === plan.id }))
        .sort((a, b) => Number(b.active) - Number(a.active)));
      router.refresh();
    }
  }

  async function remove(plan: SavedPlan) {
    if (await call('DELETE', { id: plan.id })) {
      setPlans((ps) => ps.filter((p) => p.id !== plan.id));
      setDeleting(null);
      router.refresh();
    } else setDeleting(null);
  }

  return (
    <section id="plans" className="mt-10 scroll-mt-5">
      <h2 className="h-sec mb-3">Your plans</h2>
      <ul aria-label="Your plans" className="space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="card p-4">
            {renaming === p.id ? (
              <form onSubmit={(e) => { e.preventDefault(); rename(p.id); }}>
                <label className="text-field">
                  {/* 16px for the same reason as the coach box: smaller and
                      iOS zooms the page on focus. */}
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                    maxLength={60} aria-label={`New name for ${p.name}`} enterKeyHint="done"
                    className="text-title-sm" />
                </label>
                <div className="mt-3 flex gap-2.5">
                  <button type="button" onClick={() => setRenaming(null)} className="btn-ghost flex-1">Cancel</button>
                  <button type="submit" disabled={busy || !draft.trim()} className="btn-primary btn-sm flex-1">
                    Save name
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <Link href={p.active ? '/plan' : `/plan?plan=${p.id}`} className="min-w-0 flex-1">
                  <div className="h-card truncate">{p.name}</div>
                  <div className="mt-1 text-body-sm font-medium text-on-surface-variant">
                    {p.active ? 'This week’s plan' : `Saved ${shortDate(p.created_at, timeZone)}`}
                  </div>
                </Link>

                {/* A toggle, not a radio: each sits in its own row beside
                    Rename and Delete, which a radio group can't hold. */}
                <button type="button" aria-pressed={p.active}
                        aria-label={p.active ? `${p.name} is this week’s plan` : `Use ${p.name} this week`}
                        title={p.active ? 'This week’s plan' : 'Use this week'}
                        disabled={busy && !p.active}
                        onClick={() => { if (!p.active) activate(p); }}
                        className={`icon-btn pressable ${p.active
                          ? 'cursor-default bg-secondary-container text-on-secondary-container'
                          : 'text-on-surface-variant hover:text-on-surface'}`}>
                  <CalendarIcon checked={p.active} />
                </button>

                <button type="button" onClick={() => { setDraft(p.name); setRenaming(p.id); }}
                        aria-label={`Rename ${p.name}`} title="Rename"
                        className="icon-btn pressable text-on-surface-variant hover:text-on-surface">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true"
                       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                  </svg>
                </button>
                <button type="button" onClick={() => setDeleting(p)}
                        aria-label={`Delete ${p.name}`} title="Delete"
                        className="icon-btn pressable text-on-surface-variant hover:text-on-surface">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true"
                       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-3 text-body-sm font-semibold text-on-surface">{err}</p>}
      <Link href="/plan?new=1" className="btn-ghost pressable mt-3 w-full">Build another week</Link>

      <ConfirmSheet
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ''}?`}
        body={deleting?.active
          ? <>This is the week you&rsquo;re using. You&rsquo;ll have none until you pick another. Sessions you&rsquo;ve done stay in Your training.</>
          : <>Sessions you&rsquo;ve done stay in Your training.</>}
        confirmLabel="Delete" busy={busy}
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)} />
    </section>
  );
}

/** "Sep 3": see lib/dates. */

/** The Plan tab's calendar, with a tick in it for the week in use. */
function CalendarIcon({ checked }: { checked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v16H4zM16 3v4M8 3v4M4 11h16" />
      {checked && <path d="M9 16l2 2 4-4" />}
    </svg>
  );
}

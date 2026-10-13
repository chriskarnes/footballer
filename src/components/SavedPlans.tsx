'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon } from './Chip';
import { ConfirmSheet } from './ConfirmSheet';

export type SavedPlan = { id: string; name: string; active: boolean; created_at: string };

/**
 * Every saved week, one of them active. The active week is the one the Plan
 * tab opens to, Train's "today" card reads, and This week measures.
 *
 * The list works like a set of radio buttons, because that's what it is: one
 * and only one is chosen. Each row leads with the choice — an empty circle for
 * an inactive week, a filled one with a tick for the active week, the same
 * check a chosen segment wears — and the active week also takes the selection
 * ring and sits first. "Follow" said none of that; it was a word to learn.
 *
 * Switching is a second tap, in a sheet that names both weeks: changing which
 * week runs your Plan tab and your Train card is worth being sure of, and the
 * week that stops being active doesn't go anywhere.
 */
export function SavedPlans({ plans: initial }: { plans: SavedPlan[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initial);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [switching, setSwitching] = useState<SavedPlan | null>(null);
  const [deleting, setDeleting] = useState<SavedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const active = plans.find((p) => p.active);

  async function call(method: 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(method === 'DELETE' ? `/api/plans?id=${body.id}` : '/api/plans', {
        method, headers: { 'content-type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(body),
      });
      return res.ok;
    } catch { return false; } finally { setBusy(false); }
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
      // The active week moves to the top, where it's read first.
      setPlans((ps) => ps.map((p) => ({ ...p, active: p.id === plan.id }))
        .sort((a, b) => Number(b.active) - Number(a.active)));
      setSwitching(null);
      router.refresh();
    }
  }

  async function remove(plan: SavedPlan) {
    if (await call('DELETE', { id: plan.id })) {
      setPlans((ps) => ps.filter((p) => p.id !== plan.id));
      setDeleting(null);
      router.refresh();
    }
  }

  return (
    <section id="plans" className="mt-9 scroll-mt-5">
      <p className="eyebrow mb-3">Your plans</p>
      <ul role="radiogroup" aria-label="Active weekly plan" className="space-y-2">
        {plans.map((p) => (
          <li key={p.id}
              // The selection ring: the mark of a chosen thing everywhere else
              // in the app, so the active week reads as chosen before its tag
              // is read.
              className={`card p-4 ${p.active ? 'outline outline-2 -outline-offset-2 outline-secondary-container' : ''}`}>
            {renaming === p.id ? (
              <form onSubmit={(e) => { e.preventDefault(); rename(p.id); }}>
                <label className="text-field">
                  {/* 16px for the same reason as the coach box: smaller and
                      iOS zooms the page on focus. */}
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                    maxLength={60} aria-label={`New name for ${p.name}`} enterKeyHint="done"
                    className="text-[16px]" />
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
                <button type="button" role="radio" aria-checked={p.active}
                        aria-label={p.active ? `${p.name} is active` : `Make ${p.name} active`}
                        onClick={() => { if (!p.active) setSwitching(p); }}
                        className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                                    ${p.active ? 'cursor-default' : ''}`}>
                  <span aria-hidden="true"
                        className={`flex h-6 w-6 items-center justify-center rounded-full
                          ${p.active
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'border-2 border-outline'}`}>
                    {p.active && <CheckIcon className="h-3.5 w-3.5" />}
                  </span>
                </button>

                <Link href={p.active ? '/plan' : `/plan?plan=${p.id}`} className="min-w-0 flex-1">
                  <div className="h-card truncate">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-on-surface-variant">
                    {p.active
                      ? <span className="tag tag-accent">Active</span>
                      : <><span className="tag">Inactive</span><span>Saved {savedOn(p.created_at)}</span></>}
                  </div>
                </Link>

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
      <Link href="/plan?new=1" className="btn-ghost pressable mt-3 w-full">Build another week</Link>

      <ConfirmSheet
        open={!!switching}
        title={`Make ${switching?.name ?? ''} active?`}
        body={active
          ? <>{active.name} becomes inactive. It stays in your plans, and you can switch back any time.</>
          : <>Plan and Train will show you this week each day.</>}
        confirmLabel="Make active" busy={busy}
        onConfirm={() => switching && activate(switching)}
        onCancel={() => setSwitching(null)} />

      <ConfirmSheet
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ''}?`}
        body={deleting?.active
          ? <>This is your active plan, so you&rsquo;ll have none until you make another one active. Sessions you&rsquo;ve done stay in your history.</>
          : <>Sessions you&rsquo;ve done stay in your history.</>}
        confirmLabel="Delete" busy={busy}
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)} />
    </section>
  );
}

/** "3 Sep", the same on the server and in the browser — a locale-default
 *  date rendered "9/3/2026" in one and could disagree with the other. */
function savedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

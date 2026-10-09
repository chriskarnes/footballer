'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SavedPlan = { id: string; name: string; active: boolean; created_at: string };

/**
 * Every saved week, by name, with the one you follow marked. Before this, Me
 * had a single card reading "The week you saved" — the plan's name was stored
 * and never shown, and saving a new week quietly hid the old one.
 *
 * Renaming happens here, in place: it's an account-level thing to do to a
 * plan, not something to do mid-week on the Plan tab.
 */
export function SavedPlans({ plans: initial }: { plans: SavedPlan[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initial);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function follow(id: string) {
    if (await call('PATCH', { id, follow: true })) {
      setPlans((ps) => ps.map((p) => ({ ...p, active: p.id === id })));
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (await call('DELETE', { id })) {
      setPlans((ps) => ps.filter((p) => p.id !== id));
      setDeleting(null);
      router.refresh();
    }
  }

  return (
    <section id="plans" className="mt-9 scroll-mt-5">
      <p className="eyebrow mb-3">Your plans</p>
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="card p-4">
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
            ) : deleting === p.id ? (
              <div>
                <p className="text-[14px] font-medium text-on-surface">
                  Delete {p.name}? Sessions you&rsquo;ve done stay in your history.
                </p>
                <div className="mt-3 flex gap-2.5">
                  <button type="button" onClick={() => setDeleting(null)} className="btn-ghost flex-1">Keep it</button>
                  <button type="button" onClick={() => remove(p.id)} disabled={busy}
                          className="btn-primary btn-sm flex-1">Delete</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href={p.active ? '/plan' : `/plan?plan=${p.id}`} className="min-w-0 flex-1">
                  <div className="h-card truncate">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-on-surface-variant">
                    {p.active
                      ? <span className="tag tag-accent">Following</span>
                      : <span>Saved {new Date(p.created_at).toLocaleDateString()}</span>}
                  </div>
                </Link>
                {!p.active && (
                  <button type="button" onClick={() => follow(p.id)} disabled={busy}
                          className="btn-ghost shrink-0 px-4">Follow</button>
                )}
                <button type="button" onClick={() => { setDraft(p.name); setRenaming(p.id); setDeleting(null); }}
                        aria-label={`Rename ${p.name}`} title="Rename"
                        className="icon-btn pressable text-on-surface-variant hover:text-on-surface">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true"
                       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                  </svg>
                </button>
                <button type="button" onClick={() => { setDeleting(p.id); setRenaming(null); }}
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
    </section>
  );
}

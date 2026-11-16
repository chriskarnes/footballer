'use client';
import { useState, useTransition } from 'react';
import { replaceSelfServeInvite, setSelfServeOpen } from '@/app/admin/academies/actions';
import { offline } from '@/lib/plain-error';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Aside, ICON, Tag } from './ui';
import { Menu, type MenuItem } from './Menu';

type Ask = 'replace' | 'open' | 'close' | null;

/**
 * How players get into a self-serve space: whether it's open to everyone
 * (0030) and its invite link (0031). The link and Copy are what's used; making
 * a new link and opening or closing the space are in the menu.
 *
 * `code` is undefined when the link can't be read (before 0031), null with none made.
 */
export function SelfServeAccess({ id, slug, site, open, licensed, code: initial }: {
  id: string; slug: string; site: string; open: boolean; licensed: boolean; code: string | null | undefined;
}) {
  const [code, setCode] = useState(initial ?? null);
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, start] = useTransition();
  const link = code ? `${site}/join/${code}` : null;
  const known = initial !== undefined;

  const replace = () => start(async () => {
    setMsg('');
    const r = await replaceSelfServeInvite(id).catch(offline);
    setAsk(null);
    if (r.ok) { setMsg(code ? 'Replaced. The old link no longer works.' : 'Link made.'); setCode(r.code); }
    else setMsg(r.error);
  });
  const flip = (to: boolean) => start(async () => {
    setMsg('');
    const r = await setSelfServeOpen(id, slug, to).catch(offline);
    setAsk(null);
    if (!r.ok) setMsg(r.error);
  });

  const items: MenuItem[] = [
    ...(known ? [{ label: code ? 'Replace the link' : 'Make a link', onSelect: () => (code ? setAsk('replace') : replace()) }] : []),
    ...(open ? [{ label: 'Close it to invite only', onSelect: () => setAsk('close') }]
      : licensed ? [] : [{ label: 'Open it to everyone', onSelect: () => setAsk('open') }]),
  ];

  return (
    <section className="mt-10 rounded-3xl bg-surface-container-low p-6" aria-label="Access">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="h-card">Access</h2>
          <Tag tone={open ? 'good' : 'plain'}>{open ? 'Open to everyone' : 'Invite only'}</Tag>
        </div>
        <Menu label="Access options" items={items} busy={busy} />
      </div>

      {!known ? <p className="mt-3 text-body text-on-surface-variant">The invite link shows here once migration 0031 has run.</p>
        : link ? (
          <div className="mt-4 flex items-center gap-2">
            <p className="min-w-0 flex-1 select-all truncate rounded-full bg-surface-container-lowest px-4 py-2.5 font-mono text-body-sm text-on-surface">{link.replace(/^https?:\/\//, '')}</p>
            <button type="button" aria-label="Copy the invite link" title="Copy the invite link" className="icon-btn bg-surface-container-lowest"
                    onClick={() => navigator.clipboard.writeText(link).then(() => setMsg('Copied.'), () => setMsg('Couldn’t copy. Select the link instead.'))}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON.copy} /></svg>
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy} className="btn-primary btn-sm pressable mt-4" onClick={replace}>{busy ? 'Working…' : 'Make an invite link'}</button>
        )}
      <p role="status" className="mt-2 min-h-5 text-body-sm font-semibold text-on-surface">{msg}</p>

      <Aside label={open ? 'What open means' : licensed ? 'Why it can’t open yet' : 'What opening it does'}>
        {open
          ? 'Anyone signed in can start with one tap, and the main site’s players page links here.'
          : licensed
            ? 'Players join with its invite link. It can’t open while it has the Forge library, which is for private use. Opening it takes your own drills in its library and the Forge library switched off; both are done in the database for now.'
            : 'Players join with its invite link. Open it and anyone can start with one tap, and the main site links here. Today Train and Plan are built from the Forge library alone, so without it members get Speed and this space’s own Library, and Train says “Coming soon”.'}
      </Aside>

      <ConfirmSheet open={ask === 'replace'} busy={busy} title="Replace the invite link?" confirmLabel="Replace it"
        body="The old one stops working, for anyone who hasn’t joined yet."
        onCancel={() => setAsk(null)} onConfirm={replace} />
      <ConfirmSheet open={ask === 'open'} busy={busy} title="Open it to everyone?" confirmLabel="Open it"
        body="Anyone signed in can start with one tap, and the main site’s players page links here."
        onCancel={() => setAsk(null)} onConfirm={() => flip(true)} />
      <ConfirmSheet open={ask === 'close'} busy={busy} title="Close it to invite only?" confirmLabel="Close it"
        body="New players need the invite link. The people already in stay in."
        onCancel={() => setAsk(null)} onConfirm={() => flip(false)} />
    </section>
  );
}

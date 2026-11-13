'use client';
import { Wordmark } from './Wordmark';
import { BandTag } from './BandText';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { brandCss, isHex } from '@/lib/brand-colors';
import { LOGO_MAX_BYTES, LOGO_TYPES, PALETTES, type Branding } from '@/lib/branding';
import { removeLogo, resetBranding, saveBranding, uploadLogo } from '@/app/admin/actions';
import { ConfirmSheet } from './ConfirmSheet';

/** 'none' is the monochrome app; 'custom' is two colours picked by hand. */
type Choice = string | 'none' | 'custom';

/**
 * The panel. Picking a kit restyles this whole page at once — the tab bar,
 * the buttons, the ring on the chosen tile — because the preview is the same
 * stylesheet the layout would write, applied here before it is saved. What
 * you see before Save is what every player gets after it.
 */
export function BrandingAdmin({ initial }: { initial: Branding | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [choice, setChoice] = useState<Choice>(
    !initial?.primary ? 'none' : initial.paletteId ?? 'custom');
  const [custom, setCustom] = useState<{ primary: string; accent: string }>({
    primary: initial?.primary ?? '#1D4ED8', accent: initial?.accent ?? '#FACC15' });
  const [logo, setLogo] = useState<string | null>(initial?.logo ?? null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [logoBusy, startLogo] = useTransition();
  const [resetting, setResetting] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const colours = useMemo(() => {
    if (choice === 'none') return null;
    if (choice === 'custom') return isHex(custom.primary) && isHex(custom.accent) ? custom : null;
    const p = PALETTES.find((x) => x.id === choice)!;
    return { primary: p.primary, accent: p.accent };
  }, [choice, custom]);

  // The saved brand is switched off while the panel is open, so the preview
  // below is the only brand on the page — including when it is "none".
  useEffect(() => {
    const saved = document.getElementById('brand-tokens') as HTMLStyleElement | null;
    saved?.setAttribute('media', 'not all');
    return () => saved?.removeAttribute('media');
  }, []);

  useEffect(() => {
    if (!colours) return;
    const el = document.createElement('style');
    el.id = 'brand-preview';
    el.textContent = brandCss(colours.primary, colours.accent);
    document.body.appendChild(el);
    return () => el.remove();
  }, [colours]);

  const dirty = name.trim() !== (initial?.name ?? '')
    || (colours?.primary ?? null) !== (initial?.primary ?? null)
    || (colours?.accent ?? null) !== (initial?.accent ?? null);

  function save() {
    setStatus(null);
    startSave(async () => {
      const r = await saveBranding({
        name, paletteId: choice === 'none' || choice === 'custom' ? null : choice,
        primary: colours?.primary ?? null, accent: colours?.accent ?? null,
      });
      setStatus(r.ok ? { tone: 'ok', text: 'Saved. Players see it on their next load.' } : { tone: 'err', text: r.error });
      if (r.ok) router.refresh();
    });
  }

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!LOGO_TYPES.includes(f.type)) return setStatus({ tone: 'err', text: 'Use a PNG, SVG, WebP or JPEG.' });
    if (f.size > LOGO_MAX_BYTES) return setStatus({ tone: 'err', text: 'Keep the logo under 512 KB.' });
    setStatus(null);
    const preview = URL.createObjectURL(f);
    startLogo(async () => {
      const form = new FormData();
      form.set('logo', f);
      const r = await uploadLogo(form);
      if (r.ok) { setLogo(preview); router.refresh(); }
      else { URL.revokeObjectURL(preview); setStatus({ tone: 'err', text: r.error }); }
    });
  }

  function dropLogo() {
    startLogo(async () => {
      const r = await removeLogo();
      if (r.ok) { setLogo(null); router.refresh(); } else setStatus({ tone: 'err', text: r.error });
    });
  }

  async function reset() {
    const r = await resetBranding();
    setResetting(false);
    if (!r.ok) return setStatus({ tone: 'err', text: r.error });
    setChoice('none'); setLogo(null);
    setStatus({ tone: 'ok', text: 'Back to black and white.' });
    router.refresh();
  }

  const shown = name.trim() || 'Train.futbol';

  return (
    <div className="pb-10">
      {/* ---------------------------------------------------------- PREVIEW */}
      <section className="mt-7 rounded-large-increased border border-brand-edge bg-surface-brand p-6 shadow-level3"
               aria-label="Preview">
        {/* The top of Train, as players see it: the same wordmark and band text. */}
        <div className="text-on-surface-brand"><Wordmark name={shown} logo={logo} onBrand /></div>
        <div className="mt-5"><BandTag>Today</BandTag></div>
        <div className="site-wide mt-3 text-[26px] uppercase leading-[.95] text-on-surface-brand">Touch and pass</div>
        <p className="mt-3 text-[12.5px] font-semibold text-on-surface-brand-variant">Today&rsquo;s session · 45 min</p>
        <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-brand-track">
          <div className="h-full w-[62%] rounded-full bg-brand-accent" />
        </div>
        <div className="mt-5 flex gap-2.5">
          <span className="btn-primary btn-big flex-1 bg-on-surface-brand text-surface-brand">Start</span>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap items-center gap-2" aria-hidden="true">
        <span className="btn-primary btn-sm">Build session</span>
        <span className="chip chip-on">Dribbling</span>
        <span className="chip">Passing</span>
        <span className="text-[13px] font-semibold text-primary underline underline-offset-4">A link</span>
      </div>

      {/* ------------------------------------------------------------- NAME */}
      <section className="mt-9">
        <p className="eyebrow mb-0.5">Name</p>
        <p className="mb-2.5 text-[12.5px] text-on-surface-variant">
          Replaces &ldquo;Train.futbol&rdquo; in the header and the browser tab. A dot splits it the
          same way: &ldquo;Riverside.fc&rdquo; sets the part after the dot lighter.
        </p>
        <label className="text-field">
          <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
                 placeholder="Train.futbol" autoComplete="off" aria-label="Name" />
        </label>
      </section>

      {/* ---------------------------------------------------------- COLOURS */}
      <section className="mt-9">
        <p className="eyebrow mb-0.5">Colours</p>
        <p className="mb-3 text-[12.5px] text-on-surface-variant">
          The kit colour fills buttons, the selected chip and the session card; the trim is the
          accent on it. Text colours are worked out for contrast, so every kit stays readable.
        </p>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Colour palette">
          <Swatch on={choice === 'none'} onPick={() => setChoice('none')}
                  name="Unbranded" note="Black and white" primary="#1B1B1B" accent="#FFFFFF" />
          {PALETTES.map((p) => (
            <Swatch key={p.id} on={choice === p.id} onPick={() => setChoice(p.id)}
                    name={p.name} note={p.note} primary={p.primary} accent={p.accent} />
          ))}
          {/* Tenth, so the grid closes evenly; it wears whatever was last typed. */}
          <Swatch on={choice === 'custom'} onPick={() => setChoice('custom')}
                  name="Custom" note="Your club’s exact colours"
                  primary={isHex(custom.primary) ? custom.primary : '#777777'}
                  accent={isHex(custom.accent) ? custom.accent : '#FFFFFF'} />
        </div>

        {choice === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <ColourField label="Kit" value={custom.primary} onChange={(v) => setCustom({ ...custom, primary: v })} />
            <ColourField label="Trim" value={custom.accent} onChange={(v) => setCustom({ ...custom, accent: v })} />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- LOGO */}
      <section className="mt-9">
        <p className="eyebrow mb-0.5">Logo</p>
        <p className="mb-3 text-[12.5px] text-on-surface-variant">
          A crest or badge, shown beside the name. Square works best. PNG or SVG with a
          transparent background, under 512 KB. Saves as soon as you pick it.
        </p>
        <div className="card-flat flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-medium bg-surface-container">
            {logo
              ? <img src={logo} alt="Current logo" className="h-12 w-12 object-contain" />
              : <span className="text-[11px] font-semibold text-on-surface-variant">None</span>}
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <button type="button" onClick={() => file.current?.click()} disabled={logoBusy}
                    className="btn-ghost btn-sm pressable">
              {logoBusy ? 'Saving…' : logo ? 'Replace' : 'Upload'}
            </button>
            {logo && (
              <button type="button" onClick={dropLogo} disabled={logoBusy} className="btn-ghost btn-sm pressable">
                Remove
              </button>
            )}
          </div>
          <input ref={file} type="file" accept={LOGO_TYPES.join(',')} onChange={pickLogo} className="hidden" />
        </div>
      </section>

      {/* ------------------------------------------------------------- SAVE */}
      <div className="mt-9">
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary pressable w-full">
          {saving ? 'Saving…' : dirty ? 'Save brand' : 'Saved'}
        </button>
        {status && (
          <p role="status" className={`mt-3 text-[13px] font-semibold ${status.tone === 'err' ? 'text-error' : 'text-on-surface-variant'}`}>
            {status.tone === 'err' && 'Couldn’t save: '}{status.text}
          </p>
        )}
        <button type="button" onClick={() => setResetting(true)}
                className="mt-6 text-[13px] font-semibold text-on-surface-variant underline underline-offset-4">
          Clear colours and logo
        </button>
      </div>

      <ConfirmSheet open={resetting} title="Clear colours and logo?"
        body="Your players go back to the black-and-white app. The academy keeps its name."
        confirmLabel="Reset" onConfirm={reset} onCancel={() => setResetting(false)} />
    </div>
  );
}

/**
 * A kit, drawn as a kit: the colour as a shirt-front block with the trim as
 * a collar band and a stripe down one side, rather than two dots. The block
 * uses the palette's literal colours, not tokens, so all nine stay visible
 * while the page itself shows only the chosen one.
 */
function Swatch({ on, onPick, name, note, primary, accent }: {
  on: boolean; onPick: () => void; name: string; note: string; primary: string; accent: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick}
            className={`tile pressable overflow-hidden p-0 text-left ${on ? 'tile-on' : ''}`}>
      <span className="relative block h-16" style={{ background: primary }}>
        <span className="absolute inset-x-0 top-0 h-[5px]" style={{ background: accent }} />
        <span className="absolute bottom-0 right-5 top-0 w-[7px]" style={{ background: accent, opacity: 0.9 }} />
        {on && (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="absolute left-3 top-3.5 h-5 w-5"
               fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className="block px-3 pb-3 pt-2.5">
        <span className="block text-[13.5px] font-bold text-on-surface">{name}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug">{note}</span>
      </span>
    </button>
  );
}

/** A native colour picker and the hex beside it, either one editable. */
function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="card-flat flex items-center gap-3 p-3">
      <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
             aria-label={`${label} colour`}
             className="h-10 w-10 shrink-0 cursor-pointer rounded-small border border-outline-variant bg-transparent p-0" />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{label}</span>
        <input type="text" value={text} maxLength={7} spellCheck={false}
               onChange={(e) => { const v = e.target.value.toUpperCase(); setText(v); if (isHex(v)) onChange(v); }}
               aria-label={`${label} hex`}
               className="w-full rounded-sm bg-transparent font-mono text-[14px] font-semibold text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
      </span>
    </label>
  );
}

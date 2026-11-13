'use client';
import { useActionState, useState } from 'react';
import { requestAcademy } from '@/app/site/actions';
import { ROOT_DOMAIN } from '@/lib/tenant';
import { keepOnError } from '@/components/coach/Field';

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

/**
 * Get started. Asks only what's needed to set an academy up with them: who,
 * what it's called, roughly how big, and what they've got to put in it.
 */
export function StartForm({ slug: claimed = '' }: { slug?: string }) {
  const [state, action, pending] = useActionState(requestAcademy, null);
  const [academy, setAcademy] = useState('');
  const [slug, setSlug] = useState(claimed);
  const [slugTouched, setSlugTouched] = useState(!!claimed);
  const shownSlug = slugTouched ? slug : toSlug(academy);

  if (state?.ok) {
    return (
      <div className="card p-6 sm:p-8" role="status">
        <h2 className="h-card text-on-surface">Thanks. We&rsquo;ll be in touch.</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
          Expect an email within a day or two with the link to your page. A short checklist there gets your first sessions in before you send it to anyone.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={keepOnError(action)} className="card space-y-5 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name"><input name="name" required autoComplete="name" /></Field>
        <Field label="Email"><input name="email" type="email" required autoComplete="email" /></Field>
      </div>

      <Field label="Name on your page" hint="Your own name or your training business. You can change it later.">
        <input name="academy" required maxLength={40} value={academy} onChange={(e) => setAcademy(e.target.value)}
               placeholder="e.g. Riverside Skills" />
      </Field>

      <Field label="Your web address" hint="Where your players will find your page.">
        <div className="flex items-stretch">
          <input name="slug" value={shownSlug} maxLength={30} className="!rounded-r-none"
                 onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)); }} placeholder="riverside" />
          <span className="flex items-center rounded-r-[var(--md-sys-shape-corner-small)] border border-l-0 border-outline bg-surface-container px-3 text-[15px] text-on-surface-variant">
            .{ROOT_DOMAIN}
          </span>
        </div>
      </Field>

      <Field label="Town or area"><input name="city" maxLength={60} placeholder="e.g. Austin, TX" /></Field>

      <div className="grid items-end gap-5 sm:grid-cols-2">
        <Field label="How many players?">
          <select name="players" defaultValue="">
            <option value="" disabled>Choose one</option>
            <option>1–10</option><option>11–25</option><option>26–50</option><option>50+</option>
          </select>
        </Field>
        <Field label="Trainers, you included?">
          <select name="trainers" defaultValue="">
            <option value="" disabled>Choose one</option>
            <option>Just me</option><option>2–4</option><option>5+</option>
          </select>
        </Field>
      </div>

      <Field label="What drills do you have now?">
        <select name="content" defaultValue="">
          <option value="" disabled>Choose one</option>
          <option>Lots, with videos</option>
          <option>A few drills I always use</option>
          <option>Mostly in my head</option>
        </select>
      </Field>

      <Field label="Anything else?" hint="Optional.">
        <textarea name="message" rows={3} maxLength={2000} placeholder="Ages, what you work on, links to your YouTube videos…" />
      </Field>

      {state?.error && <p role="alert" className="text-[14px] font-semibold text-on-surface">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-lime w-full sm:w-auto">
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-field">
      <span>{label}</span>
      {children}
      {hint && <small className="mt-1.5 block text-[12.5px] text-on-surface-variant">{hint}</small>}
    </label>
  );
}

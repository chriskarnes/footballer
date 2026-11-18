'use client';
import { guarded, offline } from '@/lib/plain-error';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveDrill, deleteDrill } from '@/app/coach/content-actions';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { Chip } from '@/components/Chip';
import { youtubeId } from '@/lib/video';
import { Field, FormError, keepOnError } from './Field';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { drillTags, type DrillRow } from '@/lib/academy-week';
import { Disclose } from './Disclose';

const MAX_TAGS = 3;
// What a new drill takes, and what saveDrill falls back to.
const DEFAULT_MINUTES = 5;

/**
 * One drill. Only the name is required: "Wall passes, 3 × 50 each foot" with
 * no video is a perfectly good drill, and most trainers have dozens of those
 * in their head and none filmed.
 *
 * What a drill needs to be run comes first: its name, how much, a video and
 * how to do it. Minutes, what it works on and the drill after it are under
 * More, which is shut on a new drill (five minutes is right for most) and
 * open on a drill that has any of them set. Shut, they're still in the form
 * and still sent.
 */
export function DrillForm({ drill, back, onSaved, onCancel, others }: {
  drill?: DrillRow; back: string;
  /** The academy's other drills, to pick a harder version from. Without it, no field. */
  others?: { id: string; name: string }[];
  /** Inline, inside another editor: hand the new drill back instead of leaving the page. */
  onSaved?: (d: DrillRow) => void; onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(guarded(saveDrill), null);
  const handed = useRef<string | null>(null);
  useEffect(() => {
    if (onSaved && state?.ok && state.drill && handed.current !== state.drill.id) {
      handed.current = state.drill.id;
      onSaved(state.drill);
    }
  }, [state, onSaved]);
  const [video, setVideo] = useState(drill?.video_url ?? '');
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [gone, setGone] = useState('');
  // In the order picked: the first is the drill's main focus.
  const [tags, setTags] = useState<FocusArea[]>(drillTags(drill ?? { focus: null }).filter((t): t is FocusArea => t in FOCUS_LABELS));
  // Three at most: past that, tags stop telling drills apart.
  const toggle = (t: FocusArea) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : ts.length < MAX_TAGS ? [...ts, t] : ts));
  const yt = youtubeId(video);

  return (
    <form onSubmit={keepOnError(action)} className="space-y-5">
      <input type="hidden" name="id" value={drill?.id ?? ''} />
      <input type="hidden" name="back" value={back} />
      <Field label="Name"><input name="name" required maxLength={80} defaultValue={drill?.name} placeholder="e.g. Wall passes" /></Field>
      <Field label="How much" hint="Sets, reps or time.">
        <input name="amount" maxLength={80} defaultValue={drill?.amount ?? ''} placeholder="3 × 50 each foot" />
      </Field>
      <Field label="Video link" hint="A YouTube link (unlisted is fine), or any https link. Optional.">
        <input name="video_url" inputMode="url" maxLength={300} value={video} onChange={(e) => setVideo(e.target.value)}
               placeholder="https://youtu.be/…" />
      </Field>
      {yt && (
        <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Video preview"
             className="aspect-video w-full rounded-large object-cover" />
      )}
      <Field label="How to do it" hint="A few short lines. Players see it under the drill.">
        <textarea name="how" rows={4} maxLength={1000} defaultValue={drill?.how ?? ''}
                  placeholder={'Stand 6 feet from a wall.\nPass with the inside of the foot.\nControl, then pass back.'} />
      </Field>
      <Disclose label="More" startOpen={!!drill && (drill.minutes !== DEFAULT_MINUTES || tags.length > 0 || !!drill.harder_id)}>
      <div className="space-y-5">
      <Field label="Minutes"><input name="minutes" type="number" inputMode="numeric" min={1} max={120} defaultValue={drill?.minutes ?? DEFAULT_MINUTES} /></Field>
      <fieldset>
        <legend className="mb-1.5 text-body font-semibold text-on-surface-variant">Works on</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(FOCUS_LABELS) as [FocusArea, string][]).map(([k, l]) => (
            <span key={k} className={!tags.includes(k) && tags.length >= MAX_TAGS ? 'opacity-40' : ''}>
              <Chip on={tags.includes(k)} onClick={() => toggle(k)}>{l}</Chip>
            </span>
          ))}
        </div>
        {tags.map((t) => <input key={t} type="hidden" name="focus" value={t} />)}
        <p className="mt-1.5 text-body-sm text-on-surface-variant">
          {tags.length >= MAX_TAGS ? `That’s three. Main focus: ${FOCUS_LABELS[tags[0]]}, the first you picked.`
            : tags.length > 1 ? `Main focus: ${FOCUS_LABELS[tags[0]]}, the first you picked.`
            : 'Up to three. The first you pick is its main focus.'}
        </p>
      </fieldset>
      {others && others.length > 0 && (
        <Field label="Next drill" hint="Once a player has leveled this drill all the way up, custom weeks move them on to this one. Optional.">
          <input type="hidden" name="has_harder" value="1" />
          <select name="harder_id" defaultValue={drill?.harder_id ?? ''}>
            <option value="">None</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      )}
      </div>
      </Disclose>
      <FormError error={state && !state.ok ? state.error : null} />
      <div className={onCancel ? 'grid grid-cols-2 gap-2.5' : ''}>
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost pressable">Cancel</button>}
        <button type="submit" disabled={pending} className="btn-primary pressable w-full">
          {pending ? 'Saving…' : onSaved ? 'Save and add' : 'Save'}
        </button>
      </div>
      {drill && (
        <>
          <button type="button" className="w-full text-center text-body font-semibold text-on-surface-variant underline underline-offset-4"
                  onClick={() => setConfirm(true)}>Delete this drill</button>
          <ConfirmSheet open={confirm} busy={deleting} title="Delete this drill?" confirmLabel="Delete"
            body="It comes out of every session that uses it. What players have already done stays in their history."
            onCancel={() => setConfirm(false)}
            onConfirm={async () => {
              setDeleting(true);
              const r = await deleteDrill(drill.id).catch(offline);
              setDeleting(false); setConfirm(false);
              // In the app, not a reload, so the toast survives the move.
              if (r.ok) { toast('Drill deleted.'); router.push(back || '/coach/drills'); router.refresh(); } else setGone(r.error);
            }} />
          {gone && <p role="alert" className="text-center text-body font-semibold text-on-surface">{gone}</p>}
        </>
      )}
    </form>
  );
}

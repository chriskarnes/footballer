'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveDrill, deleteDrill } from '@/app/coach/content-actions';
import { FOCUS_LABELS, type FocusArea } from '@/lib/types';
import { Chip } from '@/components/Chip';
import { youtubeId } from '@/lib/video';
import { Field, FormError } from './Field';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { drillTags, type DrillRow } from '@/lib/academy-week';

const MAX_TAGS = 3;

/**
 * One drill. Only the name is required: "Wall passes, 3 × 50 each foot" with
 * no video is a perfectly good drill, and most trainers have dozens of those
 * in their head and none filmed.
 */
export function DrillForm({ drill, back, onSaved, onCancel, others }: {
  drill?: DrillRow; back: string;
  /** The academy's other drills, to pick a harder version from. Without it, no field. */
  others?: { id: string; name: string }[];
  /** Inline, inside another editor: hand the new drill back instead of leaving the page. */
  onSaved?: (d: DrillRow) => void; onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(saveDrill, null);
  const handed = useRef<string | null>(null);
  useEffect(() => {
    if (onSaved && state?.ok && state.drill && handed.current !== state.drill.id) {
      handed.current = state.drill.id;
      onSaved(state.drill);
    }
  }, [state, onSaved]);
  const [video, setVideo] = useState(drill?.video_url ?? '');
  const [confirm, setConfirm] = useState(false);
  // In the order picked: the first is the drill's main focus.
  const [tags, setTags] = useState<FocusArea[]>(drillTags(drill ?? { focus: null }).filter((t): t is FocusArea => t in FOCUS_LABELS));
  // Three at most: past that, tags stop telling drills apart.
  const toggle = (t: FocusArea) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : ts.length < MAX_TAGS ? [...ts, t] : ts));
  const yt = youtubeId(video);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={drill?.id ?? ''} />
      <input type="hidden" name="back" value={back} />
      <Field label="Name"><input name="name" required maxLength={80} defaultValue={drill?.name} placeholder="e.g. Wall passes" /></Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="How much" hint="Sets, reps or time.">
          <input name="amount" maxLength={80} defaultValue={drill?.amount ?? ''} placeholder="3 × 50 each foot" />
        </Field>
        <Field label="Minutes"><input name="minutes" type="number" inputMode="numeric" min={1} max={120} defaultValue={drill?.minutes ?? 5} /></Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-on-surface-variant">Works on</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(FOCUS_LABELS) as [FocusArea, string][]).map(([k, l]) => (
            <span key={k} className={!tags.includes(k) && tags.length >= MAX_TAGS ? 'opacity-40' : ''}>
              <Chip on={tags.includes(k)} onClick={() => toggle(k)}>{l}</Chip>
            </span>
          ))}
        </div>
        {tags.map((t) => <input key={t} type="hidden" name="focus" value={t} />)}
        <p className="mt-1.5 text-[12.5px] text-on-surface-variant">
          {tags.length >= MAX_TAGS ? `That’s three. Main focus: ${FOCUS_LABELS[tags[0]]}, the first you picked.`
            : tags.length > 1 ? `Main focus: ${FOCUS_LABELS[tags[0]]}, the first you picked.`
            : 'Up to three. The first you pick is its main focus.'}
        </p>
      </fieldset>
      {others && others.length > 0 && (
        <Field label="Harder version" hint="Built weeks move a player on to it once this drill is stepped up as far as it goes. Optional.">
          <input type="hidden" name="has_harder" value="1" />
          <select name="harder_id" defaultValue={drill?.harder_id ?? ''}>
            <option value="">None</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Video link" hint="A YouTube link (unlisted is fine), or any https link. Optional.">
        <input name="video_url" inputMode="url" maxLength={300} value={video} onChange={(e) => setVideo(e.target.value)}
               placeholder="https://youtu.be/…" />
      </Field>
      {yt && (
        <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Video preview"
             className="aspect-video w-full rounded-[16px] object-cover" />
      )}
      <Field label="How to do it" hint="A few short lines. Players see it under the drill.">
        <textarea name="how" rows={4} maxLength={1000} defaultValue={drill?.how ?? ''}
                  placeholder={'Stand 2 metres from a wall.\nPass with the inside of the foot.\nControl, then pass back.'} />
      </Field>
      <FormError error={state && !state.ok ? state.error : null} />
      <div className={onCancel ? 'grid grid-cols-2 gap-2.5' : ''}>
        {onCancel && <button type="button" onClick={onCancel} className="btn-ghost pressable">Cancel</button>}
        <button type="submit" disabled={pending} className="btn-primary pressable w-full">
          {pending ? 'Saving…' : onSaved ? 'Save and add' : 'Save drill'}
        </button>
      </div>
      {drill && (
        <>
          <button type="button" className="w-full text-center text-[13px] font-semibold text-on-surface-variant underline underline-offset-4"
                  onClick={() => setConfirm(true)}>Delete this drill</button>
          <ConfirmSheet open={confirm} title="Delete this drill?" confirmLabel="Delete"
            body="It comes out of every session that uses it."
            onCancel={() => setConfirm(false)}
            onConfirm={async () => { await deleteDrill(drill.id); window.location.href = back; }} />
        </>
      )}
    </form>
  );
}

'use client';
import { useActionState, useState } from 'react';
import { saveDrill, deleteDrill } from '@/app/coach/content-actions';
import { FOCUS_LABELS } from '@/lib/types';
import { youtubeId } from '@/lib/video';
import { Field, FormError } from './Field';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import type { DrillRow } from '@/lib/academy-week';

/**
 * One drill. Only the name is required: "Wall passes, 3 × 50 each foot" with
 * no video is a perfectly good drill, and most trainers have dozens of those
 * in their head and none filmed.
 */
export function DrillForm({ drill, back }: { drill?: DrillRow; back: string }) {
  const [state, action, pending] = useActionState(saveDrill, null);
  const [video, setVideo] = useState(drill?.video_url ?? '');
  const [confirm, setConfirm] = useState(false);
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
      <Field label="Works on">
        <select name="focus" defaultValue={drill?.focus ?? ''}>
          <option value="">Anything</option>
          {Object.entries(FOCUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
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
      <button type="submit" disabled={pending} className="btn-primary pressable w-full">{pending ? 'Saving…' : 'Save drill'}</button>
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

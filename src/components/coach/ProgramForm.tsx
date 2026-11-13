'use client';
import { useActionState, useState } from 'react';
import { saveProgram, deleteProgram } from '@/app/coach/content-actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { Field, FormError, keepOnError } from './Field';

/** A program's name, length and what it's for. Sessions are added week by week after. */
/** `solo` is how many players have this program on their own, outside a group. */
export function ProgramForm({ program, solo = 0 }: { program?: { id: string; name: string; description: string | null; weeks: number }; solo?: number }) {
  const [state, action, pending] = useActionState(saveProgram, null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [gone, setGone] = useState('');
  return (
    <form onSubmit={keepOnError(action)} className="space-y-5">
      <input type="hidden" name="id" value={program?.id ?? ''} />
      <Field label="Name"><input name="name" required maxLength={60} defaultValue={program?.name} placeholder="e.g. Ball Mastery Foundations" /></Field>
      <Field label="How many weeks?" hint="How long a group usually runs. Weeks you don’t build repeat the one before.">
        <input name="weeks" type="number" inputMode="numeric" min={1} max={52} defaultValue={program?.weeks ?? 8} />
      </Field>
      <Field label="What it’s for" hint="Optional. Players see this.">
        <textarea name="description" rows={3} maxLength={500} defaultValue={program?.description ?? ''}
                  placeholder="Close control in tight spaces, both feet." />
      </Field>
      <FormError error={state && !state.ok ? state.error : null} />
      <button type="submit" disabled={pending} className="btn-primary pressable w-full">
        {pending ? 'Saving…' : program ? 'Save' : 'Create program'}
      </button>
      {program && (
        <>
          <button type="button" onClick={() => setConfirm(true)}
                  className="w-full text-center text-body font-semibold text-on-surface-variant underline underline-offset-4">Delete this program</button>
          <ConfirmSheet open={confirm} busy={deleting} title="Delete this program?" confirmLabel="Delete"
            body={`Its sessions go too, and any group using it is left without one.${solo ? ` ${solo === 1 ? '1 player has' : `${solo} players have`} it on their own and stop getting it.` : ''} Drills stay.`}
            onCancel={() => setConfirm(false)}
            onConfirm={async () => {
              setDeleting(true);
              const r = await deleteProgram(program.id);
              setDeleting(false); setConfirm(false);
              if (r.ok) { toast('Program deleted.'); router.push('/coach/content'); router.refresh(); } else setGone(r.error);
            }} />
          {gone && <p role="alert" className="text-center text-body font-semibold text-on-surface">{gone}</p>}
        </>
      )}
    </form>
  );
}

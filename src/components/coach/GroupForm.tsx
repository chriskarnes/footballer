'use client';
import { guarded } from '@/lib/plain-error';
import { startTransition, useActionState, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { saveGroup } from '@/app/coach/content-actions';
import { WEEKDAYS } from '@/lib/types';
import { programWeek, type GroupRow } from '@/lib/academy-week';
import { Field, FormError } from './Field';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * A group: what it's called, when it meets (optional), and the program its
 * players do at home. The start date is week 1.
 */
export function GroupForm({ group, programs, today }: {
  group?: GroupRow; programs: { id: string; name: string; weeks: number }[]; today: string;
}) {
  const [state, action, pending] = useActionState(guarded(saveGroup), null);
  // A new start date on the same program moves everyone in the group to
  // another week (or past its end): asked first, naming both weeks.
  const [ask, setAsk] = useState<{ fd: FormData; body: string } | null>(null);
  const weekLabel = (n: number | null, weeks: number, start: string) =>
    n ? `week ${n} of ${weeks}` : start > today ? 'not started yet' : 'past the end';
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    const program = programs.find((p) => p.id === group?.program_id);
    const start = String(fd.get('starts_on') ?? '');
    if (group?.starts_on && program && fd.get('program_id') === group.program_id && start && start !== group.starts_on) {
      const was = programWeek(group.starts_on, program.weeks, today), now = programWeek(start, program.weeks, today);
      if (was !== now) {
        setAsk({ fd, body: `${program.name} for ${group.name}: now ${weekLabel(was, program.weeks, group.starts_on)}; with this date, ${weekLabel(now, program.weeks, start)}. Sessions they've done this week would stop counting as this week's.` });
        return;
      }
    }
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <ConfirmSheet open={!!ask} title="Move the group to another week?" body={ask?.body} confirmLabel="Change the date"
        onCancel={() => setAsk(null)}
        onConfirm={() => { const fd = ask!.fd; setAsk(null); startTransition(() => action(fd)); }} />
      <input type="hidden" name="id" value={group?.id ?? ''} />
      <Field label="Name" hint="What you’d call it out loud.">
        <input name="name" required maxLength={40} defaultValue={group?.name} placeholder="e.g. U12 Tuesday, Advanced" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meets on">
          <select name="meets_weekday" defaultValue={group?.meets_weekday ?? ''}>
            <option value="">No set day</option>
            {WEEKDAYS.map((_, i) => <option key={i} value={i}>{DAY_NAMES[i]}</option>)}
          </select>
        </Field>
        <Field label="At"><input name="meets_time" type="time" defaultValue={group?.meets_time ?? ''} /></Field>
      </div>
      <Field label="Program" hint={programs.length ? 'What they do at home between sessions.' : 'Make a program first, under Library.'}>
        <select name="program_id" defaultValue={group?.program_id ?? ''}>
          <option value="">None yet</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.weeks} {p.weeks === 1 ? 'week' : 'weeks'})</option>)}
        </select>
      </Field>
      <Field label="Starts" hint={group?.program_id ? "Week 1 is the week this date is in. A new program starts this week unless you change this too." : "Week 1 is the week this date is in."}>
        <input name="starts_on" type="date" defaultValue={group?.starts_on ?? today} />
      </Field>
      <FormError error={state && !state.ok ? state.error : null} />
      <button type="submit" disabled={pending} className="btn-primary pressable w-full">
        {pending ? 'Saving…' : group ? 'Save' : 'Create group'}
      </button>
    </form>
  );
}

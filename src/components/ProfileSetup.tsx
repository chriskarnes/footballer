'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, CheckIcon } from './Chip';
import { positionName } from '@/lib/positions';

/**
 * The Me empty state: four questions, each of which changes what the player
 * gets. Nothing here is asked for its own sake, and the two fields that change
 * nothing are below a line and marked optional.
 *
 * Copy is addressed to the player, because the player is who answers it. The
 * account model is parent-signs-up / child-uses, which leaves a gap at the
 * handoff: a parent who never passed the phone over would read "How old are
 * you" and answer about themselves. So someone who joined as a parent
 * (profiles.signed_up_by) is asked about "your player" instead.
 */

const AGE_BANDS: [string, string][] = [
  ['u10', 'Under 10'], ['10_12', '10–12'], ['13_15', '13–15'],
  ['16_18', '16–18'], ['18_plus', '18+'],
];

const POSITIONS = [
  'Goalkeeper', 'Center back', 'Full back', 'Defensive mid',
  'Center mid', 'Attacking mid', 'Winger', 'Striker',
];

const FEET: [string, string][] = [['left', 'Left'], ['right', 'Right'], ['both', 'Both']];

export type ProfileValues = {
  display_name?: string | null;
  age_band?: string | null;
  positions?: string[] | null;
  dominant_foot?: string | null;
  region?: string | null;
  club?: string | null;
};

export function ProfileSetup({ email, initial, photo, next = '/', parent = false, heading = true }: {
  email?: string; initial?: ProfileValues;
  /** The optional photo picker, on the profile screen; not part of first-time setup. */
  photo?: React.ReactNode;
  /** Where a first-time setup lands: the week it builds, when this academy has one. */
  next?: string;
  /** Joined as a parent: the questions are about their player. */
  parent?: boolean;
  /** False where the page's brand band already says what this is (first-time setup on Me). */
  heading?: boolean;
}) {
  const q = parent
    ? { name: 'What’s your player’s name?', age: 'How old are they?', where: 'Where do they play?',
        foot: 'Which foot is their best?', team: 'Their team (you can skip this)', club: 'Their team, if they’re in one' }
    : { name: 'What’s your name?', age: 'How old are you?', where: 'Where do you play?',
        foot: 'Which foot is your best?', team: 'Your team (you can skip this)', club: 'Your team, if you’re in one' };
  const router = useRouter();
  const [name, setName] = useState(initial?.display_name ?? '');
  const [ageBand, setAgeBand] = useState(initial?.age_band ?? '');
  const [positions, setPositions] = useState<string[]>((initial?.positions ?? []).map(positionName));
  const [foot, setFoot] = useState(initial?.dominant_foot ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [club, setClub] = useState(initial?.club ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Someone who has answered before is correcting, not starting. Same four
  // questions either way — only the framing around them changes, because
  // "Let's set you up" over your own filled-in answers reads as a reset.
  const returning = !!initial?.display_name;

  // The four that count are the four that change a drill. Region and club are
  // deliberately not in this number — showing "4 of 6" would make skippable
  // fields look like unfinished work.
  const answered = [!!name.trim(), !!ageBand, positions.length > 0, !!foot].filter(Boolean).length;
  const complete = answered === 4;

  const togglePosition = (p: string) =>
    setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  /** Arrow keys select, as a radiogroup is expected to. Wraps at both ends. */
  function onFootKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!back && !fwd) return;
    e.preventDefault();
    const i = FEET.findIndex(([v]) => v === foot);
    // Nothing chosen yet: the first arrow lands on an end rather than jumping
    // into the middle of a row the player has not touched.
    const next = i < 0 ? (fwd ? 0 : FEET.length - 1)
      : (i + (fwd ? 1 : -1) + FEET.length) % FEET.length;
    setFoot(FEET[next][0]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  }

  async function save() {
    if (!complete || busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/profile', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          display_name: name.trim(), age_band: ageBand, positions,
          dominant_foot: foot,
          region: region.trim() || null, club: club.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      // First time through, go where the answers are used: the week, when
      // this academy has one, otherwise Train. Someone correcting one answer
      // is not asking to be moved.
      router.push(returning ? '/me' : next);
      router.refresh();
    } catch {
      setError('Couldn’t save. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="animate-pop">
      {heading && <h1 className="h-page">{returning ? (parent ? 'Player profile' : 'My profile') : parent ? 'Let’s set your player up' : 'Let’s set you up'}</h1>}
      {photo}

      {/* Name is required now the profile is about someone else, but a first
          name or nickname is all the app ever needs. A full legal name adds
          nothing to a drill plan and a great deal to the blast radius. */}
      <div className="mt-9">
        <p className="h-sec mb-3">{q.name}</p>
        <label className="text-field">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="e.g. Sam" autoComplete="off"
                 aria-label={q.name} />
        </label>
      </div>

      {/* The address the account signs in with, shown as a field because that
          is where someone looks for it — but read-only, because changing it is
          an auth flow (confirm the new address, keep the old one working until
          they do) and not a text box. `readOnly` rather than `disabled`: a
          disabled input is skipped by keyboard navigation and not read out,
          which would hide the answer from exactly the people who need it. */}
      <div className="mt-6">
        <p className="h-sec mb-3">Email</p>
        <label className="text-field">
          <input type="email" value={email ?? ''} readOnly aria-label="Email"
                 className="text-field-locked" />
        </label>
      </div>

      <div className="mt-9">
        <p className="h-sec mb-3">{q.age}</p>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map(([v, l]) => (
            <Chip key={v} on={ageBand === v} onClick={() => setAgeBand(v)}>{l}</Chip>
          ))}
        </div>
        {/* At the question, not in the footer — this is where it becomes relevant. */}
        {!parent && <p className="mt-3 pl-0.5 text-body font-medium leading-snug text-on-surface-variant">
          Under 13? Get a parent to do this with you.
        </p>}
      </div>

      <div className="mt-8">
        <p className="h-sec mb-3">{q.where}</p>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <Chip key={p} on={positions.includes(p)} onClick={() => togglePosition(p)}>{p}</Chip>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="h-sec mb-3">{q.foot}</p>
        {/* Same component as the Train mode switch, different semantics: nothing
            is revealed by choosing, so this is a radiogroup, not a tablist.
            Arrow keys move the choice, which is what the role promises. */}
        <div className="segmented" role="radiogroup" aria-label="Dominant foot"
             onKeyDown={onFootKey}>
          {FEET.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={foot === v}
                    tabIndex={foot === v || (!foot && v === 'left') ? 0 : -1}
                    onClick={() => setFoot(v)}
                    className={`segment pressable ${foot === v ? 'segment-on' : ''}`}>
              <CheckIcon className="seg-check" />
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Below the line but above the button. Neither of these changes a drill,
          so neither is allowed to look required — the rule is the line and the
          label, not the position. Sitting under the save button meant they were
          past the end of the form: anyone who filled in the four questions and
          pressed the obvious control never saw them, and the two fields that
          most needed to be a free choice were the two nobody was offered.
          Region rather than town, never device location, both skippable. */}
      <div className="mt-10 border-t border-outline-variant pt-5">
        <p className="h-sec mb-3">{q.team}</p>
        <label className="text-field">
          <span>Club</span>
          <input type="text" value={club} onChange={(e) => setClub(e.target.value)}
                 placeholder={q.club} autoComplete="off" />
        </label>
        <label className="text-field mt-4">
          <span>Location</span>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                 placeholder="e.g. Pennsylvania" autoComplete="off" />
        </label>
      </div>

      <button type="button" onClick={save} disabled={!complete || busy}
              className="btn-primary btn-big mt-8 w-full">
        {busy ? 'Saving…' : returning ? 'Save' : 'Done'}
      </button>
      {error && <p className="mt-3 text-body-sm font-medium text-error">{error}</p>}

    </div>
  );
}

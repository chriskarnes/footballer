'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, CheckIcon } from './Chip';

/**
 * The Me empty state: four questions, each of which changes what the player
 * gets. Nothing here is asked for its own sake, and the two fields that change
 * nothing are below a line and marked optional.
 *
 * Copy is addressed to the player, because the player is who answers it. The
 * account model is parent-signs-up / child-uses, which leaves a real gap at
 * the handoff — a parent who never passed the phone over will read "How old
 * are you" and answer about themselves. The fix belongs at the end of signup,
 * not here; see the open questions in the migration brief.
 */

const AGE_BANDS: [string, string][] = [
  ['u10', 'Under 10'], ['10_12', '10–12'], ['13_15', '13–15'],
  ['16_18', '16–18'], ['18_plus', '18+'],
];

const POSITIONS = [
  'GK', 'Centre-back', 'Full-back', 'Defensive mid',
  'Centre mid', 'Attacking mid', 'Winger', 'Striker',
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

export function ProfileSetup({ email, initial }: { email?: string; initial?: ProfileValues }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.display_name ?? '');
  const [ageBand, setAgeBand] = useState(initial?.age_band ?? '');
  const [positions, setPositions] = useState<string[]>(initial?.positions ?? []);
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
      // First time through, the whole point of answering is the week it builds,
      // so go there. Someone correcting one answer is not asking to be moved.
      router.push(returning ? '/me' : '/plan');
      router.refresh();
    } catch {
      setError('Could not save that just now. Your answers are still here — try again.');
      setBusy(false);
    }
  }

  return (
    <div className="animate-pop">
      <p className="eyebrow mb-3">Account{email ? ` · ${email}` : ''}</p>
      <h1 className="h-page">{returning ? 'Your profile' : 'Let’s set you up'}</h1>

      {/* No stats row. A 0 / 0m / 0 version of the populated screen reads as
          failure rather than as a new start. */}
      <div className="card-flat mt-6 p-5">
        <div className="h-card">{returning ? 'What your sessions are built from' : 'Nothing here yet'}</div>
        <p className="mt-1.5 text-[14px] leading-snug text-on-surface-variant">
          {returning
            ? 'Change any of it and the next session you build will follow. Each answer changes what you get — nothing here is asked for its own sake.'
            : 'Four questions and I’ll build your first week. Each one changes what you get — nothing here is asked for its own sake.'}
        </p>
        <div className="progress mt-4">
          <div style={{ width: `${(answered / 4) * 100}%` }} />
        </div>
        <p className="eyebrow mt-2" aria-live="polite">{answered} of 4 answered</p>
      </div>

      {/* Name is required now the profile is about someone else, but a first
          name or nickname is all the app ever needs. A full legal name adds
          nothing to a drill plan and a great deal to the blast radius. */}
      <div className="mt-9">
        <p className="eyebrow mb-0.5">What should I call you</p>
        <p className="mb-2.5 text-[12.5px] text-on-surface-variant">
          First name or a nickname — it&rsquo;s just what the app calls you.
        </p>
        <label className="text-field">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="e.g. Sam" autoComplete="off"
                 aria-label="What should I call you" />
        </label>
      </div>

      <div className="mt-9">
        <p className="eyebrow mb-0.5">How old are you</p>
        <p className="mb-2.5 text-[12.5px] text-on-surface-variant">
          Sets how long a session runs and how hard it pushes you.
        </p>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map(([v, l]) => (
            <Chip key={v} on={ageBand === v} onClick={() => setAgeBand(v)}>{l}</Chip>
          ))}
        </div>
        {/* At the question, not in the footer — this is where it becomes relevant. */}
        <p className="mt-3 pl-0.5 text-[12.5px] leading-snug text-on-surface-variant">
          Under 13? Grab a parent — they need to set this up with you.
        </p>
      </div>

      <div className="mt-8">
        <p className="eyebrow mb-0.5">Where do you play</p>
        <p className="mb-2.5 text-[12.5px] text-on-surface-variant">
          Picks which drills come up. Choose as many as apply.
        </p>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <Chip key={p} on={positions.includes(p)} onClick={() => togglePosition(p)}>{p}</Chip>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow mb-0.5">Dominant foot</p>
        <p className="mb-2.5 text-[12.5px] text-on-surface-variant">
          Sets how much weak-foot work gets built into your sessions.
        </p>
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

      <button type="button" onClick={save} disabled={!complete || busy}
              className="btn-primary mt-8 w-full">
        {busy ? 'Saving…' : returning ? 'Save changes' : 'Build my first week'}
      </button>
      {error && <p className="mt-3 text-[13px] font-medium text-error">{error}</p>}

      {/* Below the line. Neither of these changes a drill, so neither is allowed
          to look required. Region rather than town, never device location, and
          both genuinely skippable. */}
      <div className="mt-10 border-t border-outline-variant pt-5">
        <p className="eyebrow mb-0.5">Optional</p>
        <p className="mb-3.5 text-[12.5px] text-on-surface-variant">
          Doesn&rsquo;t change your plan. Skip it and nothing is lost.
        </p>
        <label className="text-field">
          <span>Region</span>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                 placeholder="e.g. Pennsylvania" autoComplete="off" />
        </label>
        <label className="text-field mt-4">
          <span>Club</span>
          <input type="text" value={club} onChange={(e) => setClub(e.target.value)}
                 placeholder="Your team, if you’re in one" autoComplete="off" />
        </label>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-on-surface-variant">
        You can change or delete any of this later from your profile.
      </p>
    </div>
  );
}

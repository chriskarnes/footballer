'use client';
import { useState } from 'react';
import { SignIn } from './SignIn';
import { JoinButton } from './JoinButton';
import type { Who } from '@/lib/who';


const CHOICES: { who: Who; title: string }[] = [
  { who: 'player', title: 'I’m the player' },
  { who: 'parent', title: 'I’m a parent' },
];

/**
 * The card under the join page's header. For a player invite it first asks
 * whose email this is, the player's or a parent's, then the email form (or,
 * already signed in, the join button). The answer rides along in the emailed
 * link (`?as=`), so it survives the trip through the inbox and is saved when
 * they join. Trainer invites skip the question.
 */
export function JoinFlow({ code, role, email, initial }: {
  code: string; role: 'player' | 'trainer'; email: string | null; initial: Who | null;
}) {
  const [who, setWho] = useState<Who | null>(initial);
  const as = role === 'trainer' ? 'a trainer' : who === 'parent' ? 'a parent' : 'a player';

  if (role === 'trainer') {
    return email
      ? <JoinButton code={code} label="Join as a trainer" email={email} />
      : <SignIn next={`/join/${code}`} title="Join as a trainer" />;
  }

  return (
    <div className="space-y-3">
      <fieldset className="card p-5">
        <legend className="sr-only">Who&rsquo;s signing up?</legend>
        <div className="h-card" aria-hidden>Who&rsquo;s signing up?</div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {CHOICES.map((c) => {
            const on = who === c.who;
            return (
              <label key={c.who}
                     className={`pressable relative cursor-pointer rounded-large border-2 p-3.5 transition-colors
                       ${on ? 'border-primary bg-primary-container' : 'border-outline-variant'}`}>
                <input type="radio" name="who" value={c.who} checked={on} onChange={() => setWho(c.who)} className="sr-only" />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-body-lg font-bold leading-tight text-on-surface">{c.title}</span>
                  <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-label-sm font-black
                    ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline'}`}>{on && '✓'}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {who && (
        <div key={who} className="animate-pop">
          {email
            ? <JoinButton code={code} who={who} label={`Join as ${as}`} email={email} />
            : <SignIn next={`/join/${code}?as=${who}`} title="Your email" />}
        </div>
      )}
    </div>
  );
}

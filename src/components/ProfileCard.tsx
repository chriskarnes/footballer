import Link from 'next/link';
import type { ProfileValues } from './ProfileSetup';
import { Avatar } from './Avatar';

/**
 * The profile as it reads back to the player: who this account is, and the four
 * things about them that change what a session contains.
 *
 * Only what has been answered is shown. A row reading "Club: —" is a blank
 * pretending to be information, and the profile screen is one tap away for
 * anyone who wants to fill it in.
 */

const FOOT_LABEL: Record<string, string> = {
  left: 'Left footed', right: 'Right footed', both: 'Both footed',
};

export function ProfileCard({
  profile, email, avatar,
}: {
  profile: ProfileValues | null;
  email?: string;
  /** Their photo's address, when they've added one. */
  avatar?: string | null;
}) {
  const name = profile?.display_name?.trim();
  const positions = (profile?.positions ?? []).filter(Boolean);

  // Labelled rows rather than one run-on line: a player is a winger, at a club,
  // in a region, and those are three different facts. Run together they read as
  // one string and the last of them is what gets truncated away on a phone —
  // which in practice meant the location was never visible.
  const rows: [string, string][] = ([
    ['Position', positions.length ? positions.join(', ') : null],
    ['Club', profile?.club?.trim() || null],
    ['Location', profile?.region?.trim() || null],
    ['Foot', profile?.dominant_foot ? FOOT_LABEL[profile.dominant_foot] : null],
  ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]);

  const bare = !name && !rows.length;

  return (
    <>
      {/* The page's headline: who this is. Me was the one tab without one —
          it opened on a small label and a Sign out link. The name is the
          headline, at the size every other tab's is. */}
      <div className="flex items-center gap-4">
        <Avatar name={name} email={email} src={avatar} />
        <div className="min-w-0 flex-1">
          <h1 className="h-hero break-words">{name || 'Your training'}</h1>
          {email && (
            <p className="mt-1 truncate text-[13px] text-on-surface-variant">{email}</p>
          )}
        </div>
      </div>

      <div className="card mt-6 p-5">
        {rows.length > 0 && (
          <dl className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-3">
                <dt className="eyebrow w-[68px] shrink-0">{label}</dt>
                <dd className="min-w-0 flex-1 text-[14px] font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {!rows.length && (
          <p className="text-[13.5px] leading-snug text-on-surface-variant">
            {bare
              ? 'Nothing here yet. Four questions — your age, where you play, and which foot you favour — change what every session you build contains.'
              : 'Add where you play and which foot you favour — both change what a session contains.'}
          </p>
        )}

        <Link href="/me/profile" className="btn-ghost mt-4 w-full">
          {bare ? 'Set up your profile' : 'Edit profile'}
        </Link>
      </div>
    </>
  );
}

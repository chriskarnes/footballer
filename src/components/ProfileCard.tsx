import Link from 'next/link';
import type { ProfileValues } from './ProfileSetup';

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

/**
 * Up to two initials, from a name the player chose. Falls back to the email's
 * first character — never to a silhouette, which says "no photo" when the
 * actual state is "we have not asked you for one".
 */
function initials(name?: string | null, email?: string): string {
  const source = (name ?? '').trim();
  if (!source) return (email ?? '?').trim().charAt(0).toUpperCase() || '?';
  const words = source.split(/\s+/).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join('');
}

export function ProfileCard({
  profile, email,
}: {
  profile: ProfileValues | null;
  email?: string;
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
    <div className="card mt-6 p-5">
      <div className="flex items-center gap-4">
        {/* Initials, not a silhouette. The ring is the same secondary-container
            pair a selected chip uses, so the avatar is made of roles the rest
            of the app already spends. */}
        <span aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full
                         bg-secondary-container font-brand text-[19px] font-extrabold
                         tracking-tighter text-on-secondary-container">
          {initials(name, email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="h-card break-words">{name || email || 'Your profile'}</div>
          {name && email && (
            <p className="mt-0.5 truncate text-[12.5px] text-on-surface-variant">{email}</p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-outline-variant pt-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-3">
              <dt className="eyebrow w-[68px] shrink-0">{label}</dt>
              <dd className="min-w-0 flex-1 text-[14px] font-medium text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {bare && (
        <p className="mt-4 text-[13.5px] leading-snug text-on-surface-variant">
          Nothing here yet. Four questions — your age, where you play, and which foot
          you favour — change what every session you build contains.
        </p>
      )}

      <Link href="/me/profile"
            className="btn-ghost mt-4 flex w-full items-center justify-center py-3 text-[13.5px]">
        {bare ? 'Set up your profile' : 'Edit profile'}
      </Link>
    </div>
  );
}

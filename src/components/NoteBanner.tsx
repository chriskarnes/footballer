import Link from 'next/link';
import { getUnread } from '@/lib/notes';

/**
 * The newest unread note from the player's trainer, on Me and on Train while
 * they wait for a week (with a week, Train's band carries it instead). A
 * brand block, so it reads as the academy speaking. Renders nothing when
 * there's nothing unread, or for anyone who isn't a player here.
 */
export async function NoteBanner() {
  const unread = await getUnread();
  if (!unread.length) return null;
  const n = unread[0];
  return (
    <Link href="/me/notes" className="pressable mb-6 mt-1 block brand-card p-5 shadow-level2">
      <p className="text-body font-bold text-brand-accent">{n.author} says</p>
      <p className="mt-1.5 line-clamp-3 text-title font-semibold leading-snug">{n.body}</p>
      {unread.length > 1 && (
        <p className="mt-3 text-body font-semibold text-on-surface-brand-variant">+{unread.length - 1} more</p>
      )}
    </Link>
  );
}

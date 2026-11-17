import Link from 'next/link';
import { getUnread } from '@/lib/notes';
import { getTrainer } from '@/lib/player-week';
import { Avatar } from './Avatar';

/**
 * The newest unread note from the player's trainer, on Me and on Train while
 * they wait for a week (with a week, Train's band carries it instead). A
 * brand block, so it reads as the academy speaking, with the trainer's face
 * beside their words. Renders nothing when there's nothing unread, or for
 * anyone who isn't a player here.
 */
export async function NoteBanner() {
  const unread = await getUnread();
  if (!unread.length) return null;
  const n = unread[0];
  const trainer = await getTrainer().catch(() => null);
  // A note from another trainer here gets that trainer's initial, not the owner's photo.
  const theirs = !!trainer?.name && n.author.split(' ')[0] === trainer.name;
  return (
    <Link href="/me/notes" className="pressable mb-6 mt-1 flex items-start gap-3.5 brand-card p-5 shadow-level2">
      <Avatar name={n.author} src={theirs ? trainer?.photo ?? null : null} className="h-11 w-11 text-body-lg" onBrand />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold text-brand-accent">{n.author} says</span>
        <span className="mt-1 line-clamp-3 block text-title font-semibold leading-snug">{n.body}</span>
        {unread.length > 1 && (
          <span className="mt-3 block text-body font-semibold text-on-surface-brand-variant">+{unread.length - 1} more</span>
        )}
      </span>
    </Link>
  );
}

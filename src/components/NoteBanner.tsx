import Link from 'next/link';
import { getViewer } from '@/lib/viewer';
import { readInbox, ago } from '@/lib/notes';

/**
 * The newest unread note from the player's trainer, at the top of Train and
 * Me — where a player looks first. A brand block, so it reads as the
 * academy speaking. Renders nothing when there's nothing unread, or for
 * anyone who isn't a player here.
 */
export async function NoteBanner() {
  try {
    const v = await getViewer();
    if (!v.user || !v.academy || v.role !== 'player') return null;
    const notes = await readInbox(v.db, v.user.id, v.academy.id, 20);
    const unread = notes.filter((n) => !n.seen);
    if (!unread.length) return null;
    const n = unread[0];
    return (
      <Link href="/me/notes" className="pressable mb-6 mt-1 block rounded-[20px] border border-brand-edge bg-surface-brand p-5 text-on-surface-brand shadow-level2">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-brand-accent">
          {n.kind === 'nudge' ? 'Nudge' : 'Note'} from {n.author} · {ago(n.at)}
        </p>
        <p className="mt-2 line-clamp-3 text-[15px] font-semibold leading-snug">{n.body}</p>
        <p className="mt-3 text-[12.5px] font-semibold text-on-surface-brand-variant">
          {unread.length > 1 ? `${unread.length} new notes · Read them ›` : 'Read ›'}
        </p>
      </Link>
    );
  } catch {
    return null;
  }
}

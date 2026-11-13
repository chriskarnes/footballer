import { BackLink } from '@/components/BackLink';
import { MarkSeen } from '@/components/MarkSeen';
import { getViewer } from '@/lib/viewer';
import { readInbox, ago } from '@/lib/notes';

export const metadata = { title: 'Notes from your trainer' };

/**
 * Every note the player's trainers have sent, newest first. Opening the page
 * is reading them: unread ones are marked seen, which is what the trainer's
 * "Seen" shows. New ones keep their dot for this visit so the player can
 * tell which they hadn't read.
 */
export default async function NotesPage() {
  const v = await getViewer();
  const notes = v.user && v.academy ? await readInbox(v.db, v.user.id, v.academy.id) : [];
  const unread = notes.filter((n) => !n.seen).map((n) => n.id);

  return (
    <div className="animate-pop">
      <BackLink href="/me" label="Me" />
      <h1 className="h-page">Notes from your trainer</h1>
      {notes.length ? (
        <ul className="mt-6 space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="card p-5">
              <p className="flex items-center gap-2 text-body font-bold text-on-surface-variant">
                {!n.seen && <><span className="h-2 w-2 rounded-full bg-on-surface" aria-hidden="true" /><span className="sr-only">New:</span></>}
                {n.author} · {ago(n.at)}
              </p>
              <p className="mt-1.5 whitespace-pre-line text-title-sm leading-snug text-on-surface">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-body text-on-surface-variant">No notes yet.</p>
      )}
      {!!unread.length && <MarkSeen ids={unread} />}
    </div>
  );
}

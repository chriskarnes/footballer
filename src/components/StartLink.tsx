'use client';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/client';

/**
 * Start, on Train's band. When the band is showing a note from the trainer,
 * starting the session counts as having read it: the note was right above
 * the button. A write, so on the tap, not during render.
 */
export function StartLink({ href, seen, className, children }: {
  href: string; seen?: string | null; className: string; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className}
          onClick={() => { if (seen) browserClient().rpc('mark_notes_seen', { p_ids: [seen] }).then(() => {}, () => {}); }}>
      {children}
    </Link>
  );
}

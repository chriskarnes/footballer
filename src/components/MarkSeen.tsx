'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';

/** Marks notes read once they've been on screen — a write, so not during render. */
export function MarkSeen({ ids }: { ids: string[] }) {
  const router = useRouter();
  useEffect(() => {
    // Then refresh, so going Back to Train or Me doesn't bring the banner for
    // a note just read back out of the router's cache. The refresh redraws
    // this page with them read; NewDot keeps their dots for this visit.
    browserClient().rpc('mark_notes_seen', { p_ids: ids }).then(() => router.refresh(), () => {});
  }, [ids, router]);
  return null;
}

/**
 * A note's "new" dot, for this visit. It remembers what the page first said:
 * the refresh above comes back with the note read, and the dot vanishing
 * under the player's eyes would leave them not knowing which were new.
 */
export function NewDot({ fresh }: { fresh: boolean }) {
  const [shown] = useState(fresh);
  if (!shown) return null;
  return <><span className="h-2 w-2 rounded-full bg-on-surface" aria-hidden="true" /><span className="sr-only">New:</span></>;
}

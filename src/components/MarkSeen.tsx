'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';

/** Marks notes read once they've been on screen — a write, so not during render. */
export function MarkSeen({ ids }: { ids: string[] }) {
  const router = useRouter();
  useEffect(() => {
    // Then refresh, so going Back to Train or Me doesn't bring the banner for
    // a note just read back out of the router's cache.
    browserClient().rpc('mark_notes_seen', { p_ids: ids }).then(() => router.refresh(), () => {});
  }, [ids, router]);
  return null;
}

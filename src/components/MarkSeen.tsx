'use client';
import { useEffect } from 'react';
import { browserClient } from '@/lib/supabase/client';

/** Marks notes read once they've been on screen — a write, so not during render. */
export function MarkSeen({ ids }: { ids: string[] }) {
  useEffect(() => {
    browserClient().rpc('mark_notes_seen', { p_ids: ids }).then(() => {}, () => {});
  }, [ids]);
  return null;
}

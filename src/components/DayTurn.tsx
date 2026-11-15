'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNow } from '@/lib/use-now';

/**
 * Asks the server for the page again when the day has changed under an app
 * left open: the trainer's week and "today" are drawn there.
 */
export function DayTurn() {
  const router = useRouter();
  const now = useNow();
  const first = useRef(true);
  useEffect(() => {
    if (!now) return;
    if (first.current) { first.current = false; return; }
    router.refresh();
  }, [now, router]);
  return null;
}

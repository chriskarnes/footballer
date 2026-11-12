import { redirect } from 'next/navigation';
import { speedAllowed } from '@/lib/speed-gate';

/**
 * Speed & Stamina is the trainer's choice for their players (0019). With it
 * off there's no Speed tab, so an old link or a calendar event lands on Train
 * instead. Nothing of theirs is deleted.
 */
export default async function SpeedLayout({ children }: { children: React.ReactNode }) {
  if (!(await speedAllowed().catch(() => true))) redirect('/');
  return children;
}

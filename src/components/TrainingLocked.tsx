import Link from 'next/link';
import { myConsentGate } from '@/lib/consent-server';
import { rootHref } from '@/lib/root-link';
import { ConsentGate } from './ConsentGate';

/**
 * What a training page gives a player who may not open it (0038, 0040,
 * 0043): free days over with no card, switched off by their trainer, or
 * under 13 with no parent's or guardian's agreement yet. The app's frame
 * shows the full screen in its place on a fresh load; this is what the page
 * itself sends, so the sessions aren't in it for anyone who looks.
 */
export async function TrainingLocked() {
  const gate = await myConsentGate();
  if (gate) return <ConsentGate {...gate} privacy={await rootHref('/privacy')} />;
  return (
    <div className="animate-pop pt-6">
      <h1 className="h-page">Training is locked</h1>
      <p className="mt-3 text-body leading-relaxed text-on-surface-variant">Your membership needs a quick look before you can train. Show this to whoever looks after it.</p>
      <Link href="/membership" className="btn-primary pressable mt-5 inline-flex">Membership</Link>
    </div>
  );
}

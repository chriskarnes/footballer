import Link from 'next/link';

/**
 * What a training page gives a player who may not open it (0038, 0040): free
 * days over with no card, or switched off by their trainer. The app's frame
 * shows the full paywall in its place on a fresh load; this is what the page
 * itself sends, so the sessions aren't in it for anyone who looks.
 */
export function TrainingLocked() {
  return (
    <div className="animate-pop pt-6">
      <h1 className="h-page">Training is locked</h1>
      <p className="mt-3 text-body leading-relaxed text-on-surface-variant">Your membership needs a quick look before you can train. Show this to whoever looks after it.</p>
      <Link href="/membership" className="btn-primary pressable mt-5 inline-flex">Membership</Link>
    </div>
  );
}

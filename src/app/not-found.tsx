import Link from 'next/link';

/**
 * Anything that isn't here (a session the trainer has since removed, an old
 * link): the app's own words and one way on, not the framework's bare 404.
 */
export default function NotFound() {
  return (
    <div className="animate-pop pt-10">
      <h1 className="h-page">This isn&rsquo;t here any more</h1>
      <p className="mt-2 text-body-lg leading-relaxed text-on-surface-variant">
        It may have been removed, or the link is old. Your training is still where it was.
      </p>
      <Link href="/" className="btn-primary pressable mt-6 w-full">Go to Train</Link>
    </div>
  );
}

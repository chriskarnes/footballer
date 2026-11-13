import Link from 'next/link';
import { PageHead } from './PageHead';

/**
 * A page whose players couldn't be read. Said as that, with a way to try
 * again — before, it drew as an empty roster ("no players yet"), or a player
 * page as Not found, which reads as something gone rather than something slow.
 */
export function LoadFailed({ title, path, back }: { title: string; path: string; back?: { href: string; label: string } }) {
  return (
    <div className="animate-pop">
      <PageHead title={title} back={back} />
      <p role="alert" className="mt-6 text-body text-on-surface-variant">
        Couldn&rsquo;t load your players just now.{' '}
        <Link href={path} className="font-semibold text-on-surface underline underline-offset-4">Try again</Link>
      </p>
    </div>
  );
}

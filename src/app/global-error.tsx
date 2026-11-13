'use client';
import './globals.css';

/**
 * The last resort, when the root layout itself fails. It has no layout around
 * it, so it brings its own document; globals.css gives it the app's colors.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-surface text-on-surface">
        <title>Something went wrong</title>
        <main className="mx-auto max-w-md px-5 pt-16">
          <h1 className="h-page">That didn&rsquo;t load</h1>
          <p className="mt-3 text-body-lg leading-relaxed text-on-surface-variant">
            Try again. If you&rsquo;re offline, nothing you&rsquo;ve done is lost.
          </p>
          <button type="button" onClick={() => retry()} className="btn-primary btn-big pressable mt-6 w-full">Try again</button>
          {/* A plain link: the router is what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn-ghost pressable mt-3 min-h-13 w-full">Back to Train</a>
        </main>
      </body>
    </html>
  );
}

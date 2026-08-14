'use client';
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';

/**
 * The "put me on your home screen" prompt.
 *
 * Two rules shape this component:
 *
 * 1. **It is never required.** Train.futbol works completely from a link — that is the
 *    whole point of shipping web. So the nudge waits until the third visit, and
 *    once dismissed it never comes back. A player who ignores it loses nothing.
 *
 * 2. **iOS and Android are different problems.** Chrome fires `beforeinstallprompt`
 *    and we can install in one tap. Safari fires nothing and exposes no API, so the
 *    only honest thing to do is point at the Share button and draw the icon, because
 *    "tap Share then Add to Home Screen" is meaningless if you don't know which of
 *    the eleven icons on that toolbar is Share.
 */

const VISITS = 'forge.visits';
const DISMISSED = 'forge.installNudge.dismissed';
const SHOW_AFTER_VISITS = 3;

type Platform = 'ios' | 'android' | null;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  // iOS predates the display-mode media query and uses this instead.
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIOS = () => {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the only tell.
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export function InstallNudge() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;                      // already installed
    if (localStorage.getItem(DISMISSED)) return;     // asked once, that's enough

    const visits = Number(localStorage.getItem(VISITS) ?? 0) + 1;
    localStorage.setItem(VISITS, String(visits));

    const onPrompt = (e: Event) => {
      e.preventDefault();                            // suppress Chrome's own mini-bar
      setPrompt(e as InstallPromptEvent);
      setPlatform('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    if (isIOS()) setPlatform('ios');

    // Let the page settle before anything slides over it.
    const t = setTimeout(() => { if (visits >= SHOW_AFTER_VISITS) setOpen(true); }, 1800);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); clearTimeout(t); };
  }, []);

  const close = () => {
    haptic('tap');
    localStorage.setItem(DISMISSED, '1');
    setOpen(false);
  };

  const install = async () => {
    if (!prompt) return;
    haptic('select');
    await prompt.prompt();
    await prompt.userChoice;
    localStorage.setItem(DISMISSED, '1');
    setOpen(false);
  };

  if (!open || !platform) return null;

  return (
    <div className="safe-x fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="sheet-in card w-full max-w-lg p-5 shadow-level3" role="dialog"
           aria-label="Add Train.futbol to your home screen">
        <div className="flex items-start gap-3.5">
          {/* The actual icon the player is being offered, rather than a glyph
              that has to be kept in step with it by hand — this one was still
              drawing a gold italic F long after the brand changed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={44} height={44}
               className="h-11 w-11 shrink-0 rounded-[13px]" />
          <div className="min-w-0 flex-1">
            <p className="h-card">Keep Train.futbol one tap away</p>
            <p className="mt-1 text-[13px] leading-snug text-on-surface-variant">
              {platform === 'ios'
                ? 'Add it to your home screen and it opens full screen, with its own icon.'
                : 'Install it and it opens full screen, with its own icon.'}
            </p>
          </div>
          <button onClick={close} aria-label="Not now"
                  className="pressable -mr-1 -mt-1 shrink-0 rounded-full p-2 text-on-surface-variant">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {platform === 'ios' ? (
          <ol className="mt-4 space-y-2.5 border-t border-outline-variant pt-4">
            <li className="flex items-center gap-3 text-[13.5px] font-semibold">
              <span className="tag tag-accent w-5 text-center">1</span>
              <span className="flex items-center gap-1.5">
                Tap
                {/* The Share glyph, drawn rather than described - it is the step people
                    get stuck on, and naming it is not enough. */}
                <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] text-primary" fill="none"
                     stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
                     strokeLinejoin="round" aria-label="the Share button">
                  <path d="M12 15V3M12 3 8.5 6.5M12 3l3.5 3.5" />
                  <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                </svg>
                in the toolbar
              </span>
            </li>
            <li className="flex items-center gap-3 text-[13.5px] font-semibold">
              <span className="tag tag-accent w-5 text-center">2</span>
              <span>Choose <em className="not-italic text-primary">Add to Home Screen</em></span>
            </li>
          </ol>
        ) : (
          <div className="mt-4 flex gap-2.5">
            <button onClick={install} className="btn-primary pressable flex-1">Install</button>
            <button onClick={close} className="btn-ghost pressable">Not now</button>
          </div>
        )}
      </div>
    </div>
  );
}

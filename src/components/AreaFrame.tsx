'use client';
import { usePathname } from 'next/navigation';
import { TabBar } from './TabBar';
import { InstallNudge } from './InstallNudge';
import { CoachFrame } from './coach/CoachFrame';
import Link from 'next/link';
import { AdminFrame } from './admin/AdminFrame';
import { Paywall } from './Paywall';

const inCoach = (path: string) => path === '/coach' || path.startsWith('/coach/');
const inAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');
// Open to a player whose free days are over (0038): their account (to sign
// out, leave or delete), the page that takes the card, and the ways in.
const OPEN = ['/me', '/membership', '/auth', '/join', '/claim', '/request', '/offline'];
const stillOpen = (path: string) => OPEN.some((p) => path === p || path.startsWith(`${p}/`));

/** Where the signed-in player's membership stands, worked out by the layout. */
export type MembershipNotice = {
  /** Free days over and no card: training is replaced by the way to pay. */
  lock: { academy: string; price: string; line: string; paused?: boolean } | null;
  /** A line above the page: free days nearly over, or a payment that failed. */
  note: string | null;
};

/**
 * The player app's frame, or the trainer area's (CoachFrame), by the path.
 *
 * Picked here, in the browser, rather than in the root layout from a request
 * header: the root layout is kept across client-side navigations, so tapping
 * Coach from Train left the coach pages inside the player's phone-width
 * column and tab bar, and "Player view" left Train inside the sidebar.
 * usePathname changes on every navigation, so the frame follows.
 */
export function AreaFrame({ brand, app, academyId, library, plan, speed, membership, children }: {
  brand: React.ReactNode;
  /** The app's name and icon as installed, for the add-to-home-screen prompt. */
  app: { name: string; icon: string };
  academyId: string | null;
  library: boolean; plan: boolean; speed: boolean;
  membership?: MembershipNotice | null;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (inCoach(path)) return <CoachFrame brand={brand}>{children}</CoachFrame>;
  // The platform admin panel: every academy, on a desk.
  if (inAdmin(path)) return <AdminFrame brand={brand}>{children}</AdminFrame>;
  return (
    <div className="pad-nav">
      <main className="safe-t safe-x mx-auto w-full max-w-lg px-5">
        {membership?.lock && !stillOpen(path) ? <Paywall lock={membership.lock} /> : (
          <>
            {membership?.note && !stillOpen(path) && (
              <Link href="/membership" className="card-flat pressable mt-3 flex items-center justify-between gap-3 px-4 py-3 text-body-sm font-semibold text-on-surface">
                <span>{membership.note}</span><span aria-hidden="true">›</span>
              </Link>
            )}
            {children}
          </>
        )}
      </main>
      <TabBar academyId={academyId} library={library} plan={plan} speed={speed} />
      <InstallNudge name={app.name} icon={app.icon} />
    </div>
  );
}

'use client';
import { usePathname } from 'next/navigation';
import { TabBar } from './TabBar';
import { InstallNudge } from './InstallNudge';
import { CoachFrame } from './coach/CoachFrame';
import { AdminFrame } from './admin/AdminFrame';

const inCoach = (path: string) => path === '/coach' || path.startsWith('/coach/');
const inAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');

/**
 * The player app's frame, or the trainer area's (CoachFrame), by the path.
 *
 * Picked here, in the browser, rather than in the root layout from a request
 * header: the root layout is kept across client-side navigations, so tapping
 * Coach from Train left the coach pages inside the player's phone-width
 * column and tab bar, and "Player view" left Train inside the sidebar.
 * usePathname changes on every navigation, so the frame follows.
 */
export function AreaFrame({ brand, app, academyId, library, plan, speed, children }: {
  brand: React.ReactNode;
  /** The app's name and icon as installed, for the add-to-home-screen prompt. */
  app: { name: string; icon: string };
  academyId: string | null;
  library: boolean; plan: boolean; speed: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (inCoach(path)) return <CoachFrame brand={brand}>{children}</CoachFrame>;
  // The platform admin panel: every academy, on a desk.
  if (inAdmin(path)) return <AdminFrame brand={brand}>{children}</AdminFrame>;
  return (
    <div className="pad-nav">
      <main className="safe-t safe-x mx-auto w-full max-w-lg px-5">{children}</main>
      <TabBar academyId={academyId} library={library} plan={plan} speed={speed} />
      <InstallNudge name={app.name} icon={app.icon} />
    </div>
  );
}

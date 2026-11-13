import { SignIn } from '@/components/SignIn';
import { getViewer } from '@/lib/viewer';

/**
 * The trainer area's front door. Returns the viewer when they're staff here,
 * or the page to show instead — each one saying what to do, not just "no".
 */
export async function staffOnly(next: string) {
  const v = await getViewer();
  if (!v.academy) {
    return { page: <Note title="Open your academy">The trainer area lives at your academy&rsquo;s own address, like <b>yourname.train.futbol/coach</b>.</Note> };
  }
  if (!v.user) {
    return { page: <Note title={`${v.academy.name} trainers`}>Sign in with your trainer account.<div className="mt-5"><SignIn next={next} /></div></Note> };
  }
  if (!v.staff) {
    return { page: <Note title="Trainers only">This account isn&rsquo;t a trainer at {v.academy.name}. Ask the owner for the trainer invite link.</Note> };
  }
  return { viewer: v as typeof v & { academy: NonNullable<typeof v.academy>; user: NonNullable<typeof v.user> } };
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-6">
      <p className="eyebrow mb-3">Trainer</p>
      <h1 className="h-page">{title}</h1>
      <div className="mt-3 text-[14px] leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}

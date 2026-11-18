import { BackLink } from '@/components/BackLink';

/**
 * The top of every trainer page: a way back (on pages under another), its
 * name with the one or two things to do beside it, on the same line at every
 * width, and an optional line under it. List pages and detail pages alike,
 * so a page's title sits in the same place wherever you are.
 */
export function PageHead({ title, eyebrow, action, actionRow, back, children }: {
  title: React.ReactNode; eyebrow?: React.ReactNode; action?: React.ReactNode;
  /** More actions than fit beside a title on a phone: there they get the
   *  full width under it, to lay themselves out in. A laptop is unchanged. */
  actionRow?: boolean;
  /** The page this one is under. */
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <header className={back ? '' : 'mt-4 lg:mt-0'}>
      {back && <BackLink href={back.href} label={back.label} />}
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="h-page min-w-0">{title}</h1>
        {action && <div className={`flex flex-wrap gap-2 ${actionRow ? 'w-full lg:w-auto lg:shrink-0' : 'shrink-0'}`}>{action}</div>}
      </div>
      {children && <div className="mt-2 max-w-2xl text-body leading-relaxed text-on-surface-variant">{children}</div>}
    </header>
  );
}

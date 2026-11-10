/**
 * The top of a trainer list page: its name, a line on what it holds, and the
 * one thing to add. The action sits beside the title on a laptop and under
 * it on a phone.
 */
export function PageHead({ title, eyebrow, action, children }: {
  title: React.ReactNode; eyebrow?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="mt-4 flex flex-col gap-4 lg:mt-0 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="h-page">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-on-surface-variant">{children}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

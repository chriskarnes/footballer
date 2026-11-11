/**
 * The top of a trainer list page: its name with the one thing to do beside
 * it, on the same line at every width, and an optional line of numbers under.
 */
export function PageHead({ title, eyebrow, action, children }: {
  title: React.ReactNode; eyebrow?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="mt-4 lg:mt-0">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="h-page min-w-0">{title}</h1>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {children && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-on-surface-variant">{children}</p>}
    </header>
  );
}

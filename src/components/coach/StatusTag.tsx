import type { Status } from '@/lib/progress';

/**
 * Where a player's week stands, in colour: green on track, amber one behind,
 * rose quiet or well behind. The same tones the admin's tags use, so a list
 * reads at a glance rather than dot by dot.
 */
export const STATUS_TONE: Record<Status, string> = {
  good: 'bg-[#DDF3E4] text-[#14532D] dark:bg-[#173B26] dark:text-[#B7EBC6]',
  warn: 'bg-[#FFF0C7] text-[#6B4A00] dark:bg-[#40310A] dark:text-[#FFDF8A]',
  bad: 'bg-[#FCE4EC] text-[#9B1C45] dark:bg-[#4A1F2D] dark:text-[#FFC2D4]',
};

export function StatusTag({ status, children }: { status: Status; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold ${STATUS_TONE[status]}`}>{children}</span>;
}

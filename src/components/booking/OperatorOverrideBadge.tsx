import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * landr-aoak.2 [S3]: the distinct badge marking a force-booked day / window in
 * staff (operator) mode. Shown next to a selection that was pushed past zero
 * availability so the operator can see at a glance which picks bypassed
 * capacity. Amber/warning styling sets it apart from the normal brand-tinted
 * selection chrome. Never rendered for a normal customer (no staff session).
 */
export function OperatorOverrideBadge({ className }: { className?: string }) {
  return (
    <span
      data-testid="operator-override-badge"
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100',
        className,
      )}
    >
      <ShieldAlert className="size-3.5" aria-hidden />
      Operator override
    </span>
  )
}

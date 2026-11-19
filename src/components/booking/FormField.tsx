import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** Label + control + red validation message (landr-opi3), shared by the details and review steps. */
export function Field({
  label,
  htmlFor,
  error,
  action,
  children,
}: {
  label: string
  htmlFor?: string
  /** landr-opi3: when set, renders a red validation message below the input. */
  error?: string
  /**
   * landr-0utgk: optional control rendered right-aligned next to the label
   * (currently only the "copy from main participant" icon). Kept generic
   * rather than a dedicated prop so Field doesn't need to know what the
   * action does.
   */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

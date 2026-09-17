import * as React from "react"

import { cn } from "@/lib/utils"

// landr-de6ej: first textarea in the widget's ui/ kit — mirrors input.tsx's
// class tokens (surface-page well, focus ring, aria-invalid paint) so a
// multi-line field reads as the same family of control, not a foreign one.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 rounded-md border border-input bg-surface-page shadow-well px-3 py-2 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

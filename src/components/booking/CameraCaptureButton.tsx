import { useRef } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  label: string
  onFile: (file: File | null) => void
  disabled?: boolean
  testId: string
}

/**
 * Opens the phone camera directly (`capture`); on desktop browsers the attribute
 * is ignored and the normal image picker opens. The sibling file input keeps the
 * photo-library / file choice.
 */
export function CameraCaptureButton({ label, onFile, disabled, testId }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {label}
      </Button>
    </>
  )
}

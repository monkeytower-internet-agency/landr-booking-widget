import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CameraCaptureButton } from './CameraCaptureButton'

describe('CameraCaptureButton', () => {
  it('opens an image-only camera input and reports the captured photo', () => {
    const onFile = vi.fn()
    render(<CameraCaptureButton label="Take photo" onFile={onFile} testId="cam" />)
    const input = screen.getByTestId('cam') as HTMLInputElement
    expect(input.accept).toBe('image/*')
    expect(input.getAttribute('capture')).toBe('environment')
    const photo = new File([new Uint8Array(4)], 'p.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [photo] } })
    expect(onFile).toHaveBeenCalledWith(photo)
  })
})

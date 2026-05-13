import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('renders the heading and product list using mocks', async () => {
    render(<App />)
    expect(screen.getByText(/Book with para42/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Tandem Classic/i)).toBeInTheDocument()
      expect(screen.getByText(/Tandem Long/i)).toBeInTheDocument()
    })
  })

  it('honours ?operator= override', async () => {
    window.history.replaceState({}, '', '/?operator=acme')
    render(<App />)
    expect(screen.getByText(/Book with acme/i)).toBeInTheDocument()
  })
})

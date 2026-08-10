import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MembershipReturnPage } from './MembershipReturnPage'

const WIDGET_TOKEN = 'mock-widget-token'

function setupUrl(href: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href,
      search: new URL(href).search,
      origin: 'http://stub.invalid',
      pathname: '/',
    },
  })
}

describe('MembershipReturnPage', () => {
  it('renders the pending-activation copy on success, with no membership assertion', () => {
    setupUrl(`http://stub.invalid/?w=${WIDGET_TOKEN}&member=1`)
    render(<MembershipReturnPage status="success" />)
    expect(screen.getByTestId('membership-return-success')).toBeInTheDocument()
    expect(
      screen.getByText(/on your way to becoming a member/i),
    ).toBeInTheDocument()
    // Must not claim the membership is already active — activation is async.
    expect(screen.queryByText(/membership is active/i)).not.toBeInTheDocument()
  })

  it('renders the cancelled card with a non-leaky, no-charge message', () => {
    setupUrl(`http://stub.invalid/?w=${WIDGET_TOKEN}&member=cancelled`)
    render(<MembershipReturnPage status="cancelled" />)
    expect(screen.getByTestId('membership-return-cancelled')).toBeInTheDocument()
    expect(screen.getByText(/checkout cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/have not been charged/i)).toBeInTheDocument()
  })

  it('"Continue browsing" strips the member param and reloads', () => {
    setupUrl(`http://stub.invalid/?w=${WIDGET_TOKEN}&member=cancelled`)
    let navigatedTo = ''
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      set(v: string) {
        navigatedTo = v
      },
      get() {
        return `http://stub.invalid/?w=${WIDGET_TOKEN}&member=cancelled`
      },
    })

    render(<MembershipReturnPage status="cancelled" />)
    fireEvent.click(
      screen.getByRole('button', { name: /continue browsing/i }),
    )

    expect(navigatedTo).toContain(`w=${WIDGET_TOKEN}`)
    expect(navigatedTo).not.toContain('member=')
  })
})

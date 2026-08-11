import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '@/api/client'
import type { Product } from '@/api/types'
import { MembershipCheckoutStep } from './MembershipCheckoutStep'

// ─── Mock API ────────────────────────────────────────────────────────────────
const { mocks } = vi.hoisted(() => ({
  mocks: {
    initiateSubscriptionCheckout: vi.fn<(body: unknown) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return {
    ...real,
    initiateSubscriptionCheckout: mocks.initiateSubscriptionCheckout,
  }
})

// ─── Test fixtures ────────────────────────────────────────────────────────────
const WIDGET_TOKEN = 'mock-widget-token'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'sub-1',
    slug: 'on-air-card',
    name: 'On-Air Card',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'subscription',
    service_time_shape: null,
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    ...overrides,
  }
}

const CHECKOUT_RESP = {
  checkout_url: 'https://checkout.stripe.com/pay/cs_test_membership',
  checkout_session_id: 'cs_test_membership',
}

function setupUrl(search = `?w=${WIDGET_TOKEN}`) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      search,
      href: `http://stub.invalid/${search}`,
      origin: 'http://stub.invalid',
      pathname: '/',
    },
  })
}

function captureNavigation(): { get: () => string } {
  let navigatedTo = ''
  Object.defineProperty(window.location, 'href', {
    configurable: true,
    set(v: string) {
      navigatedTo = v
    },
    get() {
      return `http://stub.invalid/?w=${WIDGET_TOKEN}`
    },
  })
  return { get: () => navigatedTo }
}

describe('MembershipCheckoutStep', () => {
  beforeEach(() => {
    mocks.initiateSubscriptionCheckout.mockReset()
    setupUrl()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the become-a-member form with the product name', () => {
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    expect(screen.getByTestId('membership-checkout-form')).toBeInTheDocument()
    expect(screen.getByText(/On-Air Card/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /become a member/i }),
    ).toBeEnabled()
  })

  it('fires onBack when the Back button is clicked', () => {
    const onBack = vi.fn()
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={onBack}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows a validation error and does not submit when email is invalid', async () => {
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(screen.getByTestId('membership-email-error')).toBeInTheDocument()
    })
    expect(mocks.initiateSubscriptionCheckout).not.toHaveBeenCalled()
  })

  it('submits the form and redirects to checkout_url on success', async () => {
    mocks.initiateSubscriptionCheckout.mockResolvedValue(CHECKOUT_RESP)
    const nav = captureNavigation()

    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'member@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(mocks.initiateSubscriptionCheckout).toHaveBeenCalledOnce()
    })
    const call = mocks.initiateSubscriptionCheckout.mock.calls[0][0] as {
      widget_token: string
      product_id: string
      email: string
      first_name: string | null
      last_name: string | null
      return_url: string
      cancel_url: string
    }
    expect(call.widget_token).toBe(WIDGET_TOKEN)
    expect(call.product_id).toBe('sub-1')
    expect(call.email).toBe('member@example.com')
    expect(call.first_name).toBe('Ada')
    expect(call.last_name).toBeNull()
    expect(call.return_url).toContain('member=1')
    expect(call.return_url).toContain(`w=${WIDGET_TOKEN}`)
    expect(call.cancel_url).toContain('member=cancelled')
    expect(call.cancel_url).toContain(`w=${WIDGET_TOKEN}`)
    expect(nav.get()).toBe(CHECKOUT_RESP.checkout_url)
  })

  it('trims the email and treats a blank optional name as null', async () => {
    mocks.initiateSubscriptionCheckout.mockResolvedValue(CHECKOUT_RESP)
    captureNavigation()

    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: '  member@example.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(mocks.initiateSubscriptionCheckout).toHaveBeenCalledOnce()
    })
    const call = mocks.initiateSubscriptionCheckout.mock.calls[0][0] as {
      email: string
      first_name: string | null
      last_name: string | null
    }
    expect(call.email).toBe('member@example.com')
    expect(call.first_name).toBeNull()
    expect(call.last_name).toBeNull()
  })

  it('disables the submit button while the POST is in flight', async () => {
    let resolveCheckout!: (v: unknown) => void
    mocks.initiateSubscriptionCheckout.mockReturnValue(
      new Promise((resolve) => {
        resolveCheckout = resolve
      }),
    )

    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'member@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    expect(
      screen.getByRole('button', { name: /redirecting to payment/i }),
    ).toBeDisabled()

    resolveCheckout(CHECKOUT_RESP)
  })

  it('shows the membership-unavailable card on a 404 and allows retry', async () => {
    mocks.initiateSubscriptionCheckout.mockRejectedValue(
      new HttpError(404, 'Not Found', '{"error":"subscription_not_found"}'),
    )
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'member@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(screen.getByTestId('membership-checkout-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/membership unavailable/i)).toBeInTheDocument()
    // The raw error body must never be shown to the customer.
    expect(screen.queryByText(/subscription_not_found/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByTestId('membership-checkout-form')).toBeInTheDocument()
  })

  it('shows a rate-limit card on a 429', async () => {
    mocks.initiateSubscriptionCheckout.mockRejectedValue(
      new HttpError(429, 'Too Many Requests', ''),
    )
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'member@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(screen.getByTestId('membership-checkout-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/too many attempts/i)).toBeInTheDocument()
  })

  it('shows a generic error card on an unexpected failure (e.g. 500 or network)', async () => {
    mocks.initiateSubscriptionCheckout.mockRejectedValue(new Error('network down'))
    render(
      <MembershipCheckoutStep
        product={makeProduct()}
        onBack={() => {}}
        widgetToken={WIDGET_TOKEN}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'member@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /become a member/i }))

    await waitFor(() => {
      expect(screen.getByTestId('membership-checkout-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  getPassTiers,
  HttpError,
  requestPassMemberProof,
  requestSubscriptionPerkOtp,
  submitBooking,
} from '@/api/client'
import type {
  PassTier,
  PassTiersResponse,
  Product,
  ServiceRole,
  SubmitBookingBody,
  SubmitBookingResponse,
} from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { countryOptions } from '@/lib/countries'
import { browserLocale } from '@/lib/locale'
import { operatorWallClock } from '@/lib/operatorClock'
import { fmt, tr } from '@/lib/strings'
import { formatDayLabel } from './dateLabel'
import { formatMoney } from './priceSidebarHelpers'
import { StepBackButton } from './StepBackButton'

interface Props {
  product: Product
  widgetToken: string
  serviceRoles: ServiceRole[]
  operatorTimezone?: string | null
  operatorCountry?: string | null
  previewToken?: string
  /** Absent → no Back affordance (start=dates entry). */
  onBack?: () => void
  onConfirmed: (response: SubmitBookingResponse, email: string) => void
}

const MAX_GUESTS = 20

/** Day before the start, UTC midnight — the same placeholder deadline BookingForm sends. */
function cancellationDeadline(startIso: string): string {
  const d = new Date(startIso)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** What a tier is valid for, in words (no dates until the start is known). */
function describeValidity(tier: PassTier, locale: string): string {
  switch (tier.validity_kind) {
    case 'day':
      return tr('passValidityDay', locale)
    case 'days':
      return fmt(tr('passValidityDays', locale), { n: tier.validity_days ?? 0 })
    case 'week':
      return tr('passValidityWeek', locale)
    case 'season':
      return fmt(tr('passValiditySeason', locale), {
        from: tier.season_start ? formatDayLabel(tier.season_start, locale) : '',
        until: tier.season_end ? formatDayLabel(tier.season_end, locale) : '',
      })
  }
}

function money(cents: number, currency: string, locale: string): string {
  return formatMoney((cents / 100).toFixed(2), currency, locale)
}

function splitName(full: string): { first: string; last: string | null } {
  const trimmed = full.trim()
  const at = trimmed.indexOf(' ')
  if (at < 0) return { first: trimmed, last: null }
  return { first: trimmed.slice(0, at), last: trimmed.slice(at + 1).trim() || null }
}

/**
 * checkout for a product_kind='pass' product — tier picker,
 * start date (not for a season), guest count, member price, details, book.
 *
 * Member price: the customer asks for a one-time code (the same emailed code
 * the perk flow uses), exchanges it for a short-lived proof, and the tiers are
 * re-read WITH the proof so the member amount is only ever shown to a verified
 * member. The proof also rides the submit, which re-checks it server-side.
 */
export function PassCheckoutStep({
  product,
  widgetToken,
  serviceRoles,
  operatorTimezone,
  operatorCountry,
  previewToken,
  onBack,
  onConfirmed,
}: Props) {
  const locale = browserLocale()
  const todayIso = useMemo(() => operatorWallClock(operatorTimezone).iso, [operatorTimezone])

  const [data, setData] = useState<PassTiersResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [tierId, setTierId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(todayIso)
  const [guests, setGuests] = useState(1)
  const [guestNames, setGuestNames] = useState<string[]>([''])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [postal, setPostal] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState((operatorCountry ?? '').toUpperCase())

  const [memberOpen, setMemberOpen] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [memberProof, setMemberProof] = useState<string | null>(null)
  const [memberError, setMemberError] = useState(false)
  const [memberBusy, setMemberBusy] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyTiers = useCallback((res: PassTiersResponse) => {
    setData(res)
    setLoadFailed(false)
    setTierId((current) =>
      current && res.tiers.some((t) => t.id === current) ? current : (res.tiers[0]?.id ?? null),
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    getPassTiers(widgetToken, product.product_id)
      .then((res) => {
        if (!cancelled) applyTiers(res)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [widgetToken, product.product_id, applyTiers])

  const tier = data?.tiers.find((t) => t.id === tierId) ?? null
  const isSeason = tier?.validity_kind === 'season'
  const currency = data?.currency ?? 'EUR'
  const isMember = data?.is_member === true
  const anyMemberPrice = data?.tiers.some((t) => t.has_member_price) ?? false

  const setGuestCount = (n: number) => {
    const next = Math.max(1, Math.min(MAX_GUESTS, n))
    setGuests(next)
    setGuestNames((names) => Array.from({ length: next }, (_, i) => names[i] ?? ''))
  }

  const validUntil = useMemo(() => {
    if (!tier || isSeason) return null
    if (tier.validity_kind === 'week') return addDays(startDate, 6)
    if (tier.validity_kind === 'days') return addDays(startDate, (tier.validity_days ?? 1) - 1)
    return startDate
  }, [tier, isSeason, startDate])

  const startInPast = !isSeason && startDate < todayIso
  const emailOk = email.trim().includes('@')
  const detailsComplete =
    firstName.trim() !== '' &&
    emailOk &&
    phone.trim() !== '' &&
    street.trim() !== '' &&
    postal.trim() !== '' &&
    city.trim() !== '' &&
    country.trim() !== '' &&
    guestNames.slice(1).every((n) => n.trim() !== '')
  const canBuy = tier !== null && !startInPast && detailsComplete && !submitting

  const sendCode = async () => {
    if (!emailOk) return
    setMemberBusy(true)
    setMemberError(false)
    try {
      // Always answers the same way (no membership oracle) — never branch on it.
      await requestSubscriptionPerkOtp(widgetToken, email.trim())
    } catch {
      // equally uninformative; the code field is shown either way
    }
    setCodeSent(true)
    setMemberBusy(false)
  }

  const applyCode = async () => {
    setMemberBusy(true)
    setMemberError(false)
    try {
      const res = await requestPassMemberProof(widgetToken, email.trim(), code.trim())
      setMemberProof(res.member_proof)
      applyTiers(
        await getPassTiers(widgetToken, product.product_id, {
          email: email.trim(),
          memberProof: res.member_proof,
        }),
      )
    } catch {
      setMemberProof(null)
      setMemberError(true)
    } finally {
      setMemberBusy(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canBuy || !tier) return
    setSubmitting(true)
    setError(null)
    const bookerName = { first: firstName.trim(), last: lastName.trim() || null }
    const role = serviceRoles[0]?.code ?? 'participant'
    const participants = Array.from({ length: guests }, (_, i) => {
      const name = i === 0 && guestNames[0].trim() === '' ? bookerName : splitName(guestNames[i])
      return {
        first_name: name.first,
        last_name: name.last,
        email: i === 0 ? email.trim() : null,
        // Passes have no per-guest contact step: the booker's phone covers the party.
        phone: phone.trim(),
        service_role_code: role,
      }
    })
    const body: SubmitBookingBody = {
      widget_token: widgetToken,
      customer_first_name: bookerName.first,
      customer_last_name: bookerName.last,
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      customer_billing: {
        address_line1: street.trim(),
        postal_code: postal.trim(),
        city: city.trim(),
        country: country.trim().toUpperCase(),
      },
      customer_preferred_locale: locale,
      cancellation_deadline: cancellationDeadline(isSeason ? todayIso : startDate),
      booking_channel: 'public_website',
      products: [
        {
          product_id: product.product_id,
          pass_tier_id: tier.id,
          quantity: guests,
          selected_days: [isSeason ? (tier.season_start ?? todayIso) : startDate],
        },
      ],
      participants,
      ...(memberProof ? { pass_member_proof: memberProof } : {}),
    }
    try {
      const result = await submitBooking(body, previewToken ? { previewToken } : undefined)
      onConfirmed(result, email.trim())
    } catch (err) {
      const detail = err instanceof HttpError ? (err.detail as { error?: string } | undefined) : undefined
      setError(
        detail?.error === 'pass_start_in_past'
          ? tr('passStartInPast', locale)
          : tr('passCheckoutError', locale),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const total = tier ? tier.unit_price_cents * guests : 0

  return (
    <Card data-testid="pass-checkout">
      <StepBackButton onBack={onBack} label={tr('backToProductsLabel', locale)} />
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{tr('passPickTier', locale)}</CardDescription>
      </CardHeader>
      <CardContent>
        {loadFailed ? (
          <p className="text-sm text-destructive" data-testid="pass-load-failed">
            {tr('passLoadFailed', locale)}
          </p>
        ) : data && data.tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="pass-no-tiers">
            {tr('passNoTiers', locale)}
          </p>
        ) : data ? (
          <form className="flex flex-col gap-5" onSubmit={(e) => void onSubmit(e)}>
            <fieldset className="flex flex-col gap-2" data-testid="pass-tier-list">
              <legend className="sr-only">{tr('passPickTier', locale)}</legend>
              {data.tiers.map((t) => {
                const selected = t.id === tierId
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2 ${
                      selected ? 'border-primary bg-primary/5' : ''
                    }`}
                    data-testid="pass-tier"
                  >
                    <span className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="pass-tier"
                        className="mt-1"
                        checked={selected}
                        onChange={() => setTierId(t.id)}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {describeValidity(t, locale)}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end text-sm">
                      <span data-testid="pass-tier-price">
                        {fmt(tr('passPerGuest', locale), {
                          price: money(t.unit_price_cents, currency, locale),
                        })}
                      </span>
                      {isMember && t.member_price_cents !== null ? (
                        <span className="text-xs text-muted-foreground line-through">
                          {money(t.price_cents, currency, locale)}
                        </span>
                      ) : null}
                      {!isMember && t.has_member_price ? (
                        <span className="text-xs text-muted-foreground">
                          {tr('passMemberHint', locale)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </fieldset>

            {isSeason ? (
              <p className="text-sm text-muted-foreground" data-testid="pass-season-note">
                {tr('passSeasonStartNote', locale)}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <Label htmlFor="pass-start" className="text-xs">
                  {tr('passStartDateLabel', locale)}
                </Label>
                <Input
                  id="pass-start"
                  type="date"
                  min={todayIso}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={startInPast}
                />
                {startInPast ? (
                  <p className="text-xs text-destructive">{tr('passStartInPast', locale)}</p>
                ) : validUntil && validUntil !== startDate ? (
                  <p className="text-xs text-muted-foreground" data-testid="pass-valid-range">
                    {fmt(tr('passValiditySeason', locale), {
                      from: formatDayLabel(startDate, locale),
                      until: formatDayLabel(validUntil, locale),
                    })}
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="pass-guests" className="text-xs">
                {tr('passGuestsLabel', locale)}
              </Label>
              <Input
                id="pass-guests"
                type="number"
                min={1}
                max={MAX_GUESTS}
                value={guests}
                onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
                className="w-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="pass-first" className="text-xs">{tr('firstNameLabel', locale)}</Label>
                <Input id="pass-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pass-last" className="text-xs">{tr('lastNameLabel', locale)}</Label>
                <Input id="pass-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pass-email" className="text-xs">{tr('emailLabel', locale)}</Label>
                <Input id="pass-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pass-phone" className="text-xs">{tr('phoneLabel', locale)}</Label>
                <Input id="pass-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {guests > 1 ? (
              <div className="flex flex-col gap-2" data-testid="pass-guest-names">
                {guestNames.slice(1).map((name, i) => (
                  <div key={i + 1} className="flex flex-col gap-1">
                    <Label htmlFor={`pass-guest-${i + 2}`} className="text-xs">
                      {fmt(tr('passGuestNameLabel', locale), { n: i + 2 })}
                    </Label>
                    <Input
                      id={`pass-guest-${i + 2}`}
                      value={name}
                      onChange={(e) =>
                        setGuestNames((names) => names.map((n, j) => (j === i + 1 ? e.target.value : n)))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{tr('billingAddressTitle', locale)}</p>
              <Input aria-label={tr('billingStreetLabel', locale)} placeholder={tr('billingStreetLabel', locale)} autoComplete="address-line1" value={street} onChange={(e) => setStreet(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input aria-label={tr('billingPostalCodeLabel', locale)} placeholder={tr('billingPostalCodeLabel', locale)} autoComplete="postal-code" value={postal} onChange={(e) => setPostal(e.target.value)} />
                <Input aria-label={tr('billingCityLabel', locale)} placeholder={tr('billingCityLabel', locale)} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <select
                aria-label={tr('billingCountryLabel', locale)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">{tr('billingCountryPlaceholder', locale)}</option>
                {countryOptions(locale).map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {anyMemberPrice && !isMember ? (
              <div className="flex flex-col gap-2" data-testid="pass-member-block">
                {!memberOpen ? (
                  <Button type="button" variant="link" className="self-start px-0" onClick={() => setMemberOpen(true)} data-testid="pass-member-toggle">
                    {tr('passMemberToggle', locale)}
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" size="sm" className="self-start" disabled={!emailOk || memberBusy} onClick={() => void sendCode()} data-testid="pass-member-send">
                      {tr('passMemberSendCode', locale)}
                    </Button>
                    {codeSent ? (
                      <>
                        <p className="text-xs text-muted-foreground">{tr('passMemberCodeSent', locale)}</p>
                        <Label htmlFor="pass-member-code" className="text-xs">{tr('passMemberCodeLabel', locale)}</Label>
                        <div className="flex gap-2">
                          <Input id="pass-member-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
                          <Button type="button" size="sm" disabled={code.trim() === '' || memberBusy} onClick={() => void applyCode()} data-testid="pass-member-apply">
                            {tr('passMemberApply', locale)}
                          </Button>
                        </div>
                      </>
                    ) : null}
                    {memberError ? (
                      <p className="text-xs text-destructive" data-testid="pass-member-error">{tr('passMemberFailed', locale)}</p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            {isMember ? (
              <p className="text-sm font-medium text-primary" data-testid="pass-member-applied">
                {tr('passMemberApplied', locale)}
              </p>
            ) : null}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">{tr('passTotalLabel', locale)}</span>
              <span className="text-lg font-semibold" data-testid="pass-total">
                {money(total, currency, locale)}
              </span>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert" data-testid="pass-error">{error}</p>
            ) : null}

            <Button type="submit" disabled={!canBuy} data-testid="pass-submit">
              {submitting ? tr('passBuying', locale) : tr('passBuyCta', locale)}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

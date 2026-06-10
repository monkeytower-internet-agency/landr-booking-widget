import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  AccommodationStep,
  type AccommodationMode,
} from '@/components/booking/AccommodationStep'
import type {
  OccupantAgeMap,
  RoomAssignmentMap,
  RoomSelection,
} from '@/components/booking/accommodationCalc'
import { AccountLinkPrompt } from '@/components/booking/AccountLinkPrompt'
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker'
import {
  BookingForm,
  type BookingSelection,
} from '@/components/booking/BookingForm'
import { ServiceAddonsStep } from '@/components/booking/ServiceAddonsStep'
import type { AddonSelection } from '@/components/booking/addonsState'
import { CancelPage } from '@/components/booking/CancelPage'
import { Confirmation } from '@/components/booking/Confirmation'
import { DetailsStep } from '@/components/booking/DetailsStep'
import {
  DeclarationsStep,
  type CustomerDeclarations,
  type DeclarationItem,
  type LanguageOption,
} from '@/components/booking/DeclarationsStep'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import { FixedDateWindowPicker } from '@/components/booking/FixedDateWindowPicker'
import { expandWindowDays } from '@/components/booking/expandWindowDays'
import { MultiDayStep } from '@/components/booking/MultiDayStep'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import PriceSidebar from '@/components/booking/PriceSidebar'
import { ProductList } from '@/components/booking/ProductList'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { ShopComingSoonStub } from '@/components/booking/ShopComingSoonStub'
import { SingleDatePicker } from '@/components/booking/SingleDatePicker'
import {
  getOperatorServiceRoles,
  getOperatorSettings,
  getProductAddons,
  HttpError,
  listProductGroups,
} from '@/api/client'
import type { OperatorSettings, Product, ProductGroup, ServiceRole } from '@/api/types'
import {
  type Step,
  type PerRoomAddons,
  deriveAccommodationMode,
  fillFormOrDeclarations,
  sidebarInputsForStep,
  stepAfterAccommodation,
  stepBeforeReview,
} from './appStepMachine'
import { detectRoute } from './detectRoute'
import { LandingPage } from '@/components/booking/LandingPage'
import { TierBadge } from '@/components/TierBadge'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { CategoryStep } from '@/components/booking/CategoryStep'
import { ProductDetailStep } from '@/components/booking/ProductDetailStep'
import { VariantProvider } from '@/lib/variant.tsx'
import { variantFromLocation, previewEnabledFromLocation, hasVariantInLocation, useVariant } from '@/lib/variant'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { VariantSwitcher } from '@/components/booking/VariantSwitcher'
import { loadTileFont } from '@/lib/tileFont'
import type { TileFontKey } from '@/lib/tileFont'
import { StepTransition } from '@/components/booking/StepTransition'

// landr-sbhz.3: operators that require pre-booking customer declarations.
// v1 hardcodes the Para42 slug; v2 would fetch this from the operator settings
// API (operator_declarations table). Exact match on slug — the para42-dev-*
// test slugs do NOT match and are therefore not subject to enforcement.
const OPERATORS_REQUIRING_DECLARATIONS: ReadonlySet<string> = new Set(['para42'])

// Para42 declaration items (v1 hardcoded set).
// Extension point: replace with a fetch from /api/public/operators/{slug}/declarations
// when the operator-configurable declaration feature is implemented.
const PARA42_DECLARATION_ITEMS: DeclarationItem[] = [
  {
    key: 'license_valid',
    label:
      'I have a valid paragliding license that is accepted in Tenerife / the Canary Islands.',
  },
  {
    key: 'insurance_valid',
    label:
      'I have valid health insurance and third-party liability insurance for paragliding.',
  },
  {
    key: 'autonomous_pilot',
    label:
      'I am an autonomous paraglider at intermediate-to-advanced level and can fly independently.',
  },
  {
    key: 'emergency_contact',
    label:
      'I will provide an emergency contact (name + phone number) on the first day of the booking.',
  },
]

const PARA42_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

function readQueryParams() {
  if (typeof window === 'undefined') {
    return {
      token: null as string | null,
      product: null as string | null,
      group: null as string | null,
      previewToken: null as string | null,
      showSoldOut: false,
    }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    // landr-il9f.2: opaque widget token — no slug fallback.
    token: params.get('w'),
    product: params.get('product'),
    group: params.get('group'),
    // landr-7zc5.3: operator preview_token — when present the products
    // fetch uses the preview path which returns drafts too. Absent in
    // normal customer-facing embed URLs (published-only behaviour).
    previewToken: params.get('preview_token'),
    // landr-7jgo: per-embed opt-in to SHOW sold-out products in the
    // catalogue overview (as informational "Fully booked" cards, no CTA)
    // instead of hiding them. Default false. Truthy only for the explicit
    // string 'true' (or '1') so a bare `?show_sold_out` or any other value
    // keeps the safe hide-by-default behaviour. Has NO effect on a
    // single-product deep link (?product=) — that product always renders.
    showSoldOut:
      params.get('show_sold_out') === 'true' ||
      params.get('show_sold_out') === '1',
  }
}

function App() {
  // landr-sgnd: branch on the URL pathname before the booking flow
  // state machinery so we never spin up the operator/product fetches
  // when the customer is just here to cancel.
  const route = useMemo(
    () =>
      typeof window === 'undefined'
        ? { kind: 'booking' as const }
        : detectRoute(window.location.pathname),
    [],
  )
  if (route.kind === 'cancel') {
    return (
      <VariantProvider
        value={variantFromLocation()}
        previewEnabled={previewEnabledFromLocation()}
      >
        {/* landr-aoak.2: staff session context (inactive ⇒ normal widget). */}
        <StaffModeProvider>
          {/* landr-7dya.20: fixed tier badge — visible in all iframe embeds */}
          <TierBadge />
          <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <CancelPage bookingId={route.bookingId} />
            </div>
          </div>
          {/* landr-d8rg.8: live variant switcher (preview links only). */}
          <VariantSwitcher />
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  return (
    <VariantProvider
      value={variantFromLocation()}
      previewEnabled={previewEnabledFromLocation()}
    >
      {/* landr-aoak.2: staff session context (inactive ⇒ normal widget). */}
      <StaffModeProvider>
        {/* landr-7dya.20: fixed tier badge — visible in all iframe embeds */}
        <TierBadge />
        <BookingFlowApp />
        {/* landr-d8rg.8: live variant switcher (preview links only). */}
        <VariantSwitcher />
      </StaffModeProvider>
    </VariantProvider>
  )
}

function BookingFlowApp() {
  const { token, product, group, previewToken, showSoldOut } = useMemo(
    () => readQueryParams(),
    [],
  )
  // landr-il9f.2: no token → landing page immediately (no fetch needed).
  // Unknown token → landing page after the settings fetch returns 404.
  // 'unknown' means "no token supplied"; null means "fetch pending";
  // false means "fetch returned 404".
  const [showLanding, setShowLanding] = useState<boolean>(!token)
  const [step, setStep] = useState<Step>({ name: 'pick-product' })
  // Live selection from the date pickers before the user presses Continue
  // (landr-w7pi). Cleared whenever we leave pick-selection so the next
  // visit to that step starts fresh.
  const [liveSelectionDays, setLiveSelectionDays] = useState<string[]>([])
  // landr-gb2f.1: live participant count + names from DetailsStep before
  // Continue is pressed. Mirrors the liveSelectionDays pattern. Cleared
  // when leaving the details step so back-nav starts fresh.
  const [liveParticipantCount, setLiveParticipantCount] = useState<number>(0)
  const [liveParticipantNames, setLiveParticipantNames] = useState<string[]>([])
  // landr-87n9.2: live-lifted room + per-room add-on selection from
  // AccommodationStep so the PriceSidebar's "At-hotel total" pill updates
  // WHILE the customer picks rooms — without waiting for Continue. Mirrors
  // the liveParticipant* pattern. `touched` is the sentinel that says the
  // customer has made a live change on this visit; until then we fall back
  // to the step's restored values (covers back-nav re-entry where prior
  // rooms live in step.accommodationRooms). All three are cleared whenever
  // we leave the accommodation step so the next visit starts fresh.
  const [liveAccommodationRooms, setLiveAccommodationRooms] = useState<
    RoomSelection[]
  >([])
  const [liveAddons, setLiveAddons] = useState<AddonSelection[]>([])
  const [liveAccommodationTouched, setLiveAccommodationTouched] =
    useState<boolean>(false)
  // landr-d8rg.4: product groups fetched at boot for the category entrance.
  // null = fetch not yet attempted; [] = fetch done (empty or error fallback).
  // Populated by the useEffect below, which silently falls back to []
  // on 404/network error so the widget degrades to pick-product unscoped.
  const [productGroups, setProductGroups] = useState<ProductGroup[] | null>(null)
  // landr-d8rg.4: slug of the group the user picked from pick-category.
  // Passed as productGroup to ProductList so the list is scoped to that group.
  // Cleared when the user returns to pick-category (back-nav).
  const [pickedGroupSlug, setPickedGroupSlug] = useState<string | null>(null)

  // Operator-level flags (landr-e10.9). Defaults to the safe value
  // (expose_seats_to_customer=false) until the fetch resolves so the
  // first render never leaks seat counts for opted-out operators.
  // landr-yp8x adds branding fields (logo_url, primary_color, name) to
  // the same endpoint; defaults stay null so the widget renders its
  // built-in theme until the fetch resolves.
  // slug is initialised to '' and replaced by the server-resolved slug
  // once getOperatorSettings resolves — used for the declarations check.
  const [operatorSettings, setOperatorSettings] = useState<OperatorSettings>({
    slug: '',
    expose_seats_to_customer: false,
    logo_url: null,
    primary_color: null,
    name: null,
    // landr-nils — embed copy null until the fetch resolves.
    widget_headline: null,
    widget_description: null,
    widget_footer: null,
    // landr-atwy — account-link prompt off until the operator opts in.
    offer_account_link: false,
    // landr-jb1k — variant + category config null until the fetch resolves.
    // Null = "use built-in defaults" (aurora, auto column logic, system font).
    widget_variant: null,
    widget_category_columns: null,
    widget_tile_font: null as TileFontKey | null,
    widget_title_case: null,
    // landr-jb1k.4 — tile-style options null until the fetch resolves.
    // Null = "use the variant token defaults" (current/auto behaviour).
    widget_tile_radius: null,
    widget_tile_aspect: null,
    widget_tile_scrim: null,
    widget_tile_hover: null,
  })
  // Operator's active service_roles (landr-mg0a). Starts empty so the
  // DetailsStep dropdown stays hidden during the fetch — BookingForm
  // falls back to the legacy 'participant' code if the customer manages
  // to submit before the list arrives (extremely unlikely; the fetch
  // races multiple full-page paints' worth of UX).
  const [serviceRoles, setServiceRoles] = useState<ServiceRole[]>([])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const settings = await getOperatorSettings(token)
        if (!cancelled) {
          setOperatorSettings(settings)
          setShowLanding(false)
          // landr-jb1k.2: lazy-load the operator's configured font once, if
          // non-system. The import() is no-op for 'system' and for null.
          void loadTileFont(settings.widget_tile_font as TileFontKey | null | undefined)
        }
      } catch (err) {
        // 404 → unknown token → show landing page.
        if (err instanceof HttpError && err.status === 404) {
          if (!cancelled) setShowLanding(true)
        }
        // Any other error: keep the safe defaults — failing the settings
        // fetch must not block booking when the token is valid.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const roles = await getOperatorServiceRoles(token)
        if (!cancelled) setServiceRoles(roles)
      } catch {
        // Empty list is the safe fallback — BookingForm's || 'participant'
        // guard keeps submit working for the default-seeded operator.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // landr-jb1k.2: apply operator's widget_variant once settings resolve.
  // Resolution precedence (highest to lowest):
  //   1. Explicit ?variant= URL param (set at boot OR by the preview switcher
  //      — the switcher writes to the URL via writeVariantToUrl, so
  //      hasVariantInLocation() returns true after any switcher interaction).
  //   2. operatorSettings.widget_variant (this effect — only when no URL param).
  //   3. aurora (the VariantProvider's built-in seed / DEFAULT_VARIANT).
  const { setVariant } = useVariant()
  useEffect(() => {
    if (!operatorSettings.widget_variant) return
    // URL param (initial or switcher-written) takes priority — never clobber it.
    if (hasVariantInLocation()) return
    setVariant(operatorSettings.widget_variant)
  // setVariant is stable (comes from useState setter via the context) — safe
  // to omit from deps. hasVariantInLocation reads window.location.search which
  // is always fresh at effect-run time. The only meaningful dep is the resolved
  // field from the settings object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorSettings.widget_variant])

  /**
   * landr-d8rg.4: fetch product groups for the category entrance. Called
   * once per mount (token is stable). On 404/any error falls back silently
   * to [] so the widget renders pick-product unscoped — the real groups
   * endpoint ships in landr-d8rg.1; until then the API returns 404 and the
   * widget degrades gracefully. Also skipped when a ?group= or ?product=
   * deep link is in the URL (those paths don't need category data).
   *
   * When >1 non-empty group is returned, the step is promoted to
   * pick-category (inside the async callback so the setState is not
   * synchronous within the effect body, satisfying the eslint rule).
   */
  useEffect(() => {
    if (!token) return
    // Deep links bypass the category step entirely — leave productGroups as
    // null (never fetch) so we stay on pick-product unscoped.
    if (group || product) return
    let cancelled = false
    void (async () => {
      try {
        const groups = await listProductGroups(token, {
          previewToken: previewToken ?? undefined,
        })
        if (cancelled) return
        setProductGroups(groups)
        // Route to pick-category when the operator has >1 non-empty group
        // AND the widget is still on the initial pick-product step.
        const nonEmpty = groups.filter((g) => g.product_count > 0)
        if (nonEmpty.length > 1) {
          setStep((current) =>
            current.name === 'pick-product'
              ? { name: 'pick-category', groups }
              : current,
          )
        }
      } catch {
        // 404 from the pre-landing API, network error, etc. — degrade
        // gracefully to the unscoped pick-product list.
        if (!cancelled) setProductGroups([])
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // landr-87n9.2: clear the live-lifted accommodation state. Called on every
  // transition OUT of pick-accommodation (Back, Continue, full restart) so a
  // later visit starts fresh and the sidebar falls back to the step's
  // restored values until the customer makes a new live change.
  const clearLiveAccommodation = useCallback(() => {
    setLiveAccommodationRooms([])
    setLiveAddons([])
    setLiveAccommodationTouched(false)
  }, [])

  const goToProductStep = useCallback(
    (productGroupSlug?: string) => {
      // Clear live selection so that a Back → re-enter cycle shows an
      // empty price sidebar until the user picks days again (landr-w7pi).
      setLiveSelectionDays([])
      // landr-gb2f.1: also clear live participant state on a full restart.
      setLiveParticipantCount(0)
      setLiveParticipantNames([])
      // landr-87n9.2: clear live accommodation state on a full restart.
      clearLiveAccommodation()
      // landr-d8rg.4: when restarting after a booking, go back to pick-product
      // (unscoped or scoped) — not to pick-category. This preserves the
      // existing goToProductStep behavior for post-booking restart.
      setStep({ name: 'pick-product' })
      void productGroupSlug // reserved for future use
    },
    [clearLiveAccommodation],
  )

  /**
   * After date selection, hand off to the DetailsStep (landr-8c03,
   * replacing the count-only ParticipantsStep from landr-mbge). The
   * DetailsStep collects full booker + participant details so the
   * downstream steps (accommodation, sidebar, review) all have the
   * party context to render names/quantities accurately.
   *
   * Non-service product_kind never reaches afterSelection (shop stub
   * fires upstream).
   */
  const afterSelection = (product: Product, selection: BookingSelection) => {
    // The live selection is now committed into the selection object; clear
    // the ephemeral state so it doesn't linger if the user ever navigates
    // back to pick-selection via Back (landr-w7pi).
    setLiveSelectionDays([])
    // landr-gb2f.1: reset live participant state each time we (re-)enter
    // DetailsStep so a Back → re-enter cycle shows the committed sidebar
    // values (from step state) rather than stale live values.
    setLiveParticipantCount(0)
    setLiveParticipantNames([])
    setStep({ name: 'details', product, selection })
  }

  /**
   * After the DetailsStep confirms booker + participants, run the
   * existing post-selection branching:
   *   1. AccommodationStep when the product offers a hotel stay
   *      (landr-vyaz). Add-ons are surfaced INSIDE that step under
   *      each room (landr-cip6).
   *   2. ServiceAddonsStep when the product has no hotel offering but
   *      DOES have add-ons configured (landr-cip6). We do a quick
   *      add-on fetch up front so customers without add-ons don't see
   *      an empty step appear and disappear.
   *   3. Straight through to pick-pickup / fill-form for products with
   *      neither hotel nor add-ons (the legacy short-circuit).
   * The accommodation/service-addons steps always return through
   * afterAccommodation which preserves the pickup-vs-form decision tree.
   */
  const afterDetails = (
    product: Product,
    selection: BookingSelection,
    booker: BookerDetails,
    participants: ParticipantDetails[],
    // landr-87n9.3: non-guiding companions collected by DetailsStep.
    companions: CompanionDetails[],
  ) => {
    const offering = product.hotel_offering ?? 'none'
    if (product.product_kind === 'service' && offering !== 'none') {
      setStep({
        name: 'pick-accommodation',
        product,
        selection,
        booker,
        participants,
        companions,
      })
      return
    }
    if (product.product_kind === 'service') {
      void (async () => {
        let hasAddons: boolean
        try {
          const addons = await getProductAddons(product.product_id)
          hasAddons = addons.length > 0
        } catch {
          hasAddons = false
        }
        if (hasAddons) {
          setStep({
            name: 'pick-service-addons',
            product,
            selection,
            booker,
            participants,
            companions,
          })
        } else {
          // landr-yf0n: hadServiceAddons=false here — the customer
          // skipped this step because the product has no add-ons.
          afterAccommodation(
            product,
            selection,
            booker,
            participants,
            companions,
            [],
            null,
            [],
            false,
          )
        }
      })()
      return
    }
    // landr-yf0n: hadServiceAddons=false — product has no hotel + no
    // add-on probe ran (non-service products short-circuit here).
    afterAccommodation(
      product,
      selection,
      booker,
      participants,
      companions,
      [],
      null,
      [],
      false,
    )
  }

  const afterAccommodation = (
    product: Product,
    selection: BookingSelection,
    booker: BookerDetails,
    participants: ParticipantDetails[],
    // landr-87n9.3: companions roster threads to the submit step.
    companions: CompanionDetails[],
    accommodationRooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[] = [],
    // landr-yf0n: provenance flags so back-nav can hop back through the
    // upstream intermediate steps with their previously confirmed state.
    hadServiceAddons: boolean = false,
    includeHotel: boolean | undefined = undefined,
    // landr-sbhz.4: shared-double flag for back-nav restoration.
    isSharedDouble: boolean | undefined = undefined,
    // landr-ffyg.2: top-level accommodation mode for back-nav restoration.
    accommodationMode: AccommodationMode | undefined = undefined,
    // landr-gb2f.2: participant → room assignment for the submit payload.
    roomAssignment: RoomAssignmentMap | undefined = undefined,
    // landr-doam.1: per-occupant age band + age for the submit payload.
    occupantAgeMap: OccupantAgeMap | undefined = undefined,
    // landr-gb2f.5: raw per-room add-on map for the review display.
    perRoomAddons: PerRoomAddons | undefined = undefined,
    // landr-gb2f.5: room product display names for the review labels.
    roomProductNames: Record<string, string> | undefined = undefined,
  ) => {
    // landr-87n9.2: the selection is now committed into the step state;
    // clear the live-lift so a later Back into pick-accommodation falls back
    // to the restored step values rather than stale live values.
    clearLiveAccommodation()
    const next = stepAfterAccommodation(
      product,
      selection,
      booker,
      participants,
      // landr-87n9.3: companions roster threaded to the submit step.
      companions,
      accommodationRooms,
      hotelLocationId,
      addons,
      hadServiceAddons,
      includeHotel,
      // landr-sbhz.4: shared-double flag threads through for back-nav.
      isSharedDouble,
      // landr-ffyg.2: accommodation mode threads through for back-nav.
      accommodationMode,
      // landr-gb2f.2: participant → room assignment threads through.
      roomAssignment,
      // landr-doam.1: per-occupant age band + age threads through.
      occupantAgeMap,
      // landr-gb2f.5: per-room add-on map threads through to the review.
      perRoomAddons,
      // landr-gb2f.5: room product names thread through to the review.
      roomProductNames,
    )
    // landr-sbhz.3: if stepAfterAccommodation resolved to fill-form and
    // the operator requires declarations, convert to the declarations step
    // so the customer confirms eligibility before the review screen.
    // pick-pickup is left unchanged — the pickup step's onConfirm handler
    // also goes through fillFormOrDeclarations.
    // landr-il9f.2: declarations check now keyed on the server-resolved
    // slug from settings (operatorSettings.slug), not the URL param.
    if (next.name === 'fill-form' && OPERATORS_REQUIRING_DECLARATIONS.has(operatorSettings.slug)) {
      setStep(fillFormOrDeclarations(next, true))
    } else {
      setStep(next)
    }
  }

  /**
   * The selectedDays helper for the AccommodationStep. AvailabilityPicker
   * + time-slot bookings only carry a single date; we wrap it in a one-
   * element array so the deriveStayWindow helper still works.
   */
  const selectionToDays = (selection: BookingSelection): string[] => {
    if (selection.kind === 'slot') return [selection.slot.date]
    return selection.selectedDays
  }

  const sidebarInputs = sidebarInputsForStep(step)

  // landr-il9f.2: no token or unknown token → show the generic landing page.
  if (showLanding) return <LandingPage />

  // landr-yp8x — apply the operator's primary colour as a CSS variable
  // override so every component that reads `var(--primary)` (Button,
  // PriceSidebar CTA, accent borders) automatically picks it up.
  // Setting it as inline style at the widget root means we don't
  // mutate a global stylesheet (which would leak across embeds when
  // the host page mounts more than one widget instance — uncommon but
  // possible). When primary_color is null the inline style isn't
  // applied and the index.css default kicks in.
  const brandStyle: CSSProperties = operatorSettings.primary_color
    ? ({ ['--primary' as never]: operatorSettings.primary_color } as CSSProperties)
    : {}

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={brandStyle}
    >
      {/*
        Outer flex (md and up) puts the step content on the left and the
        sticky PriceSidebar on the right. On mobile the sidebar renders
        as a fixed bottom bar (handled inside PriceSidebar), so the main
        column simply takes the full width. Wider max-w-5xl gives the
        sidebar breathing room without squeezing the step content.
      */}
      <div className="mx-auto flex max-w-5xl flex-col md:flex-row md:items-start gap-6 p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/*
          landr-yp8x / landr-nils — operator brand + intro header. The
          widget is embedded inside the operator's own page, so they own
          this copy. Three independent, optional parts, top to bottom:
            • logo (if uploaded) — NO operator-name fallback: when the
              logo is removed the header shows nothing in its place
              (landr-nils; the old `name` text fallback was dropped).
            • headline (operator-written, e.g. "Book with us")
            • description (operator-written; may carry legal/intro copy)
          `name` is kept only as the logo's alt text. The whole block
          renders only when at least one part is present. Plain text with
          line breaks preserved — never HTML (XSS-safe inside the embed).
        */}
        {(operatorSettings.logo_url ||
          operatorSettings.widget_headline ||
          operatorSettings.widget_description) ? (
          <header className="flex flex-col gap-2">
            {operatorSettings.logo_url ? (
              <img
                src={operatorSettings.logo_url}
                alt={operatorSettings.name ?? operatorSettings.slug}
                className="h-10 w-auto max-w-[160px] object-contain"
                data-testid="widget-logo"
              />
            ) : null}
            {operatorSettings.widget_headline ? (
              <h1
                className="text-xl font-semibold"
                data-testid="widget-headline"
              >
                {operatorSettings.widget_headline}
              </h1>
            ) : null}
            {operatorSettings.widget_description ? (
              <p
                className="text-muted-foreground text-sm whitespace-pre-line"
                data-testid="widget-description"
              >
                {operatorSettings.widget_description}
              </p>
            ) : null}
          </header>
        ) : null}

        {/*
          landr-7zc5.3: preview mode banner — visible to the operator
          when they follow a preview link (preview_token in the URL).
          Customers visiting the live embed never see this banner because
          no preview_token is present in the published embed URL.
        */}
        {previewToken ? (
          <div
            className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            data-testid="preview-mode-banner"
            role="status"
          >
            <span className="font-semibold">Preview mode</span>
            <span>— draft products are visible. This link is for operator review only.</span>
          </div>
        ) : null}

        {/*
          landr-d8rg.8: wrap the step-machine branches in StepTransition,
          keyed by step.name, so each step change replays the subtle
          fade+8px-translate enter motion (suppressed under
          prefers-reduced-motion). The persistent header / preview banner
          above stay OUTSIDE the wrapper so they don't re-animate per step.
          The "back to categories" link is part of the pick-product surface,
          so it lives inside.
        */}
        <StepTransition stepKey={step.name}>
        {/*
          landr-d8rg.4: category entrance — shown when the operator has >1
          non-empty group AND no deep link is set. Selecting a group scopes
          pick-product to that group.
        */}
        {step.name === 'pick-category' ? (
          <CategoryStep
            groups={step.groups}
            hideHeading={Boolean(operatorSettings.widget_headline)}
            columns={operatorSettings.widget_category_columns ?? null}
            tileFont={(operatorSettings.widget_tile_font as TileFontKey | null) ?? null}
            titleCase={operatorSettings.widget_title_case ?? null}
            tileRadius={operatorSettings.widget_tile_radius ?? null}
            tileAspect={operatorSettings.widget_tile_aspect ?? null}
            tileScrim={operatorSettings.widget_tile_scrim ?? null}
            tileHover={operatorSettings.widget_tile_hover ?? null}
            onPick={(g) => {
              // Scope the product list to the chosen group via state, then
              // transition to pick-product. ProductList reads pickedGroupSlug
              // as its productGroup prop (below) so only that group's products
              // are listed.
              setPickedGroupSlug(g.slug)
              setStep({ name: 'pick-product' })
            }}
          />
        ) : null}

        {/*
          landr-d8rg.4: when the user navigated here from pick-category,
          show a "Back to categories" link above the product list so they
          can return to the category entrance without touching ProductList.
          Hidden when no categories were shown (no group was picked, i.e.
          the user is in the flat unscoped list or came from a ?group= link).
        */}
        {step.name === 'pick-product' && pickedGroupSlug && productGroups ? (
          <button
            type="button"
            className="text-primary text-sm underline-offset-2 hover:underline self-start"
            onClick={() => {
              setPickedGroupSlug(null)
              setStep({ name: 'pick-category', groups: productGroups })
            }}
            data-testid="back-to-categories"
          >
            ← All categories
          </button>
        ) : null}

        {step.name === 'pick-product' ? (
          <ProductList
            operatorToken={token!}
            previewToken={previewToken ?? undefined}
            // landr-d8rg.4: if the user came from pick-category, scope the
            // list to the chosen group. The URL ?group= param takes priority
            // (deep-link case); pickedGroupSlug handles the in-app navigation.
            productGroup={group ?? pickedGroupSlug ?? undefined}
            preselectSlug={product ?? undefined}
            // landr-7jgo: per-embed opt-in to show sold-out products as
            // "Fully booked" cards in the overview. Default false (hidden).
            // Ignored when a single-product deep link is in play (the deep
            // link always renders its product, sold-out or not).
            showSoldOut={showSoldOut}
            // landr-d8rg.4: card click → product-detail step (not directly
            // to pick-selection). The groups context is threaded through so
            // the detail page's Back button can return to the scoped list.
            onSelect={(p) => {
              // Preselect path for ?product= deep link: ProductList calls
              // onSelect immediately after resolving the product. In that
              // case we also go to product-detail (not pick-selection),
              // so the deep link shows the detail page first.
              setStep({ name: 'product-detail', product: p })
            }}
            // landr-7jgo: a deep-linked product that is sold out drops into the
            // standalone "Fully booked" state instead of a picker with no dates.
            onPreselectSoldOut={(p) =>
              setStep({ name: 'fully-booked', product: p })
            }
          />
        ) : null}

        {/*
          landr-d8rg.4: product detail page — shown after a card is selected
          from pick-product (or via a ?product= deep link). The Book CTA
          enters the existing afterSelection flow via pick-selection.
          Back returns to pick-product (preserving group scope when applicable)
          or to pick-category when categories were shown and there is no
          scoped group (i.e. the user deep-linked straight to product-detail).
        */}
        {step.name === 'product-detail' ? (
          <ProductDetailStep
            product={step.product}
            onBook={() =>
              setStep({ name: 'pick-selection', product: step.product })
            }
            onBack={() => {
              // landr-d8rg.4 Back nav:
              //   - If we have a picked group slug, return to the scoped product list.
              //   - If we have multiple non-empty groups (categories were shown)
              //     and no group scope, return to pick-category.
              //   - Otherwise return to pick-product unscoped.
              const nonEmptyGroups = (productGroups ?? []).filter(
                (g) => g.product_count > 0,
              )
              if (pickedGroupSlug) {
                // Back to scoped list (group scope preserved via pickedGroupSlug state).
                setStep({ name: 'pick-product' })
              } else if (nonEmptyGroups.length > 1 && productGroups) {
                // Categories were shown but no group was picked (e.g. ?product= deep link
                // that bypasses categories). Return to pick-category.
                setStep({ name: 'pick-category', groups: productGroups })
              } else {
                setStep({ name: 'pick-product' })
              }
            }}
          />
        ) : null}

        {/*
          landr-7jgo: standalone "Fully booked" state for a single-product
          deep link (?product=<slug>) that resolved to a sold-out product.
          No date picker, no Select CTA — there is nothing to book. Back
          returns to the (filtered) catalogue overview.
        */}
        {step.name === 'fully-booked' ? (
          <FullyBookedNotice
            name={pickLocalized(
              step.product.name,
              step.product.name_localized,
              browserLocale(),
            )}
            description={pickLocalized(
              step.product.short_description,
              step.product.short_description_localized,
              browserLocale(),
            ) || null}
            onBack={goToProductStep}
          />
        ) : null}

        {/*
          Step machine branching (landr-y9k). First branch is product_kind:
          non-service kinds (digital_good, physical_good, gift_card) render
          the ShopComingSoonStub since the booking widget doesn't take
          checkout for shop kinds yet. For services, branch on
          service_time_shape to pick the right picker; MultiDayPicker also
          consumes product.is_contiguous to switch between any-day-toggle
          and consecutive-only modes.
        */}
        {step.name === 'pick-selection' &&
        step.product.product_kind !== 'service' ? (
          <ShopComingSoonStub product={step.product} onBack={goToProductStep} />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'time_slot' ? (
          <AvailabilityPicker
            product={step.product}
            exposeSeatsToCustomer={operatorSettings.expose_seats_to_customer}
            onBack={goToProductStep}
            onConfirm={(slot) =>
              afterSelection(step.product, { kind: 'slot', slot })
            }
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'fixed_window' ? (
          <FixedDateWindowPicker
            product={step.product}
            exposeSeats={operatorSettings.expose_seats_to_customer}
            onBack={goToProductStep}
            onConfirm={(_slot, window, forced) => {
              const days = expandWindowDays(window)
              afterSelection(step.product, {
                kind: 'days',
                selectedDays: days,
                // landr-aoak.2: a force-booked full window marks ALL its days
                // as forced so the submit adapter raises ignore_capacity.
                ...(forced ? { forcedDays: days } : {}),
              })
            }}
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'days_range' ? (
          <MultiDayStep
            product={step.product}
            onBack={goToProductStep}
            onConfirm={(selectedDays, forcedDays) =>
              afterSelection(step.product, {
                kind: 'days',
                selectedDays,
                // landr-aoak.2: carry the force-booked subset (staff mode only).
                ...(forcedDays && forcedDays.length > 0 ? { forcedDays } : {}),
              })
            }
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'single_date' ? (
          <SingleDatePicker
            product={step.product}
            onBack={goToProductStep}
            onConfirm={(selectedDays, forcedDays) =>
              afterSelection(step.product, {
                kind: 'days',
                selectedDays,
                // landr-aoak.2: carry the force-booked day (staff mode only).
                ...(forcedDays && forcedDays.length > 0 ? { forcedDays } : {}),
              })
            }
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'details' ? (
          <DetailsStep
            product={step.product}
            selection={step.selection}
            serviceRoles={serviceRoles}
            initialBooker={step.booker}
            initialParticipants={step.participants}
            // landr-87n9.3: restore the non-guiding companions on Back.
            initialCompanions={step.companions}
            onBack={() =>
              setStep({ name: 'pick-selection', product: step.product })
            }
            onConfirm={(booker, participants, companions) =>
              afterDetails(
                step.product,
                step.selection,
                booker,
                participants,
                companions,
              )
            }
            // landr-gb2f.1: live participant count + names for the sidebar.
            // Fires on every add/remove/name-change so the price breakdown
            // updates without waiting for Continue.
            // landr-87n9.3: the callback now also reports a live companion
            // count, but companions never feed the guiding price
            // (participants_count) and aren't needed for any live sidebar
            // state on this step (the committed companions land in step state
            // on Continue), so we intentionally ignore the third arg here.
            onLiveParticipantsChange={(count, names) => {
              setLiveParticipantCount(count)
              setLiveParticipantNames(names)
            }}
          />
        ) : null}

        {step.name === 'pick-accommodation' ? (
          <AccommodationStep
            product={step.product}
            selectedDays={selectionToDays(step.selection)}
            operatorToken={token!}
            participantCount={step.participants.length}
            // landr-gb2f.2: participant first names drive the draggable
            // assignment chips. We pass first names (trimmed) per index.
            participantNames={step.participants.map((p) => p.first_name)}
            // landr-87n9.3: non-guiding companions join the whole-party
            // room assignment (appended after participants, badged "guest").
            companionNames={step.companions.map((c) => c.first_name)}
            // landr-yf0n: thread prior accommodation context back so the
            // step re-mounts with hotel + rooms + add-ons restored
            // instead of empty steppers. Each field is independently
            // optional — only what was previously confirmed comes back.
            // landr-ffyg.2: also restore the chosen accommodation mode.
            initialHotelLocationId={step.hotelLocationId}
            initialRooms={step.accommodationRooms}
            initialAddons={step.addons}
            // landr-gb2f.5: restore the exact per-room add-on map on back-nav
            // so the breakfast split survives Back→Forward correctly.
            initialPerRoomAddons={step.perRoomAddons}
            initialIncludeHotel={step.includeHotel}
            initialMode={step.accommodationMode}
            // landr-gb2f.2: restore the participant → room assignment.
            initialAssignment={step.roomAssignment}
            // landr-doam.1: restore the per-occupant age map on back-nav.
            initialAgeMap={step.occupantAgeMap}
            // landr-87n9.2: live-lift the room + add-on selection so the
            // sidebar's at-hotel total updates as the customer picks rooms.
            // Sets the `touched` sentinel so App prefers live values over the
            // step's restored values from this point on.
            onLiveAccommodationChange={(rooms, addons) => {
              setLiveAccommodationRooms(rooms)
              setLiveAddons(addons)
              setLiveAccommodationTouched(true)
            }}
            onBack={() => {
              // landr-87n9.2: leaving the step — clear the live-lift so a
              // later re-entry falls back to the restored step values.
              clearLiveAccommodation()
              // landr-b3g5: thread the already-collected booker +
              // participants back to DetailsStep so the form re-mounts
              // pre-filled instead of empty.
              setStep({
                name: 'details',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                // landr-87n9.3: carry companions back to DetailsStep.
                companions: step.companions,
              })
            }}
            onConfirm={(rooms, hotelLocationId, addons, includeHotel, isSharedDouble, roomAssignment, ageMap, perRoomAddons, roomProductNames) =>
              afterAccommodation(
                step.product,
                step.selection,
                step.booker,
                step.participants,
                // landr-87n9.3: companions roster threads to the submit step.
                step.companions,
                rooms,
                hotelLocationId,
                addons,
                // Carry forward whether the customer originally went
                // through ServiceAddonsStep (false here — this product
                // has a hotel offering, so the service-addons step
                // never ran).
                false,
                includeHotel,
                isSharedDouble,
                // landr-ffyg.2: derive the top-level mode from the confirm
                // payload so back-nav restores it. shared-double when the
                // flag is set; guiding-only when no hotel context; package
                // otherwise (hotel + rooms).
                deriveAccommodationMode(hotelLocationId, isSharedDouble),
                // landr-gb2f.2: thread the assignment to the submit step.
                roomAssignment,
                // landr-doam.1: thread the age map to the submit step.
                ageMap,
                // landr-gb2f.5: thread the per-room add-on map so the
                // review can show breakfast status per room unit.
                perRoomAddons,
                // landr-gb2f.5: thread room product names for review labels.
                roomProductNames,
              )
            }
          />
        ) : null}

        {step.name === 'pick-service-addons' ? (
          <ServiceAddonsStep
            product={step.product}
            // landr-yf0n: thread prior add-on selections back so the
            // step re-mounts with the customer's choices restored
            // instead of resetting to the min_qty seed.
            initialAddons={step.addons}
            onBack={() =>
              // landr-b3g5: carry booker + participants back so the
              // DetailsStep re-mount restores them.
              setStep({
                name: 'details',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                // landr-87n9.3: carry companions back to DetailsStep.
                companions: step.companions,
              })
            }
            onConfirm={(addons) =>
              afterAccommodation(
                step.product,
                step.selection,
                step.booker,
                step.participants,
                // landr-87n9.3: companions roster threads to the submit step.
                step.companions,
                [],
                null,
                addons,
                // landr-yf0n: hadServiceAddons=true — the customer
                // explicitly went through ServiceAddonsStep, so back-
                // nav from downstream steps must hop back through here.
                true,
              )
            }
          />
        ) : null}

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorToken={token!}
            productName={step.product.name}
            // landr-yf0n: thread the prior pickup choice back so the
            // radio re-mounts with it already selected on back-nav.
            initialLocationId={step.pickupLocationId}
            onBack={() => {
              const offering = step.product.hotel_offering ?? 'none'
              if (step.product.product_kind === 'service' && offering !== 'none') {
                // landr-yf0n: restore the prior accommodation state on
                // back-nav so the room steppers + add-ons aren't wiped.
                // landr-sbhz.4: also carry isSharedDouble back.
                setStep({
                  name: 'pick-accommodation',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                  hotelLocationId: step.hotelLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                  accommodationMode: step.accommodationMode,
                  roomAssignment: step.roomAssignment,
                  occupantAgeMap: step.occupantAgeMap,
                  perRoomAddons: step.perRoomAddons,
                  roomProductNames: step.roomProductNames,
                })
              } else if (step.hadServiceAddons) {
                // landr-yf0n: the customer originally went through
                // ServiceAddonsStep — back-nav must hop back through
                // it instead of jumping straight to DetailsStep.
                setStep({
                  name: 'pick-service-addons',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                  addons: step.addons,
                })
              } else {
                // landr-b3g5: preserve booker + participants when
                // back-stepping into DetailsStep.
                setStep({
                  name: 'details',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                })
              }
            }}
            onConfirm={(locationId) => {
              // landr-sbhz.3: route to declarations step before fill-form
              // when the operator requires pre-booking declarations.
              const fillFormArgs = {
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                // landr-87n9.3: companions roster threads to the submit step.
                companions: step.companions,
                pickupLocationId: locationId,
                accommodationRooms: step.accommodationRooms,
                addons: step.addons,
                // landr-yf0n: carry provenance flags through so the
                // fill-form back path can hop back through the right
                // upstream intermediate steps with their state.
                // landr-sbhz.4: also carry isSharedDouble.
                hotelLocationId: step.hotelLocationId,
                hadServiceAddons: step.hadServiceAddons,
                includeHotel: step.includeHotel,
                isSharedDouble: step.isSharedDouble,
                accommodationMode: step.accommodationMode,
                roomAssignment: step.roomAssignment,
                occupantAgeMap: step.occupantAgeMap,
                perRoomAddons: step.perRoomAddons,
                roomProductNames: step.roomProductNames,
              }
              setStep(
                fillFormOrDeclarations(
                  fillFormArgs,
                  // landr-il9f.2: keyed on the server-resolved slug.
                  OPERATORS_REQUIRING_DECLARATIONS.has(operatorSettings.slug),
                ),
              )
            }}
          />
        ) : null}

        {/* landr-sbhz.3: declarations step — eligibility confirmations
            + language selector, shown before the review screen for
            operators in OPERATORS_REQUIRING_DECLARATIONS. */}
        {step.name === 'declarations' ? (
          <DeclarationsStep
            productName={step.product.name}
            declarationItems={PARA42_DECLARATION_ITEMS}
            languageOptions={PARA42_LANGUAGE_OPTIONS}
            initialDeclarations={step.initialDeclarations}
            onBack={() =>
              // landr-87n9.1: mirror the forward step machine. When a hotel
              // was booked the pickup step was SKIPPED forward, so Back must
              // return to pick-accommodation (NOT the free-pickup picker the
              // customer never saw). stepBeforeReview encodes the full
              // hotel-first routing and reconstructs the upstream step with
              // its previously confirmed state restored.
              setStep(
                stepBeforeReview({
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                  pickupLocationId: step.pickupLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                  accommodationMode: step.accommodationMode,
                  roomAssignment: step.roomAssignment,
                  occupantAgeMap: step.occupantAgeMap,
                  perRoomAddons: step.perRoomAddons,
                  roomProductNames: step.roomProductNames,
                }),
              )
            }
            onConfirm={(customerDeclarations: CustomerDeclarations) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                companions: step.companions,
                pickupLocationId: step.pickupLocationId,
                accommodationRooms: step.accommodationRooms,
                addons: step.addons,
                hotelLocationId: step.hotelLocationId,
                hadServiceAddons: step.hadServiceAddons,
                includeHotel: step.includeHotel,
                isSharedDouble: step.isSharedDouble,
                accommodationMode: step.accommodationMode,
                roomAssignment: step.roomAssignment,
                occupantAgeMap: step.occupantAgeMap,
                perRoomAddons: step.perRoomAddons,
                roomProductNames: step.roomProductNames,
                customerDeclarations: customerDeclarations.declarations,
                // landr-87n9.4: multi-select languages + free-text other.
                customerLanguages: customerDeclarations.languages,
                customerOtherLanguages: customerDeclarations.otherLanguages || null,
              })
            }
          />
        ) : null}

        {step.name === 'fill-form' ? (
          <BookingForm
            widgetToken={token!}
            previewToken={previewToken ?? undefined}
            product={step.product}
            selection={step.selection}
            booker={step.booker}
            participants={step.participants}
            // landr-87n9.3: non-guiding companions for the submit body's
            // top-level companions[] + whole-party room assignment.
            companions={step.companions}
            pickupLocationId={step.pickupLocationId}
            accommodationRooms={step.accommodationRooms}
            addons={step.addons}
            customerDeclarations={step.customerDeclarations}
            customerLanguages={step.customerLanguages}
            customerOtherLanguages={step.customerOtherLanguages}
            // landr-ffyg.2: thread the shared-double marker into the submit
            // body. true → is_shared_double=true + no hotel_room lines +
            // hotel pickup; false/undefined → regular booking.
            isSharedDouble={step.isSharedDouble}
            // landr-gb2f.2: thread the participant → room assignment so
            // BookingForm attaches room_product_id + room_unit_index per
            // participant on submit.
            roomAssignment={step.roomAssignment}
            // landr-doam.1: thread the age map so BookingForm attaches
            // occupant_age_band + occupant_age per occupant on submit.
            occupantAgeMap={step.occupantAgeMap}
            // landr-gb2f.5: thread the per-room add-on map so BookingForm
            // can show breakfast status per room unit in the review.
            perRoomAddons={step.perRoomAddons}
            // landr-gb2f.5: thread room product names for the review labels.
            roomProductNames={step.roomProductNames}
            onBack={() => {
              // landr-sbhz.3: if declarations were collected, back
              // from fill-form goes to the declarations step (not all
              // the way back to pickup/accommodation) so the customer
              // can review/change declarations without losing context.
              if (OPERATORS_REQUIRING_DECLARATIONS.has(operatorSettings.slug)) {
                setStep({
                  name: 'declarations',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                  pickupLocationId: step.pickupLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  // landr-sbhz.4: keep the shared-double tick through the
                  // fill-form → declarations back hop.
                  isSharedDouble: step.isSharedDouble,
                  accommodationMode: step.accommodationMode,
                  roomAssignment: step.roomAssignment,
                  occupantAgeMap: step.occupantAgeMap,
                  perRoomAddons: step.perRoomAddons,
                  roomProductNames: step.roomProductNames,
                  // landr-87n9.4: restore languages[] + otherLanguages on back-nav.
                  initialDeclarations: step.customerDeclarations
                    ? {
                        declarations: step.customerDeclarations,
                        languages: step.customerLanguages ?? [],
                        otherLanguages: step.customerOtherLanguages ?? '',
                      }
                    : undefined,
                })
                return
              }
              // landr-87n9.1: non-declaration operators — mirror the forward
              // step machine via stepBeforeReview. When a hotel was booked the
              // pickup step was SKIPPED forward, so Back returns to
              // pick-accommodation rather than the free-pickup picker the
              // customer never saw (the same latent bug fixed for the
              // declarations path). All prior provenance + state is threaded
              // through so the upstream step re-mounts restored.
              setStep(
                stepBeforeReview({
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  companions: step.companions,
                  pickupLocationId: step.pickupLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                  accommodationMode: step.accommodationMode,
                  roomAssignment: step.roomAssignment,
                  occupantAgeMap: step.occupantAgeMap,
                  perRoomAddons: step.perRoomAddons,
                  roomProductNames: step.roomProductNames,
                }),
              )
            }}
            onConfirmed={(response, email) =>
              setStep({ name: 'confirmed', response, email })
            }
          />
        ) : null}

        {step.name === 'confirmed' ? (
          <>
            <Confirmation response={step.response} onRestart={goToProductStep} />
            {/* landr-atwy: the account-link prompt creates a real LANDR
                account, so it only shows when the operator opts in. */}
            {operatorSettings.offer_account_link ? (
              <AccountLinkPrompt operatorToken={token!} email={step.email} />
            ) : null}
          </>
        ) : null}
        </StepTransition>
        </div>
        {sidebarInputs ? (
          <PriceSidebar
            operatorToken={token!}
            product={sidebarInputs.product}
            selectedDays={
              step.name === 'pick-selection'
                ? liveSelectionDays
                : sidebarInputs.selectedDays
            }
            // landr-gb2f.1: on the details step use live count/names so the
            // sidebar price breakdown updates as the customer adds/removes
            // participants, mirroring the liveSelectionDays pattern for dates.
            // When liveParticipantCount is 0 (no changes yet), fall back to
            // the committed step-state value (covers back-nav re-entry where
            // prior data is already in step.participants).
            participantCount={
              step.name === 'details' && liveParticipantCount > 0
                ? liveParticipantCount
                : sidebarInputs.participantCount
            }
            participantNames={
              step.name === 'details' && liveParticipantCount > 0
                ? liveParticipantNames
                : sidebarInputs.participantNames
            }
            // landr-87n9.2: on the accommodation step prefer the live-lifted
            // room + add-on selection so the "At-hotel total" pill updates as
            // the customer picks rooms (the forward visit's step.accommodation
            // Rooms is empty — only set on back-nav). Falls back to the step's
            // restored values until the customer makes a live change (covers
            // back-nav re-entry where prior rooms live in step.accommodationRooms).
            accommodationRooms={
              step.name === 'pick-accommodation' && liveAccommodationTouched
                ? liveAccommodationRooms
                : sidebarInputs.accommodationRooms
            }
            addons={
              step.name === 'pick-accommodation' && liveAccommodationTouched
                ? liveAddons
                : sidebarInputs.addons
            }
            debounceMs={step.name === 'pick-selection' ? 1500 : undefined}
          />
        ) : null}
      </div>
      {/*
        landr-nils — operator footer copy below the booking widget. No
        headline (by design): a single optional block for legal lines,
        contact info, etc. Full-width, centred to match the content
        column. Plain text with line breaks preserved (never HTML).
      */}
      {operatorSettings.widget_footer ? (
        <footer
          className="border-border mx-auto max-w-5xl border-t px-6 pb-8 pt-4"
          data-testid="widget-footer"
        >
          <p className="text-muted-foreground text-xs whitespace-pre-line">
            {operatorSettings.widget_footer}
          </p>
        </footer>
      ) : null}
    </div>
  )
}

export default App

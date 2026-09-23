import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  AccommodationStep,
  type AccommodationMode,
} from '@/components/booking/AccommodationStep'
import { disambiguatePartyLabels } from '@/components/booking/accommodationCalc'
import { isBookable } from '@/components/booking/bookability'
import type {
  BreakfastMap,
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
import { OfferPage } from '@/components/booking/OfferPage'
import { ApprovalReplyPage } from '@/components/booking/ApprovalReplyPage'
import { Confirmation } from '@/components/booking/Confirmation'
import { DetailsStep } from '@/components/booking/DetailsStep'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
// landr-uwvl: the draft/step carry the three party maps keyed by a STABLE
// PartyMemberId; AccommodationStep + BookingForm consume them positionally.
// App.tsx is the ONLY place the two coordinate systems meet — see the module
// doc in partyIdentity.ts for why the line is drawn here.
import {
  buildPartyRoster,
  toIdentityKeyed,
  toIndexKeyed,
  toIndexKeyedOrUndefined,
} from '@/components/booking/partyIdentity'
import { LanguageStep } from '@/components/booking/LanguageStep'
import {
  findOtherLanguagesField,
  otherLanguagesFromDraft,
  withOtherLanguages,
} from '@/components/booking/otherLanguages'
import {
  normaliseOfferedLanguages,
  productAcceptsAnyLanguage,
} from '@/components/booking/participantLanguages'
import { FixedDateWindowPicker } from '@/components/booking/FixedDateWindowPicker'
import { expandWindowDays } from '@/components/booking/expandWindowDays'
import { MembershipCheckoutStep } from '@/components/booking/MembershipCheckoutStep'
import { MembershipReturnPage } from '@/components/booking/MembershipReturnPage'
import { MultiDayStep } from '@/components/booking/MultiDayStep'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import PriceSidebar from '@/components/booking/PriceSidebar'
import { ProductList } from '@/components/booking/ProductList'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { ShopComingSoonStub } from '@/components/booking/ShopComingSoonStub'
import { SingleDatePicker } from '@/components/booking/SingleDatePicker'
import {
  getContactPagePrefill,
  getInvitePrefill,
  getOperatorServiceRoles,
  getOperatorSettings,
  getProductAddons,
  getProductFlow,
  HttpError,
  listProductGroups,
  listProducts,
} from '@/api/client'
import { CustomFormStep } from '@/components/booking/CustomFormStep'
import type { FormResponseEntry, ProductFlowResponse } from '@/api/flowTypes'
import type {
  InvitePrefill,
  OperatorSettings,
  Product,
  ProductGroup,
  ServiceRole,
} from '@/api/types'
import {
  type Step,
  type PerRoomAddons,
  type BookingDraft,
  buildBreadcrumb,
  productEntryStep,
  deriveAccommodationMode,
  detailsFromDraft,
  draftFromStep,
  enterReviewOrCustomForm,
  mergeCapturedDraft,
  mergeDraftPatch,
  sidebarInputsForStep,
  stepAfterAccommodation,
  stepAfterCustomForm,
  stepAfterLanguages,
  stepBeforeLanguages,
  stepBeforeReview,
} from './appStepMachine'
import type { RemoteFlow } from './flowPlan'
import { BreadcrumbNavContext } from '@/components/booking/breadcrumbNav'
import {
  clearStoredProgress,
  readStoredProgress,
  writeStoredProgress,
} from './bookingPersistence'
import { detectRoute, invitePathToken, startsAtDates } from './detectRoute'
import { LandingPage } from '@/components/booking/LandingPage'
import { TierBadge } from '@/components/TierBadge'
import {
  browserLocale,
  configureCustomerLocale,
  overrideBookingLocale,
  pickLocalized,
} from '@/lib/locale'
import { CategoryStep } from '@/components/booking/CategoryStep'
import { ExpandedCatalog } from '@/components/booking/ExpandedCatalog'
import { ProductDetailStep } from '@/components/booking/ProductDetailStep'
import { VariantProvider } from '@/lib/variant.tsx'
import { variantFromLocation, hasVariantInLocation, useVariant } from '@/lib/variant'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { isBookingInProgress, useStaffDirtySignal } from '@/lib/staffDirty'
import { loadTileFont } from '@/lib/tileFont'
import type { TileFontKey } from '@/lib/tileFont'
import { widgetThemeStyle } from '@/lib/widgetTheme'
import { StepTransition } from '@/components/booking/StepTransition'

// landr-71kz.10: the hardcoded Para42 declarations constants
// (OPERATORS_REQUIRING_DECLARATIONS / PARA42_DECLARATION_ITEMS /
// PARA42_LANGUAGE_OPTIONS) have been retired. Declarations are now an
// operator-configured `custom_form` module fetched via the product flow RPC
// (public_get_product_flow) and rendered by CustomFormStep. The widget no
// longer hardcodes any operator's declaration set — the data path is the single
// source of truth. (API legacy constants stay — landr-gfqt.)

function readQueryParams() {
  if (typeof window === 'undefined') {
    return {
      token: null as string | null,
      product: null as string | null,
      group: null as string | null,
      previewToken: null as string | null,
      showSoldOut: false,
      catalog: null as string | null,
      invite: null as string | null,
      contactPageToken: null as string | null,
      startAtDates: false,
    }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    // landr-il9f.2: opaque widget token — no slug fallback.
    token: params.get('w'),
    product: params.get('product'),
    group: params.get('group'),
    // landr-otml0.3: invite link — resolved via GET /api/public/invites/{token}.
    // landr-5lrov: the link the API now mints is `/i/<token>` (short, and the
    // token survives link-rewriting mail gateways); `?invite=` stays an
    // accepted alias. Neither form carries `?w=` — the operator comes back
    // with the prefill, see the resolution effect in BookingFlowApp.
    invite: params.get('invite') ?? invitePathToken(window.location.pathname),
    // landr-frqgv.3: `?c=<token>` from a customer's own contact page
    // (`my.landr.de/c/{token}`, "re-book" CTA) — resolved via GET
    // /api/public/contact-page/{token}/prefill. Unlike `invite`, this only
    // prefills the booker's own name/email/phone (no product jump, no
    // locale override — the widget stays English-only).
    contactPageToken: params.get('c'),
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
    // landr-4a5j: explicit first-step catalog layout override. 'expanded'
    // forces the all-products expanded catalog; 'categories' forces the
    // tile entrance. Any other/absent value falls through to
    // operatorSettings.widget_catalog_layout, then the 'categories'
    // default — resolved by resolvedCatalogMode below, mirroring the
    // ?variant= precedence exactly (URL always wins).
    catalog: params.get('catalog'),
    // landr-6eita.1: `?start=dates` (with `?product=` only) — the deep-linked
    // product opens on the date picker; the product-detail step is skipped and
    // no back link / crumb leads to it.
    startAtDates: startsAtDates(window.location.search),
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
      <VariantProvider value={variantFromLocation()}>
        {/* landr-aoak.2: staff session context (inactive ⇒ normal widget). */}
        <StaffModeProvider>
          {/* landr-7dya.20: fixed tier badge — visible in all iframe embeds */}
          <TierBadge />
          {/* landr-2mgl: overscroll-y-contain stops a stray swipe at the top
              of this scroll container from triggering the browser's
              pull-to-refresh, which would reload the iframe. */}
          <div className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <CancelPage token={route.token} />
            </div>
          </div>
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  // landr-uvfg.4b: custom-offer accept-and-pay page
  if (route.kind === 'offer') {
    return (
      <VariantProvider value={variantFromLocation()}>
        <StaffModeProvider>
          <TierBadge />
          <div className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <OfferPage token={route.token} />
            </div>
          </div>
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  // landr-esd3: booking_payment_link "pay outstanding balance" page. Same
  // OfferPage component as the /offer branch above, in mode="pay".
  if (route.kind === 'pay') {
    return (
      <VariantProvider value={variantFromLocation()}>
        <StaffModeProvider>
          <TierBadge />
          <div className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <OfferPage token={route.token} mode="pay" />
            </div>
          </div>
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  // landr-em0r.9: hotel room-request reply page. Same unauthenticated,
  // pre-BookingFlowApp shell as cancel/offer above — App never fetches
  // operator/product data for this route, and the branded header comes
  // from the token's own GET response instead.
  if (route.kind === 'reply') {
    return (
      <VariantProvider value={variantFromLocation()}>
        <StaffModeProvider>
          <TierBadge />
          <div className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <ApprovalReplyPage token={route.token} intent={route.intent} />
            </div>
          </div>
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  // landr-1kk.5: Stripe redirected back from the membership checkout
  // ("become a member") flow. This is a QUERY param, not a path (the
  // customer never left the widget's base URL), so it can't be part of
  // `detectRoute` — it coexists with `?w=`/`?product=`. Checked here,
  // before BookingFlowApp mounts, so we never re-fetch operator/product
  // data just to show a redirect confirmation. Mirrors OfferPage's
  // `?paid=1` / `?paid=cancelled` pair exactly, just query-flagged
  // `member=` instead of `paid=` since this isn't a token-addressed page.
  const memberParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('member')
      : null
  if (memberParam === '1' || memberParam === 'cancelled') {
    return (
      <VariantProvider value={variantFromLocation()}>
        <StaffModeProvider>
          <TierBadge />
          <div className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground">
            <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
              <MembershipReturnPage
                status={memberParam === '1' ? 'success' : 'cancelled'}
              />
            </div>
          </div>
        </StaffModeProvider>
      </VariantProvider>
    )
  }
  return (
    <VariantProvider value={variantFromLocation()}>
      {/* landr-aoak.2: staff session context (inactive ⇒ normal widget). */}
      <StaffModeProvider>
        {/* landr-7dya.20: fixed tier badge — visible in all iframe embeds */}
        <TierBadge />
        <BookingFlowApp />
      </StaffModeProvider>
    </VariantProvider>
  )
}

function BookingFlowApp() {
  const {
    token: queryToken,
    product,
    group,
    previewToken,
    showSoldOut,
    catalog,
    invite,
    contactPageToken,
    startAtDates,
  } = useMemo(() => readQueryParams(), [])
  // landr-5lrov: an invite link (`/i/<token>`) carries NO `?w=` — the widget
  // token comes back with the invite prefill and is adopted here, so every
  // `token`-gated fetch below (settings, products, submit) works exactly as it
  // does for an embed. Null until that resolves; irrelevant for every other
  // entry point, where `?w=` is present from the first render.
  const [bootstrapToken, setBootstrapToken] = useState<string | null>(null)
  const token = queryToken ?? bootstrapToken
  // landr-zeg4u.1: ensureProductFlow (below) is a useCallback([]) — the ref
  // lets it read the CURRENT token on every call instead of the null it
  // closed over at first render for an invite link (`/i/<token>`, no `?w=`),
  // where `token` starts null and only becomes real once the invite prefill
  // resolves and calls setBootstrapToken. Without this, ensureProductFlow
  // fetched with token=null forever (see the guard in ensureProductFlow
  // itself, which also refuses to cache a null-token fetch).
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])
  // landr-il9f.2: no token → landing page immediately (no fetch needed).
  // Unknown token → landing page after the settings fetch returns 404.
  // 'unknown' means "no token supplied"; null means "fetch pending";
  // false means "fetch returned 404".
  // landr-5lrov: an invite is the one case where "no token yet" is NOT the
  // landing page — it is the "Resolving your invite…" state, which the render
  // gate further down owns. Showing the landing page here would be the very
  // bug this ticket fixes.
  const [showLanding, setShowLanding] = useState<boolean>(!token && !invite)
  // landr-2mgl: restore funnel progress persisted to sessionStorage on the
  // previous render (survives an accidental mobile pull-to-refresh OR an
  // intentional reload, which both remount this component from scratch).
  // Read ONCE at mount — readStoredProgress returns null when nothing is
  // stored, the step isn't restorable, or storage is blocked (sandboxed
  // iframe), so a fresh customer / a Safari-private embed simply starts at
  // pick-product with an empty draft. Skipped entirely when there's no
  // token (the landing page renders) or a deep link is present (?product= /
  // ?group= / ?invite= drive their own entry, which must win over a stale
  // restore). `?c=` (contactPageToken) is deliberately NOT in this list —
  // unlike invite/product/group it doesn't drive its own entry (no step
  // jump), so a `?c=` link opened mid-funnel (e.g. a mobile pull-to-
  // refresh) should still resume exactly where the customer left off. The
  // prefill effect below is the one that has to defer to a restore, not
  // this memo — see its comment.
  const restoredProgress = useMemo(
    () => (token && !product && !group && !invite ? readStoredProgress() : null),
    [token, product, group, invite],
  )
  const [step, setStep] = useState<Step>(
    () => restoredProgress?.step ?? { name: 'pick-product' },
  )
  // Live selection from the date pickers before the user presses Continue
  // (landr-w7pi). Cleared whenever we leave pick-selection so the next
  // visit to that step starts fresh.
  const [liveSelectionDays, setLiveSelectionDays] = useState<string[]>([])
  // landr-g98ug: tell the dashboard's Add-booking overlay (staff embed only)
  // whether closing it would throw away a booking in progress.
  useStaffDirtySignal(isBookingInProgress(step, liveSelectionDays.length))
  // landr-gb2f.1: live participant count + names from DetailsStep before
  // Continue is pressed. Mirrors the liveSelectionDays pattern. Cleared
  // when leaving the details step so back-nav starts fresh.
  const [liveParticipantCount, setLiveParticipantCount] = useState<number>(0)
  const [liveParticipantNames, setLiveParticipantNames] = useState<string[]>([])
  // landr-fn4i / landr-5krc: the optional member-perk code, lifted live from
  // DetailsStep (mirrors liveParticipant* above) straight to BookingForm's
  // submit — deliberately NOT part of the Step union / BookingDraft (unlike
  // booker/participants/companions): it only ever matters at the final
  // submit, its 5-minute server-side TTL makes round-tripping it through
  // every intermediate step + sessionStorage pointless, and DetailsStep
  // re-seeds its own field from this same state via initialMemberPerkOtp so
  // a Back-then-forward loop still shows (and re-sends) whatever was typed.
  const [memberPerkOtp, setMemberPerkOtp] = useState<string>('')
  // landr-otml0.3: resolved `?invite=<token>` prefill. `undefined` = no
  // token supplied / not yet resolved; `null` = resolved and failed (404) —
  // the plain wizard runs; an object = the strict prefill (see
  // InvitePrefill's doc — no booking ids). Read by the pick-selection /
  // pick-accommodation renders below to show the diff picker + banner, and
  // by the submit path to send invite_token.
  const [inviteData, setInviteData] = useState<InvitePrefill | null | undefined>(
    invite ? undefined : null,
  )
  // landr-otml0.3: dismissible notice for the 404 case ("this invite link
  // isn't valid any more…"). Not a real toast component (none exists in
  // this widget yet) — a dismissible banner in the same style as the
  // existing preview-mode banner.
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  // landr-otml0.3: the shared-double reference the customer confirmed via
  // AccommodationStep's masked-lookup field, lifted live (mirrors
  // memberPerkOtp above — it only matters at the final submit).
  const [joinRef, setJoinRef] = useState<string | null>(null)
  // landr-otml0.3 review fix (MINOR 6): one-shot "which companion row to
  // highlight" set after BookingForm's submit was rejected with the API's
  // companion_contact_required 422. Cleared by DetailsStep itself once
  // applied (onCompanionContactFocusApplied below) so it never lingers to
  // affect an unrelated later remount.
  const [focusCompanionContactIndex, setFocusCompanionContactIndex] = useState<
    number | undefined
  >(undefined)
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
  // landr-nmed: the persistent booking-draft. Every step's onConfirm merges
  // its slice in (mergeDraft); it is NEVER cleared by breadcrumb navigation
  // (only on a full restart via goToProductStep). When the customer jumps
  // BACK to an early step (Dates / the product crumb) via the breadcrumb and
  // continues forward, the forward handlers re-seed the downstream steps from
  // this draft so already-entered booker / participants / companions /
  // accommodation / declarations are preserved instead of wiped. Generalises
  // the landr-b3g5 adjacent-Back restore to arbitrary breadcrumb jumps.
  // landr-2mgl: seed the persistent draft from the restored snapshot so a
  // reload mid-funnel keeps every already-entered slice (booker /
  // participants / companions / accommodation / declarations) — same data
  // the step itself carries, kept in sync.
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(
    () => restoredProgress?.bookingDraft ?? {},
  )
  const mergeDraft = useCallback((patch: BookingDraft) => {
    setBookingDraft((prev) => mergeDraftPatch(prev, patch))
  }, [])
  // landr-otml0.3: resolve `?invite=<token>` once, at mount. On success:
  // seed the persistent draft (booker name, hotel + shared-double mode —
  // the SAME slices `afterDetails` already reads to build pick-accommodation,
  // so no separate plumbing is needed there) and jump straight to
  // pick-selection with the matching product, skipping category/product/
  // product-detail entirely. On 404 (or the product not being found/
  // bookable — an edge case the ticket doesn't cover, treated the same way):
  // fall back to the plain wizard and show a dismissible notice.
  //
  // landr-5lrov: this no longer requires `?w=` to be in the URL. The invite
  // link is `/i/<token>` and nothing else, so the prefill response carries the
  // operator's public `widget_token` and we adopt it here before any
  // operator-scoped fetch. When the widget IS embedded (`?w=` present) that
  // value wins — an operator embedding the widget on their own page and
  // pasting an invite link into it should stay on their own operator.
  useEffect(() => {
    if (!invite) return
    let cancelled = false
    // The operator token in force once the prefill has answered: `?w=` when
    // embedded, otherwise whatever the prefill handed us.
    let usableToken: string | null = queryToken
    const failInvite = () => {
      setInviteData(null)
      overrideBookingLocale(null)
      // With no `?w=` and no usable token from the prefill there is no
      // operator to render a wizard FOR — the landing page is the only honest
      // fallback. With a token in hand the plain wizard still works, which is
      // what the notice invites the customer to do.
      if (!usableToken) setShowLanding(true)
      setInviteNotice(
        "This invite link isn't valid any more — you can still book and enter the reference later.",
      )
    }
    void (async () => {
      try {
        const prefill = await getInvitePrefill(invite)
        if (cancelled) return
        // The operator this invite belongs to. `?w=` wins when embedded.
        const widgetToken = queryToken ?? prefill.widget_token ?? ''
        if (!widgetToken) {
          failInvite()
          return
        }
        usableToken = widgetToken
        if (!queryToken) setBootstrapToken(widgetToken)
        // landr-otml0.3 review fix (MINOR 5): product_id is nullable on the
        // wire (the host's product can be deleted/deactivated between mint
        // and open) — with no product to jump to, degrade straight to the
        // plain wizard instead of spending a listProducts round-trip on a
        // lookup that can never match.
        if (!prefill.product_id) {
          failInvite()
          return
        }
        setInviteData(prefill)
        // landr-otml0.3 review fix (MAJOR 2): prefill.language wins over both
        // the raw browser locale and the operator's whitelist — see
        // overrideBookingLocale's doc for why.
        overrideBookingLocale(prefill.language)
        mergeDraft({
          booker: {
            first_name: prefill.invitee_first_name,
            last_name: prefill.invitee_last_name,
            email: '',
            phone: '',
          },
          hotelLocationId: prefill.hotel_location_id,
          isSharedDouble: prefill.is_shared_double,
          accommodationMode: prefill.is_shared_double
            ? 'shared-double'
            : undefined,
        })
        const products = await listProducts(widgetToken)
        if (cancelled) return
        const match = products.find((p) => p.product_id === prefill.product_id)
        if (match && isBookable(match)) {
          setStep({ name: 'pick-selection', product: match })
        } else {
          // Product deleted/inactive/sold out since the invite was minted —
          // not specified by the ticket; degrade to the plain wizard rather
          // than dead-ending on a step nothing can render.
          failInvite()
        }
      } catch {
        if (cancelled) return
        failInvite()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, queryToken])
  // landr-frqgv.3: resolve `?c=<token>` once, at mount — a customer
  // re-booking from their own contact page (my.landr.de/c/{token}). Unlike
  // `invite` above, this ONLY prefills the booker's own name/email/phone;
  // there is no product/date to jump to and no locale override (the widget
  // stays English-only). Any failure (bad/expired token, network error,
  // 404) is ignored silently — the plain wizard still works exactly as if
  // `?c=` had never been supplied, which is why there's no notice state
  // here unlike the invite flow's `inviteNotice`.
  //
  // landr-frqgv.3 review fix: skip entirely when `restoredProgress` is
  // non-null. `contactPageToken` deliberately does NOT clear the restored-
  // progress memo above (see its comment — `?c=` doesn't drive its own
  // entry the way invite/product/group do, so a mid-funnel reopen should
  // resume). But this effect's mergeDraft() runs unconditionally at mount
  // regardless of that restore, so without this guard a customer who'd
  // already reached DetailsStep and edited their own name/email/phone —
  // then hit an accidental mobile pull-to-refresh with `?c=` still in the
  // URL — got those edits silently clobbered back to the (possibly stale)
  // contact-record values on remount. A restored session already carries
  // whatever booker data the customer entered (or none, if they haven't
  // reached DetailsStep yet) — either way it's the customer's own more
  // recent state, so it always wins over prefill here.
  useEffect(() => {
    if (!contactPageToken || restoredProgress) return
    let cancelled = false
    void (async () => {
      try {
        const prefill = await getContactPagePrefill(contactPageToken)
        if (cancelled) return
        mergeDraft({
          booker: {
            first_name: prefill.first_name ?? '',
            last_name: prefill.last_name ?? '',
            email: prefill.email ?? '',
            phone: prefill.phone ?? '',
          },
        })
      } catch {
        // Silently ignored by design — see comment above.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactPageToken])
  // landr-71kz.4: accumulated form_responses from CustomFormStep(s), keyed
  // by form_key. Each custom-form step merges its entry in on confirm.
  // Cleared on full restart (goToProductStep). Sent to BookingForm for the
  // submit payload.
  const [formResponses, setFormResponses] = useState<FormResponseEntry[]>([])
  // landr-zenj.1: mirrors PriceSidebar's live estimate un_priceable flag
  // (see PriceSidebar's onUnPriceableChange prop doc). BookingForm is a
  // sibling of PriceSidebar, not a child, so this is how it learns its
  // Confirm CTA must be blocked instead of submitting against a price the
  // API will 422 anyway.
  const [estimateUnPriceable, setEstimateUnPriceable] = useState(false)
  const mergeFormResponse = useCallback((entry: FormResponseEntry) => {
    setFormResponses((prev) => {
      const idx = prev.findIndex((e) => e.form_key === entry.form_key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = entry
        return next
      }
      return [...prev, entry]
    })
  }, [])
  // landr-71kz.10: the product's operator-configured remote flow
  // (public_get_product_flow). null = no flow fetched / no flow configured /
  // fetch failed → buildFlowPlan falls back to the legacy plan (NEVER throws —
  // bd memory landr-9ut4). Cached per product; re-fetched when a different
  // product is selected (and re-fetched on reload-restore, since this state is
  // not persisted — the restored `step` already carries any custom-form formKey).
  // Keyed by product_id so a stale flow from a previous product is never used.
  const [remoteFlow, setRemoteFlow] = useState<{
    productId: string
    flow: ProductFlowResponse | null
  } | null>(null)
  // The flow for the CURRENTLY-active product, or null when it doesn't match
  // (different product, not yet fetched, or fetch failed → legacy plan).
  const flowForProduct = useCallback(
    (productId: string | undefined): RemoteFlow | null => {
      if (!productId) return null
      if (!remoteFlow || remoteFlow.productId !== productId) return null
      return remoteFlow.flow
    },
    [remoteFlow],
  )
  // landr-db45: same lookup as flowForProduct but preserving the concrete
  // `ProductFlowResponse` shape (flowForProduct's declared `RemoteFlow`
  // return type is deliberately looser — all buildFlowPlan/breadcrumb
  // callers need) so CustomFormStep can be handed the already-fetched flow
  // as a prop instead of re-fetching public_get_product_flow itself. The
  // three-way return distinguishes "not yet resolved for this product"
  // (`undefined` — CustomFormStep falls back to its own fetch, matching the
  // pre-existing fetch-based behaviour) from "resolved, no flow" (`null` —
  // CustomFormStep shows the same "form not found" state it always could,
  // without a further fetch). In practice this step is only ever reached
  // after `withResolvedFlow` has already settled the fetch for this exact
  // product, so the common case always yields the resolved flow.
  const resolvedFlowForProduct = useCallback(
    (productId: string | undefined): ProductFlowResponse | null | undefined => {
      if (!productId) return undefined
      if (!remoteFlow || remoteFlow.productId !== productId) return undefined
      return remoteFlow.flow
    },
    [remoteFlow],
  )
  // landr-71kz.10 / landr-iyyf: fetch (and cache) a product's flow, RETURNING
  // the promise so callers can await settlement instead of only firing it off.
  // Deduped per product_id via flowFetchesRef so the boot-time effect below AND
  // the pre-review readiness gate (withResolvedFlow) never trigger two network
  // requests for the same product — both share the SAME in-flight promise.
  // Tolerant: getProductFlow already swallows network/404/malformed → null; we
  // additionally guard so a throw can NEVER escape and blank the widget.
  const flowFetchesRef = useRef<Map<string, Promise<ProductFlowResponse | null>>>(
    new Map(),
  )
  const ensureProductFlow = useCallback(
    (productId: string): Promise<ProductFlowResponse | null> => {
      const inFlight = flowFetchesRef.current.get(productId)
      if (inFlight) return inFlight
      // landr-zeg4u.1: an invite link (`/i/<token>`, no `?w=`) mounts with
      // `token` null — bootstrapToken only arrives once the invite prefill
      // resolves. Fetching with no token 404s (getProductFlow swallows it to
      // null), and caching THAT in flowFetchesRef would strand the product on
      // the legacy plan (no custom_form) forever, even once the real token
      // shows up. So: don't fetch, and — critically — don't cache, when there
      // is no token yet; the next caller (once token resolves) retries clean.
      const currentToken = tokenRef.current
      if (!currentToken) return Promise.resolve(null)
      const promise = (async () => {
        try {
          const flow = await getProductFlow(currentToken, productId)
          setRemoteFlow((prev) =>
            prev && prev.productId === productId && prev.flow === flow
              ? prev
              : { productId, flow },
          )
          return flow
        } catch {
          // Defensive: degrade to the legacy plan. The fetch must not block
          // the widget on error (no error boundary — landr-9ut4).
          setRemoteFlow({ productId, flow: null })
          return null
        }
      })()
      flowFetchesRef.current.set(productId, promise)
      return promise
    },
    // token is read via tokenRef (a ref access, not a dep) so this stays
    // reference-stable across renders — its identity is depended on
    // elsewhere (withResolvedFlow's own deps) and must not change every
    // token update. See tokenRef above for why a plain [token] dep isn't
    // used instead.
    [],
  )
  // landr-iyyf fix-forward (MEDIUM 1): flowFetchesRef caches SETTLED promises
  // forever — ensureProductFlow only calls setRemoteFlow inside the async body
  // that runs the FIRST time a product_id is requested. Clearing `remoteFlow`
  // alone (as goToProductStep used to) without also clearing this Map left a
  // stale resolved promise behind: a repeat booking of the SAME product after
  // a full restart hit the cached promise, which resolves the correct VALUE to
  // its own `.then()` callers but never re-fires setRemoteFlow — so the
  // `remoteFlow` state (and everything derived from it: flowForProduct,
  // activeFlow, the breadcrumb trail, buildFlowPlan) stayed null forever for
  // that session, silently degrading to the legacy flow even for a product
  // with a required custom form. Clear BOTH together wherever remoteFlow
  // resets, so the next ensureProductFlow call always re-fetches + re-populates.
  const clearProductFlowCache = useCallback(() => {
    setRemoteFlow(null)
    flowFetchesRef.current.clear()
  }, [])
  // landr-iyyf: which product's flow the pre-review transition is currently
  // WAITING on (null when nothing is pending). Drives the brief "Checking
  // your booking requirements…" status banner. This is the CLIENT half of
  // the fix for the ensureProductFlow race — the SERVER remains the
  // authoritative gate regardless (booking_submit.py rejects a submit that
  // omits form_responses when the product's flow has an unsatisfied required
  // custom_form), so this only closes the client-side UX gap where the race
  // would otherwise silently route past a required declaration.
  const [pendingFlowProductId, setPendingFlowProductId] = useState<
    string | null
  >(null)
  // landr-iyyf: resolve `productId`'s flow before computing the pre-review
  // step. When the flow is already cached for this exact product, `onReady`
  // fires synchronously (byte-identical to the pre-fix fast path — no
  // behaviour change for the overwhelmingly common case where the fetch
  // already settled well before Continue is clicked). Otherwise the fetch
  // hasn't settled yet (still in flight, or not even started) — surface the
  // loading banner and await it rather than treating "not cached yet" as "no
  // custom forms" (the race this ticket closes).
  const withResolvedFlow = useCallback(
    (
      productId: string,
      onReady: (flow: ProductFlowResponse | null) => void,
    ) => {
      if (remoteFlow && remoteFlow.productId === productId) {
        onReady(remoteFlow.flow)
        return
      }
      setPendingFlowProductId(productId)
      void ensureProductFlow(productId).then((flow) => {
        setPendingFlowProductId((prev) => (prev === productId ? null : prev))
        onReady(flow)
      })
    },
    [remoteFlow, ensureProductFlow],
  )
  // landr-d8rg.4: product groups fetched at boot for the category entrance.
  // null = fetch not yet attempted; [] = fetch done (empty or error fallback).
  // Populated by the useEffect below, which silently falls back to []
  // on 404/network error so the widget degrades to pick-product unscoped.
  const [productGroups, setProductGroups] = useState<ProductGroup[] | null>(null)
  // landr-d8rg.4: slug of the group the user picked from pick-category.
  // Passed as productGroup to ProductList so the list is scoped to that group.
  // Cleared when the user returns to pick-category (back-nav).
  const [pickedGroupSlug, setPickedGroupSlug] = useState<string | null>(null)

  // landr-2mgl: persist the funnel position + draft on every change so an
  // (accidental or intentional) reload restores it. writeStoredProgress is
  // fully guarded (no-op on blocked storage) and skips non-restorable steps
  // (entry steps + the post-booking confirmation), proactively clearing the
  // snapshot at those points so a reload there starts clean — this is what
  // covers both the "completed booking" and "full restart" clear-points
  // (goToProductStep sets step → pick-product, which triggers this effect's
  // clear). PII (names/emails) lives only in same-origin, tab-scoped
  // sessionStorage here — never in the URL.
  useEffect(() => {
    writeStoredProgress({ step, bookingDraft })
  }, [step, bookingDraft])

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
    // landr-otml0.2 D8: default true (matches the API column default) so
    // the logo doesn't flash-hide before the settings fetch resolves.
    widget_show_logo: true,
    primary_color: null,
    // landr-ens5 — 3-colour theme null until the fetch resolves (built-in
    // default theme until then).
    theme: null,
    name: null,
    // landr-nils — embed copy null until the fetch resolves.
    widget_headline: null,
    widget_description: null,
    widget_footer: null,
    // landr-rjda — first-page-only gates off by default (show on every step).
    widget_headline_first_page_only: false,
    widget_description_first_page_only: false,
    widget_footer_first_page_only: false,
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
    // landr-4a5j — first-step catalog layout null until the fetch resolves.
    // Null = platform default ('categories', current tile behaviour).
    widget_catalog_layout: null,
  })
  // Operator's active service_roles (landr-mg0a). Starts empty so the
  // DetailsStep dropdown stays hidden during the fetch — BookingForm
  // falls back to the legacy 'participant' code if the customer manages
  // to submit before the list arrives (extremely unlikely; the fetch
  // races multiple full-page paints' worth of UX).
  const [serviceRoles, setServiceRoles] = useState<ServiceRole[]>([])

  // landr-p68d2 (epic decision D1, narrowing landr-r6e5x.4 / D3): the guide
  // languages offered for a given PRODUCT — `product.guide_languages`, else
  // the platform default. Product-scoped (not derived from operatorSettings
  // at all) because two products from the same operator can offer different
  // sets (a one-language Denmark trip vs. a four-language guided day).
  //
  // landr-p68d2.1 confirmed the operator-level setting is now a dead
  // fallback, not just deprecated: `public_get_operator_settings` STRIPS
  // `offered_languages` from the response (D5) even though the RPC/Pydantic
  // model still carry the column until landr-p68d2.4 drops it — so
  // `operatorSettings.offered_languages` is always absent on a current API
  // and is deliberately NOT consulted here any more (it was a three-tier
  // fallback through PR #256; narrowed to two-tier once .1 merged).
  //
  // landr-p68d2.1 also confirmed the submit-side language rule ignores
  // add-on service lines (is_addon_only / product_addons children) — the
  // widget books exactly one main service product per booking (D4), so
  // keying this off `step.product` (never an add-on) already matches.
  //
  // The step runs whenever the resolved list is non-empty. landr-pv2r1
  // (epic decision E3): an EMPTY `guide_languages` array marks an
  // "any language" product (e.g. a tandem flight) — the resolved list is
  // then `[]`, so every `.length > 0` gate below skips the step and the API
  // (landr-pv2r1.1, tri-state resolver) treats participant languages as
  // optional for it. NULL / absent is NOT "any": normaliseOfferedLanguages
  // still falls back to the platform default there, because a widget can
  // run ahead of the API (rolling deploy) and an older API validates
  // `participants[].language` on every submit — skipping the step for such a
  // product would dead-end on a 422 with nothing the customer could do.
  const offeredLanguagesForProduct = useCallback(
    (product: Product) =>
      productAcceptsAnyLanguage(product.guide_languages)
        ? []
        : normaliseOfferedLanguages(product.guide_languages),
    [],
  )
  // landr-pv2r1 (E3): the per-member language map the downstream seams
  // (custom form, review/submit) may use for THIS product — always empty for
  // an any-language product, so an assignment left in the draft by an
  // earlier restricted product can never leak into the submit body
  // (participants[].language / derived customer_languages).
  const draftLanguagesForProduct = useCallback(
    (product: Product): BookingDraft['participantLanguages'] =>
      productAcceptsAnyLanguage(product.guide_languages)
        ? {}
        : bookingDraft.participantLanguages,
    [bookingDraft.participantLanguages],
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const settings = await getOperatorSettings(token)
        if (!cancelled) {
          setOperatorSettings(settings)
          setShowLanding(false)
          // landr-821d6.7: whitelist browserLocale() against this operator's
          // customer_languages (falling back to default_locale) — applies
          // globally to every browserLocale() call from here on, no prop
          // threading needed.
          configureCustomerLocale(settings.customer_languages, settings.default_locale)
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

  // landr-71kz.10: the product currently in focus (product-detail onward). The
  // flow is fetched the moment a product is selected — at the product-detail
  // step, alongside the existing per-product data — so it is cached BEFORE the
  // customer reaches the pre-review tail where the custom-form step is routed.
  // Deriving it from `step` (rather than a single onClick) also covers deep
  // links (?product=) and a reload-restore mid-funnel, where the active product
  // arrives via the restored step rather than a fresh click.
  const activeProductId =
    'product' in step ? step.product.product_id : undefined
  useEffect(() => {
    if (!token || !activeProductId) return
    // Already cached for this product → no refetch (idempotent).
    if (remoteFlow && remoteFlow.productId === activeProductId) return
    void ensureProductFlow(activeProductId)
    // ensureProductFlow is stable; remoteFlow is the cache guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeProductId])

  // landr-iyyf fix-forward (MEDIUM 2): mergeCapturedDraft's deep-merge keeps
  // `customFormAnswers` keyed only by form_key, with NO product context. That
  // is correct WITHIN one product's funnel (a breadcrumb jump never changes
  // the active product — buildBreadcrumb only reconstructs prior steps of the
  // SAME product), but `bookingDraft` is otherwise never reset except on a
  // full restart (goToProductStep). So a customer who jumps back to the
  // "product" breadcrumb crumb (product-detail, same product, draft intact),
  // then backs OUT via ProductDetailStep's onBack (no full restart) and picks
  // a DIFFERENT product B, would carry product A's custom-form answers
  // forward as silent pre-fill for product B's own custom-form step — and if
  // B happens to render a form with the same key (e.g. an operator-wide
  // shared declarations form), those stale answers could be submitted for B
  // without the customer ever re-entering them.
  //
  // Clear ONLY `customFormAnswers` (booker/participants are still legitimately
  // reusable across products for the same customer) the moment the active
  // product genuinely CHANGES to a DIFFERENT one. `lastProductIdRef` tracks
  // the last DEFINED product id (not the raw, possibly-`undefined`
  // `activeProductId`) so the comparison survives the intermediate
  // `undefined` while browsing pick-product/pick-category between products —
  // without that, backing out to the catalog would reset the tracked id to
  // `undefined` and the very next product pick would look like an "initial
  // pick" (prev undefined) rather than a genuine switch, silently skipping
  // the clear this fix exists for.
  const lastProductIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const lastProductId = lastProductIdRef.current
    if (activeProductId && lastProductId && lastProductId !== activeProductId) {
      setBookingDraft((prev) =>
        prev.customFormAnswers
          ? { ...prev, customFormAnswers: undefined }
          : prev,
      )
    }
    if (activeProductId) {
      lastProductIdRef.current = activeProductId
    }
  }, [activeProductId])

  // landr-jb1k.2: apply operator's widget_variant once settings resolve.
  // Resolution precedence (highest to lowest):
  //   1. Explicit ?variant= URL param, read once at boot (deep link / the
  //      dashboard's "Preview widget" link, which echoes the saved variant).
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

  // landr-4a5j: resolve the first-step catalog layout. Precedence mirrors
  // ?variant= exactly (highest to lowest):
  //   1. Explicit ?catalog= URL param (read once at boot — there is no live
  //      switcher for this one, unlike variant, so the memoized queryParams
  //      value is always current; no need to re-read window.location).
  //   2. operatorSettings.widget_catalog_layout (once settings resolve).
  //   3. 'categories' (current tile behaviour — pixel-identical default).
  //
  // Deliberately DERIVED at render time, not stored on the step (no "correct
  // it in an effect once settings arrive" dance like the variant/Context
  // case needs): operatorSettings resolves once and never changes again for
  // the session, so recomputing this on every render is enough — the render
  // that follows the settings fetch naturally reflects the right mode the
  // moment it lands, however the groups-fetch and settings-fetch effects
  // happen to race. Every call site that renders or constructs a
  // pick-category step reads this directly instead of stashing a `mode` on
  // the step itself.
  const resolvedCatalogMode: 'categories' | 'expanded' =
    catalog === 'expanded'
      ? 'expanded'
      : catalog === 'categories'
        ? 'categories'
        : operatorSettings.widget_catalog_layout === 'expanded'
          ? 'expanded'
          : 'categories'

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
      // landr-fn4i / landr-5krc: a full restart is a brand-new booking —
      // any previously-typed member-perk code must not silently ride along.
      setMemberPerkOtp('')
      // landr-otml0.3: same reasoning — a confirmed shared-double reference
      // from the PREVIOUS booking must not silently ride along either.
      setJoinRef(null)
      // landr-87n9.2: clear live accommodation state on a full restart.
      clearLiveAccommodation()
      // landr-nmed: a full restart (post-booking, or "← All categories" /
      // Back-to-catalog) is the ONE place the persistent booking-draft is
      // discarded — the customer is starting a brand-new booking.
      setBookingDraft({})
      // landr-71kz.4: also clear accumulated form_responses on restart.
      setFormResponses([])
      // landr-71kz.10 / landr-iyyf fix-forward: drop the cached remote flow
      // AND its promise cache on a full restart so the next product's flow is
      // fetched fresh (a new product is being chosen) — see
      // clearProductFlowCache's doc for why clearing only `remoteFlow` isn't
      // enough.
      clearProductFlowCache()
      // landr-iyyf fix-forward (MEDIUM 2): a full restart already clears
      // bookingDraft entirely (above), so also drop the tracked "last
      // product" — otherwise the very next product pick would be compared
      // against the product being LEFT, which is harmless (the draft is
      // already empty) but keeps the bookkeeping honest.
      lastProductIdRef.current = undefined
      // landr-2mgl: drop the persisted snapshot synchronously on a full
      // restart so a reload immediately after starting over never resurrects
      // the finished/abandoned funnel. The persistence effect would also
      // clear it once the pick-product state commits, but doing it here makes
      // the restart self-documenting and the clear deterministic.
      clearStoredProgress()
      // landr-d8rg.4: when restarting after a booking, go back to pick-product
      // (unscoped or scoped) — not to pick-category. This preserves the
      // existing goToProductStep behavior for post-booking restart.
      setStep({ name: 'pick-product' })
      void productGroupSlug // reserved for future use
    },
    [clearLiveAccommodation, clearProductFlowCache],
  )

  // landr-6eita.1: does this product open straight on Dates, with no way back
  // to its product-detail step? Only the deep-linked product itself
  // (`?product=`) under `?start=dates` — a card picked from the catalogue that
  // an unresolved slug falls back to keeps the normal Overview → Dates flow.
  const opensOnDates = useCallback(
    (p: Product) => startAtDates && p.slug === product,
    [startAtDates, product],
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
    // landr-nmed: re-seed the DetailsStep from the persistent draft so that a
    // breadcrumb jump back to Dates (or the product crumb) + Continue restores
    // the booker / participants / companions the customer already entered,
    // instead of re-mounting an empty form. detailsFromDraft yields undefined
    // fields on the initial forward visit (empty draft), so the first pass is
    // unchanged. The accommodation / declarations slices stay in the draft and
    // are re-applied as the customer steps forward through afterDetails.
    setStep(detailsFromDraft(product, selection, bookingDraft))
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
    // landr-de6ej: trimmed comment text ('' when left blank).
    comment: string,
  ) => {
    // landr-nmed: commit the just-entered details into the persistent draft so
    // they survive a later breadcrumb jump back to Dates / the product crumb.
    // landr-de6ej: comment folds '' -> null (mergeDraftPatch only skips
    // `undefined`, not ''), matching every other nullable draft slice.
    mergeDraft({
      booker,
      participants,
      companions,
      customerComment: comment || null,
    })
    // landr-pv2r1 (E3): an any-language product never shows the language
    // board, so drop any assignment an earlier restricted product left in
    // the draft — it could only mislead, and would silently re-appear if the
    // customer went back to that product. (Done here, in the handler, rather
    // than in an effect: react-hooks/set-state-in-effect.)
    if (productAcceptsAnyLanguage(product.guide_languages)) {
      setBookingDraft((prev) =>
        prev.participantLanguages
          ? { ...prev, participantLanguages: undefined }
          : prev,
      )
    }
    const offering = product.hotel_offering ?? 'none'
    if (product.product_kind === 'service' && offering !== 'none') {
      // landr-nmed: re-seed the AccommodationStep from the draft so a customer
      // who'd already picked rooms/add-ons, then jumped back to Dates, returns
      // here with their hotel choice + rooms + assignment + breakfast intact
      // (AccommodationStep re-clamps add-ons against capacity on re-mount —
      // landr-u4fl; the party-indexed assignment is unaffected by date edits).
      setStep({
        name: 'pick-accommodation',
        product,
        selection,
        booker,
        participants,
        companions,
        hotelLocationId: bookingDraft.hotelLocationId,
        accommodationRooms: bookingDraft.accommodationRooms,
        addons: bookingDraft.addons,
        includeHotel: bookingDraft.includeHotel,
        isSharedDouble: bookingDraft.isSharedDouble,
        accommodationMode: bookingDraft.accommodationMode,
        roomAssignment: bookingDraft.roomAssignment,
        occupantAgeMap: bookingDraft.occupantAgeMap,
        perRoomAddons: bookingDraft.perRoomAddons,
        roomProductNames: bookingDraft.roomProductNames,
        breakfastMap: bookingDraft.breakfastMap,
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
            // landr-nmed: restore any add-ons already chosen before a Dates jump.
            addons: bookingDraft.addons,
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
    // landr-a4fy: per-occupant breakfast flag map for the submit payload.
    breakfastMap: BreakfastMap | undefined = undefined,
  ) => {
    // landr-87n9.2: the selection is now committed into the step state;
    // clear the live-lift so a later Back into pick-accommodation falls back
    // to the restored step values rather than stale live values.
    clearLiveAccommodation()
    // landr-uwvl: THE OUTBOUND SEAM. AccommodationStep confirms the three maps
    // in its own party-INDEX space; from here on they live in the draft + the
    // Step union, both of which outlive a DetailsStep roster edit. Re-key them
    // to stable PartyMemberIds now, against the very roster the step was
    // rendered with, so a later add/remove of a participant or companion can
    // never renumber the party out from under them.
    const partyRoster = buildPartyRoster(participants, companions)
    const partyAssignment = roomAssignment
      ? toIdentityKeyed(roomAssignment, partyRoster)
      : undefined
    const partyAgeMap = occupantAgeMap
      ? toIdentityKeyed(occupantAgeMap, partyRoster)
      : undefined
    const partyBreakfastMap = breakfastMap
      ? toIdentityKeyed(breakfastMap, partyRoster)
      : undefined
    // landr-nmed: commit the accommodation + booker/participant context into
    // the persistent draft so a later breadcrumb jump back to Dates / the
    // product crumb re-seeds it all on the way forward.
    mergeDraft({
      booker,
      participants,
      companions,
      accommodationRooms,
      hotelLocationId,
      addons,
      hadServiceAddons,
      includeHotel,
      isSharedDouble,
      accommodationMode,
      roomAssignment: partyAssignment,
      occupantAgeMap: partyAgeMap,
      perRoomAddons,
      roomProductNames,
      breakfastMap: partyBreakfastMap,
    })
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
      // landr-gb2f.2 / landr-uwvl: participant → room assignment threads
      // through, identity-keyed.
      partyAssignment,
      // landr-doam.1: per-occupant age band + age threads through.
      partyAgeMap,
      // landr-gb2f.5: per-room add-on map threads through to the review.
      perRoomAddons,
      // landr-gb2f.5: room product names thread through to the review.
      roomProductNames,
      // landr-a4fy: breakfast map threads through to the review.
      partyBreakfastMap,
    )
    // landr-71kz.10: if stepAfterAccommodation resolved straight to the review
    // screen, route into the operator-configured custom-form chain first (when
    // the product's remote flow has any custom_form modules). pick-pickup is
    // left unchanged — the pickup step's onConfirm handler runs the same
    // pre-review router. With no remote flow this is identical to fill-form.
    // landr-iyyf: withResolvedFlow gates this on flow READINESS rather than
    // reading flowForProduct's possibly-not-yet-cached value directly — a
    // still-in-flight fetch must never be read as "no custom forms".
    if (next.name === 'fill-form') {
      withResolvedFlow(product.product_id, (flow) => {
        setStep(
          enterReviewOrCustomForm(
            next,
            flow,
            // landr-nmed: re-seed any custom-form answers from the draft so a
            // forward pass after a breadcrumb jump restores the customer's input.
            bookingDraft.customFormAnswers,
            // landr-r6e5x.4 / landr-p68d2: the language step is the first
            // pre-review step, gated on THIS product's offered languages.
            offeredLanguagesForProduct(product).length > 0,
          ),
        )
      })
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

  // landr (breadcrumb): jump back to any prior step with its state restored.
  // navigateTo clears the ephemeral live-selection state (mirroring the back
  // handlers) before swapping to the reconstructed target step, which already
  // carries the previously-confirmed values.
  const navigateTo = useCallback(
    (target: Step) => {
      // landr-nmed: capture the FULL downstream draft from the step the
      // customer is leaving, BEFORE we swap to an earlier crumb. This makes
      // the persistent draft authoritative regardless of how the customer
      // got here — so when they jump back to Dates / the product crumb and
      // continue forward, every downstream slice (booker / participants /
      // companions / accommodation / declarations) is preserved and re-seeded
      // rather than wiped. A no-op (undefined) before any details exist.
      const captured = draftFromStep(step)
      // landr-iyyf: mergeCapturedDraft deep-merges `customFormAnswers` instead
      // of a plain spread, so a breadcrumb jump away from a custom-form step
      // never drops OTHER forms' already-confirmed answers (see its doc).
      if (captured) {
        setBookingDraft((prev) => mergeCapturedDraft(prev, captured))
      }
      setLiveSelectionDays([])
      setLiveParticipantCount(0)
      setLiveParticipantNames([])
      clearLiveAccommodation()
      setStep(target)
    },
    [clearLiveAccommodation, step],
  )

  // landr (breadcrumb): the ordered crumb trail for the current step. Empty for
  // non-funnel steps (catalog, confirmation, …) so StepBackButton falls back to
  // the single back affordance there. Memoised on the step (+ the remote flow)
  // so the context value stays referentially stable while the step is unchanged
  // — otherwise every App re-render would rebuild the trail and force all
  // breadcrumb consumers to re-render.
  // landr-71kz.10: the crumb trail now reconstructs the custom-form chain from
  // the active product's remote flow (replacing the hardcoded declarations crumb).
  const activeFlow = flowForProduct(activeProductId)
  const breadcrumbItems = useMemo(() => {
    const productLabel =
      'product' in step
        ? pickLocalized(
            step.product.name,
            step.product.name_localized,
            browserLocale(),
          )
        : undefined
    return buildBreadcrumb(step, {
      remoteFlow: activeFlow,
      customFormAnswers: bookingDraft.customFormAnswers,
      productLabel,
      // landr-p68d2: per-product now, not per-operator — 'product' in step
      // mirrors the productLabel guard above for the same reason (some
      // funnel steps, e.g. pick-product, carry no product at all).
      languageStep:
        'product' in step
          ? offeredLanguagesForProduct(step.product).length > 0
          : false,
      // landr-6eita.1: no product-detail crumb for a start=dates product.
      startAtDates: 'product' in step && opensOnDates(step.product),
    })
  }, [
    step,
    activeFlow,
    bookingDraft.customFormAnswers,
    offeredLanguagesForProduct,
    opensOnDates,
  ])
  const breadcrumbNav = useMemo(
    () => ({ items: breadcrumbItems, onNavigate: navigateTo }),
    [breadcrumbItems, navigateTo],
  )

  // landr-il9f.2: no token or unknown token → show the generic landing page.
  if (showLanding) return <LandingPage />

  // landr-ens5 / landr-yp8x — apply the operator's brand theme as CSS
  // variable overrides at the widget root so every component that reads
  // var(--background)/var(--foreground)/var(--primary) (root canvas,
  // Button, PriceSidebar CTA, headings, accent borders) picks it up.
  // Setting it as inline style at the widget root means we don't mutate a
  // global stylesheet (which would leak across embeds when the host page
  // mounts more than one widget instance — uncommon but possible).
  //
  // The operator's 3-colour theme (brand/accent/background) wins when
  // present; otherwise the legacy single primary_color → --primary path
  // is preserved; otherwise no inline vars and index.css defaults stand.
  // (See lib/widgetTheme.ts for the mapping + contrast safety. Dark mode
  // is carried on the type but not applied — the widget has no active
  // dark mode today.)
  const brandStyle: CSSProperties = widgetThemeStyle(operatorSettings)

  // landr-rjda — "first step" = the product/category selection screen.
  // pick-category only appears when the operator has >1 product group; both
  // it and pick-product are the initial entry point, so either qualifies.
  const isFirstStep =
    step.name === 'pick-product' || step.name === 'pick-category'

  // landr-6eita.1: the date picker's Back returns to the catalogue, whose
  // ?product= preselect lands on product-detail again. A start=dates product
  // has neither to go back to, so its date step renders no Back at all.
  const datePickerBack =
    step.name === 'pick-selection' && opensOnDates(step.product)
      ? undefined
      : goToProductStep

  // landr-otml0.3 review fix (MINOR 4): without this, an invite link briefly
  // rendered the full product catalogue (a fetch + render cycle) before the
  // invite-resolution effect above swapped the step to pick-selection —
  // visible, confusing flash for a customer who followed a link that's
  // supposed to skip straight to Dates. `inviteData === undefined` means
  // "still resolving" (see its declaration); once it settles to an object
  // (success, already past this step) or `null` (404 → plain wizard is the
  // intended fallback, so let it through) this gate no longer applies.
  if (invite && inviteData === undefined && step.name === 'pick-product') {
    return (
      <div
        className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground"
        style={brandStyle}
        data-testid="widget-root"
      >
        <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
          <div
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            data-testid="invite-resolving"
            role="status"
            aria-live="polite"
          >
            <span>Resolving your invite…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    // landr-2mgl: overscroll-y-contain on the widget's outermost scroll
    // container stops a stray top-of-page swipe from triggering the mobile
    // browser's pull-to-refresh — which would reload the iframe and (before
    // the sessionStorage restore below) wipe the customer's progress.
    <div
      className="min-h-screen embedded:min-h-0 overscroll-y-contain bg-background text-foreground"
      style={brandStyle}
      data-testid="widget-root"
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
        {(() => {
          // landr-rjda: each text element may be gated to the first step.
          // The logo is always shown (no flag). The <header> wrapper renders
          // only when at least one part is actually visible — avoids an empty
          // box when all text is first-page-only and we're past the first step.
          const showHeadline =
            !!(operatorSettings.widget_headline &&
              (!operatorSettings.widget_headline_first_page_only || isFirstStep))
          const showDescription =
            !!(operatorSettings.widget_description &&
              (!operatorSettings.widget_description_first_page_only || isFirstStep))
          // landr-otml0.2 D8: widget_show_logo defaults true (init state
          // above); an explicit false hides the logo even when one is
          // uploaded, without touching the headline/description gates.
          const showLogo =
            !!operatorSettings.logo_url && operatorSettings.widget_show_logo !== false
          if (!showLogo && !showHeadline && !showDescription) return null
          return (
            <header className="flex flex-col gap-2">
              {showLogo ? (
                <img
                  src={operatorSettings.logo_url ?? undefined}
                  alt={operatorSettings.name ?? operatorSettings.slug}
                  className="h-10 w-auto max-w-[160px] object-contain"
                  data-testid="widget-logo"
                />
              ) : null}
              {showHeadline ? (
                <h1
                  className="text-xl font-semibold"
                  data-testid="widget-headline"
                >
                  {operatorSettings.widget_headline}
                </h1>
              ) : null}
              {showDescription ? (
                <p
                  className="text-muted-foreground text-sm whitespace-pre-line"
                  data-testid="widget-description"
                >
                  {operatorSettings.widget_description}
                </p>
              ) : null}
            </header>
          )
        })()}

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
          landr-otml0.3: persistent banner across every step once an invite
          link resolved, so the customer always knows why dates/hotel came
          pre-filled. Hidden once the booking is confirmed — nothing left to
          explain by then.
        */}
        {inviteData && step.name !== 'confirmed' ? (
          <div
            className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface-well px-3 py-2 text-sm shadow-well"
            data-testid="invite-banner"
            role="status"
          >
            <span>
              You&rsquo;re joining {inviteData.host_display_name}&rsquo;s
              booking (ref {inviteData.host_reference}). Dates and hotel are
              prefilled — change anything that differs for you.
            </span>
          </div>
        ) : null}

        {/*
          landr-otml0.3: dismissible notice for an invite link that no
          longer resolves (404, or the invited product is gone/sold out) —
          this widget has no toast component, so a dismissible banner in the
          same style as the preview-mode banner above stands in for one.
        */}
        {inviteNotice ? (
          <div
            className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            data-testid="invite-notice"
            role="status"
          >
            <span>{inviteNotice}</span>
            <button
              type="button"
              className="shrink-0 text-amber-800/70 hover:text-amber-900"
              aria-label="Dismiss"
              onClick={() => setInviteNotice(null)}
              data-testid="invite-notice-dismiss"
            >
              ×
            </button>
          </div>
        ) : null}

        {/*
          landr-iyyf: brief loading state gating the pre-review transition.
          Visible for the short window (usually well under a second) between
          Continue and the active product's flow fetch settling, when that
          fetch hadn't already resolved by click time. Without this, the
          transition would have to guess whether "no flow yet" means "no
          custom forms configured" or "still in flight" — and guessing wrong
          silently skips a required declaration client-side (the SERVER is
          the authoritative gate regardless — see booking_submit.py — but the
          widget should never race ahead here either).
        */}
        {pendingFlowProductId && pendingFlowProductId === activeProductId ? (
          <div
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            data-testid="flow-readiness-gate"
            role="status"
            aria-live="polite"
          >
            <span>Checking your booking requirements…</span>
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
        <BreadcrumbNavContext.Provider value={breadcrumbNav}>
        <StepTransition stepKey={step.name}>
        {/*
          landr-d8rg.4: category entrance — shown when the operator has >1
          non-empty group AND no deep link is set. Selecting a group scopes
          pick-product to that group.

          landr-4a5j: when resolvedCatalogMode === 'expanded' (operator-
          configured catalog layout, ?catalog= override), render
          ExpandedCatalog instead — same step, same promotion trigger,
          different first-step UI: all products under category headers, no
          drill-in. Deep links (?group=/?product=) already bypass this whole
          branch via the groups-fetch effect's own guard, unchanged.
        */}
        {step.name === 'pick-category' ? (
          resolvedCatalogMode === 'expanded' ? (
            <ExpandedCatalog
              operatorToken={token!}
              previewToken={previewToken ?? undefined}
              groups={step.groups}
              showSoldOut={showSoldOut}
              exposeSeats={operatorSettings.expose_seats_to_customer}
              onSelect={(p) => {
                setStep({ name: 'product-detail', product: p })
              }}
            />
          ) : (
            <CategoryStep
              groups={step.groups}
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
          )
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
              // so the deep link shows the detail page first — unless the
              // embed asked for start=dates (landr-6eita.1), which lands the
              // deep-linked product straight on the date picker.
              setStep(productEntryStep(p, opensOnDates(p)))
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
        {step.name === 'product-detail'
          ? (() => {
              const nonEmptyGroups = (productGroups ?? []).filter(
                (g) => g.product_count > 0,
              )
              // landr-3y1u3: Back is only legitimate when there is somewhere
              // to return to. The one case with nothing to return to is a
              // top-level ?product= deep link with no group scope — the
              // widget lands straight on product-detail without ever
              // showing a catalogue (no `?group=`, no pickedGroupSlug from
              // in-app category navigation). Every other path — normal
              // unscoped/scoped browsing, a ?group= deep link into a scoped
              // list — did show a list the customer can legitimately return
              // to, so `!product` alone (no ?product= param at all) already
              // covers the non-deep-link cases; `group`/`pickedGroupSlug`
              // cover a scoped ?product= deep link.
              const canGoBack = Boolean(!product || group || pickedGroupSlug)
              return (
                <ProductDetailStep
                  product={step.product}
                  onBook={() =>
                    setStep({ name: 'pick-selection', product: step.product })
                  }
                  onBack={
                    canGoBack
                      ? () => {
                          // landr-iyyf fix-forward (MEDIUM 1): this bare setStep back to
                          // pick-product/pick-category used to reset NEITHER remoteFlow
                          // nor its promise cache — align it with goToProductStep so
                          // leaving this product's detail page never leaves a stale
                          // cached flow behind for a later re-visit.
                          clearProductFlowCache()
                          // landr-d8rg.4 Back nav:
                          //   - If we have a picked group slug, return to the scoped product list.
                          //   - If we have multiple non-empty groups (categories/expanded catalog
                          //     were shown) and no group scope, return to pick-category.
                          //   - Otherwise (unreachable when canGoBack is true) return to pick-product.
                          if (pickedGroupSlug) {
                            // Back to scoped list (group scope preserved via pickedGroupSlug state).
                            setStep({ name: 'pick-product' })
                          } else if (nonEmptyGroups.length > 1 && productGroups) {
                            // Categories/expanded catalog were shown but no group was picked
                            // (e.g. a product selected directly from the expanded catalog).
                            // Return to pick-category — resolvedCatalogMode (landr-4a5j) is
                            // derived at render time from the SAME inputs regardless of which
                            // step instance this is, so the render swap below picks the right
                            // UI automatically; no mode needs to be threaded onto the step.
                            setStep({ name: 'pick-category', groups: productGroups })
                          } else {
                            setStep({ name: 'pick-product' })
                          }
                        }
                      : undefined
                  }
                />
              )
            })()
          : null}

        {/*
          landr-7jgo: standalone "Fully booked" state for a single-product
          deep link (?product=<slug>) that resolved to a sold-out product.
          No date picker, no Select CTA — there is nothing to book. Back
          returns to the (filtered) catalogue overview, when one was ever
          shown. This step is reached only via a ?product= deep link
          (preselectSlug, ProductList's onPreselectSoldOut) — `product` is
          therefore always set here — so, matching the landr-3y1u3
          canGoBack rule on the product-detail branch above, Back is only
          legitimate when the deep link was into a scoped group (?group= or
          pickedGroupSlug); a top-level ?product= deep link has no
          catalogue to go back to.
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
            onBack={
              group || pickedGroupSlug ? goToProductStep : undefined
            }
          />
        ) : null}

        {/*
          Step machine branching (landr-y9k). First branch is product_kind:
          non-service, non-subscription kinds (digital_good, physical_good,
          gift_card) render the ShopComingSoonStub since the booking widget
          doesn't take checkout for shop kinds yet. subscription is the one
          exception (landr-1kk.5) — it gets a real checkout CTA, branched
          separately just below. For services, branch on
          service_time_shape to pick the right picker; MultiDayPicker also
          consumes product.is_contiguous to switch between any-day-toggle
          and consecutive-only modes.
        */}
        {step.name === 'pick-selection' &&
        step.product.product_kind !== 'service' &&
        step.product.product_kind !== 'subscription' ? (
          <ShopComingSoonStub product={step.product} onBack={datePickerBack} />
        ) : null}

        {/* landr-1kk.5: "become a member" Stripe checkout for
            product_kind='subscription' — the deferred slice of landr-c3t. */}
        {step.name === 'pick-selection' &&
        step.product.product_kind === 'subscription' ? (
          <MembershipCheckoutStep
            product={step.product}
            onBack={datePickerBack}
            widgetToken={token!}
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'time_slot' ? (
          <AvailabilityPicker
            product={step.product}
            exposeSeatsToCustomer={operatorSettings.expose_seats_to_customer}
            onBack={datePickerBack}
            // landr (breadcrumb): restore the prior slot on back-nav re-entry.
            initialSlot={
              step.selection?.kind === 'slot' ? step.selection.slot : undefined
            }
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
            onBack={datePickerBack}
            // landr (breadcrumb): the committed window id rides on the restored
            // slot's availability_id — re-select it on back-nav re-entry.
            initialWindowId={
              step.selection?.kind === 'slot'
                ? (step.selection.slot.availability_id ?? undefined)
                : undefined
            }
            onConfirm={(_slot, window, forced, forcedReasons) => {
              const days = expandWindowDays(window)
              afterSelection(step.product, {
                kind: 'days',
                selectedDays: days,
                // landr-aoak.2/t869m.5: a force-booked blocked window marks
                // ALL its days as forced (so the submit adapter raises
                // ignore_capacity) and carries WHICH gate(s) it bypassed.
                ...(forced ? { forcedDays: days, forcedReasons } : {}),
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
            onBack={datePickerBack}
            // landr (breadcrumb): restore the prior day selection on re-entry.
            // landr-otml0.3: on the FIRST visit via an invite link (no prior
            // selection yet), default to the host's dates instead of empty —
            // the ticket's "dates = host's dates" prefill.
            initialSelectedDays={
              step.selection?.kind === 'days'
                ? step.selection.selectedDays
                : inviteData && inviteData.product_id === step.product.product_id
                  ? inviteData.dates
                  : undefined
            }
            // landr-otml0.3: invite-mode diff baseline — undefined (no diff
            // chrome) for every non-invite booking.
            originalDays={
              inviteData && inviteData.product_id === step.product.product_id
                ? inviteData.dates
                : undefined
            }
            originalDaysLabel={inviteData?.host_display_name}
            onConfirm={(selectedDays, forcedDays, forcedReasons) =>
              afterSelection(step.product, {
                kind: 'days',
                selectedDays,
                // landr-aoak.2/t869m.5: carry the force-booked subset (staff
                // mode only) and which gate(s) it bypassed.
                ...(forcedDays && forcedDays.length > 0
                  ? { forcedDays, forcedReasons }
                  : {}),
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
            onBack={datePickerBack}
            // landr (breadcrumb): restore the prior single-date pick on re-entry.
            initialSelectedDays={
              step.selection?.kind === 'days'
                ? step.selection.selectedDays
                : undefined
            }
            onConfirm={(selectedDays, forcedDays, forcedReasons) =>
              afterSelection(step.product, {
                kind: 'days',
                selectedDays,
                // landr-aoak.2/t869m.5: carry the force-booked day (staff
                // mode only) and which gate(s) it bypassed.
                ...(forcedDays && forcedDays.length > 0
                  ? { forcedDays, forcedReasons }
                  : {}),
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
            // landr-4uyu: operator contact email for the participant-max
            // "larger group / flight school" contact-us line. Null when the
            // operator hasn't set one (or the API predates the key) — the
            // copy still renders but the mailto is omitted.
            contactEmail={operatorSettings.contact_email ?? null}
            // landr-y1t4: only operators with an ACTIVE subscription perk get
            // the member-perk code field. `?? false` is the load-bearing half —
            // until getOperatorSettings resolves (and on an API old enough to
            // predate the key) the field stays hidden rather than flashing in
            // and then vanishing.
            hasMemberPerks={operatorSettings.has_member_perks ?? false}
            // landr-ehye: token passed to GroupInquiryForm for the POST.
            operatorToken={token!}
            initialBooker={step.booker}
            initialParticipants={step.participants}
            // landr-87n9.3: restore the non-guiding companions on Back.
            initialCompanions={step.companions}
            // landr-fn4i / landr-5krc: restore the member-perk code on Back —
            // this is the top-level lifted state, not the Step union, so it
            // survives the remount on its own regardless of how step changed.
            initialMemberPerkOtp={memberPerkOtp}
            onMemberPerkOtpChange={setMemberPerkOtp}
            // landr-de6ej: restore the comment on Back / reload — sourced
            // from the persistent draft (it round-trips through
            // sessionStorage), unlike memberPerkOtp above.
            initialCustomerComment={bookingDraft.customerComment}
            // landr-otml0.3 review fix (MINOR 6): set only on the one mount
            // that follows a companion_contact_required rejection; cleared
            // by DetailsStep itself once applied.
            initialFocusCompanionContactIndex={focusCompanionContactIndex}
            onCompanionContactFocusApplied={() =>
              setFocusCompanionContactIndex(undefined)
            }
            onBack={() =>
              // landr (breadcrumb): carry the committed selection back so the
              // date picker re-mounts showing the customer's prior dates.
              setStep({
                name: 'pick-selection',
                product: step.product,
                selection: step.selection,
              })
            }
            onConfirm={(booker, participants, companions, comment) =>
              afterDetails(
                step.product,
                step.selection,
                booker,
                participants,
                companions,
                comment,
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
            // landr-otml0.3: hides the shared-double reference field — an
            // invite-linked customer is already joined via the token.
            inviteMode={!!inviteData}
            onJoinRefChange={setJoinRef}
            // landr-sjrd: progressive name disambiguation — build the whole
            // party (participants first, companions after; mirrors the room
            // assignment index space) and split disambiguated labels back at
            // the participant boundary. Companions carry last_name (may be
            // ''); an empty last_name falls back to first-name-only (best
            // effort, can't add an initial without a last name).
            {...(() => {
              const pCount = step.participants.length
              const party = [
                ...step.participants.map((p) => ({
                  first: p.first_name,
                  last: p.last_name ?? '',
                })),
                ...step.companions.map((c) => ({
                  first: c.first_name,
                  last: c.last_name ?? '',
                })),
              ]
              const labels = disambiguatePartyLabels(party)
              return {
                participantNames: labels.slice(0, pCount),
                // landr-87n9.3: companions join the whole-party room
                // assignment, appended after participants, badged "guest".
                companionNames: labels.slice(pCount),
              }
            })()}
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
            // landr-gb2f.2 / landr-doam.1 / landr-z59y: restore the room
            // assignment, the per-occupant age map and which occupants hold a
            // breakfast chip (AccommodationStep re-clamps that to the restored
            // rooms).
            //
            // landr-uwvl: THE INBOUND SEAM. The step carries these keyed by
            // stable PartyMemberId; AccommodationStep works in the party-INDEX
            // space. Resolve against the CURRENT roster — the same list, in the
            // same order, that built participantNames/companionNames above — so
            // a member removed in DetailsStep drops out (freeing their bed for
            // autoAssignParty to top up) while everyone else keeps the exact
            // room they were in, instead of inheriting their neighbour's.
            {...(() => {
              const roster = buildPartyRoster(step.participants, step.companions)
              return {
                initialAssignment: toIndexKeyedOrUndefined(
                  step.roomAssignment,
                  roster,
                ),
                initialAgeMap: toIndexKeyedOrUndefined(
                  step.occupantAgeMap,
                  roster,
                ),
                initialBreakfastMap: toIndexKeyedOrUndefined(
                  step.breakfastMap,
                  roster,
                ),
              }
            })()}
            // landr-n6ii3: editable "Anything we should know?" field on
            // every step from details onward — reads/writes the draft
            // directly, live, on every keystroke.
            customerComment={bookingDraft.customerComment ?? ''}
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
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
            onConfirm={(rooms, hotelLocationId, addons, includeHotel, isSharedDouble, roomAssignment, ageMap, perRoomAddons, roomProductNames, breakfastMap) =>
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
                // landr-a4fy: thread breakfast map to submit step.
                breakfastMap,
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
            // landr-n6ii3: editable "Anything we should know?" field on
            // every step from details onward — reads/writes the draft
            // directly, live, on every keystroke.
            customerComment={bookingDraft.customerComment ?? ''}
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
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
            // landr-n6ii3: editable "Anything we should know?" field on
            // every step from details onward — reads/writes the draft
            // directly, live, on every keystroke.
            customerComment={bookingDraft.customerComment ?? ''}
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
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
                  breakfastMap: step.breakfastMap,
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
              // landr-71kz.10: route into the operator-configured custom-form
              // chain (when the product's remote flow has any) before the review
              // screen; otherwise straight to fill-form. Replaces the hardcoded
              // declarations branch.
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
                breakfastMap: step.breakfastMap,
              }
              // landr-nmed: persist the chosen pickup into the draft.
              mergeDraft({ pickupLocationId: locationId })
              // landr-iyyf: gate on flow readiness — see the afterAccommodation
              // fill-form branch for the full rationale.
              withResolvedFlow(step.product.product_id, (flow) => {
                setStep(
                  enterReviewOrCustomForm(
                    fillFormArgs,
                    flow,
                    // landr-nmed: restore prior custom-form answers on the forward pass.
                    bookingDraft.customFormAnswers,
                    // landr-r6e5x.4 / landr-p68d2: the language step is the
                    // first pre-review step, gated on THIS product's
                    // offered languages.
                    offeredLanguagesForProduct(step.product).length > 0,
                  ),
                )
              })
            }}
          />
        ) : null}

        {/* landr-r6e5x.4 / epic decision D3, narrowed by landr-9sjw5:
            per-PARTICIPANT guide language. Its own step, before the
            custom-form chain, for every product — the API validates
            participants[].language on every public submit, so collecting it
            only inside a custom form dead-ended every product without one.
            Non-guiding companions are deliberately left off this board: it
            never mattered to the operator what a non-participant speaks, so
            landr-9sjw5 stopped asking them (companions[].language stays
            an optional field the API accepts but never requires). */}
        {step.name === 'assign-languages' ? (
          <LanguageStep
            productName={step.product.name}
            offeredLanguages={offeredLanguagesForProduct(step.product)}
            {...(() => {
              const party = step.participants.map((p) => ({
                first: p.first_name,
                last: p.last_name ?? '',
              }))
              const labels = disambiguatePartyLabels(party)
              // Roster stays WHOLE-PARTY (participants + companions): the
              // draft's participantLanguages map is identity-keyed against
              // it, and reusing the same roster here keeps that index
              // arithmetic correct even though the board itself only ever
              // sees indices 0..participants.length-1.
              const roster = buildPartyRoster(step.participants, step.companions)
              return {
                // Labels are disambiguated exactly as AccommodationStep does it,
                // so "Ada L." reads identically on both boards.
                participantNames: labels,
                // THE INBOUND SEAM (landr-uwvl): the draft keys by person, the
                // board works in party indices. Resolving against the CURRENT
                // roster means a member removed in DetailsStep drops out and
                // shows as unassigned rather than inheriting a neighbour's
                // language. Any companion entries a stale draft still carries
                // are simply pruned by LanguageStep (partyCount = participants
                // only) — see pruneLanguageAssignment.
                initialAssignment: toIndexKeyed(
                  bookingDraft.participantLanguages,
                  roster,
                ),
              }
            })()}
            // landr-n6ii3: editable "Anything we should know?" field on
            // every step from details onward — reads/writes the draft
            // directly, live, on every keystroke.
            customerComment={bookingDraft.customerComment ?? ''}
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
            // landr-8sk6l: "Other languages spoken" is asked here, beside the
            // board, and written live into the operator form's own answer
            // slot — the custom form later mirrors it instead of asking again.
            {...(() => {
              const lifted = findOtherLanguagesField(
                resolvedFlowForProduct(step.product.product_id),
              )
              if (!lifted) return {}
              return {
                otherLanguages: {
                  label:
                    pickLocalized(lifted.field.label, lifted.field.label_localized, 'en') ||
                    'Other languages spoken',
                  helpText: pickLocalized(
                    lifted.field.help_text,
                    lifted.field.help_text_localized,
                    'en',
                  ),
                  maxLength: lifted.field.validation?.max_length ?? null,
                  value: otherLanguagesFromDraft(
                    bookingDraft.customFormAnswers,
                    lifted.formKey,
                  ),
                  onChange: (value: string) =>
                    mergeDraft({
                      customFormAnswers: withOtherLanguages(
                        bookingDraft.customFormAnswers,
                        lifted.formKey,
                        value,
                      ),
                    }),
                },
              }
            })()}
            onBack={() =>
              setStep(
                stepBeforeLanguages({
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
                  breakfastMap: step.breakfastMap,
                }),
              )
            }
            onConfirm={(assignment) => {
              // THE OUTBOUND SEAM: the board reports party indices, the draft
              // stores stable ids so a later roster edit cannot hand one person
              // another person's language (landr-uwvl).
              mergeDraft({
                participantLanguages: toIdentityKeyed(
                  assignment,
                  buildPartyRoster(step.participants, step.companions),
                ),
              })
              setStep(
                stepAfterLanguages(
                  {
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
                    breakfastMap: step.breakfastMap,
                  },
                  flowForProduct(step.product.product_id),
                  bookingDraft.customFormAnswers,
                ),
              )
            }}
          />
        ) : null}

        {/* landr-71kz.4: operator-configured custom form step. */}
        {step.name === 'custom-form' ? (
          <CustomFormStep
            operatorToken={token!}
            productId={step.product.product_id}
            formKey={step.formKey}
            productName={step.product.name}
            // Restore answers from draft on back-nav re-entry.
            initialAnswers={step.initialAnswers as Record<string, unknown> | undefined}
            // landr-db45: thread the already-resolved flow down so this step
            // never re-fetches public_get_product_flow independently — see
            // CustomFormStepProps.flow's doc for the forward-dead-end bug
            // this closes.
            flow={resolvedFlowForProduct(step.product.product_id)}
            // landr-8sk6l: asked on the LanguageStep when that step ran for
            // this product; the form then hides its own field.
            {...(() => {
              if (offeredLanguagesForProduct(step.product).length === 0) return {}
              const lifted = findOtherLanguagesField(
                resolvedFlowForProduct(step.product.product_id),
              )
              if (!lifted) return {}
              return {
                otherLanguagesUpstream: {
                  formKey: lifted.formKey,
                  value: otherLanguagesFromDraft(
                    bookingDraft.customFormAnswers,
                    lifted.formKey,
                  ),
                },
              }
            })()}
            // landr-r6e5x.4: the assignment the LanguageStep captured upstream.
            // When this form also declares a `language` field it reports this
            // instead of asking again — the board is the single source.
            {...(() => {
              const roster = buildPartyRoster(step.participants, step.companions)
              return {
                participantLanguages: toIndexKeyed(
                  // landr-pv2r1 (E3): `{}` for an any-language product.
                  draftLanguagesForProduct(step.product),
                  roster,
                ),
                partyCount: step.participants.length + step.companions.length,
              }
            })()}
            // landr-n6ii3: editable "Anything we should know?" field on
            // every step from details onward — reads/writes the draft
            // directly, live, on every keystroke.
            customerComment={bookingDraft.customerComment ?? ''}
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
            onBack={() =>
              // landr-71kz.10: Back walks the custom-form chain (the prior
              // custom form, else the hotel-aware non-custom walk) — threading
              // this step's formKey + the remote flow.
              setStep(
                stepBeforeReview(
                  {
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
                    breakfastMap: step.breakfastMap,
                    remoteFlow: flowForProduct(step.product.product_id),
                    customFormAnswers: bookingDraft.customFormAnswers,
                    // landr-p68d2: per-product, not per-operator.
                    languageStep: offeredLanguagesForProduct(step.product).length > 0,
                  },
                  step.formKey,
                ),
              )
            }
            onConfirm={(entry, rawAnswers) => {
              // Accumulate the form response for the submit payload.
              mergeFormResponse(entry)
              // Persist the raw answers in the draft so a breadcrumb jump
              // back to a prior step and re-forward restores the form.
              const nextAnswers = {
                ...bookingDraft.customFormAnswers,
                [step.formKey]: rawAnswers,
              }
              mergeDraft({ customFormAnswers: nextAnswers })
              // landr-71kz.10: advance the custom-form chain — the NEXT custom
              // form in the plan, or the review screen when the chain is done.
              setStep(
                stepAfterCustomForm(
                  {
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
                    breakfastMap: step.breakfastMap,
                  },
                  step.formKey,
                  flowForProduct(step.product.product_id),
                  nextAnswers,
                ),
              )
            }}
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
            // landr-de6ej: read straight off the persistent draft, like
            // participantLanguages below — DetailsStep set it several steps
            // back and no intermediate step needs to re-display or edit it.
            customerComment={bookingDraft.customerComment}
            // landr-n6ii3: editable right here on the review screen too —
            // writes straight through to the draft, live, on every
            // keystroke, same as every other downstream step.
            onCustomerCommentChange={(comment) =>
              mergeDraft({ customerComment: comment || null })
            }
            // landr-ffyg.2: thread the shared-double marker into the submit
            // body. true → is_shared_double=true + no hotel_room lines +
            // hotel pickup; false/undefined → regular booking.
            isSharedDouble={step.isSharedDouble}
            // landr-gb2f.2 / landr-doam.1: thread the room assignment + age
            // map so BookingForm attaches room_product_id + room_unit_index and
            // occupant_age_band + occupant_age per occupant on submit.
            //
            // landr-uwvl: same inbound seam as AccommodationStep above — the
            // step's identity-keyed maps resolved against the current roster
            // (participants first, then companions: the unified index space
            // BookingForm indexes into). The breakfast map rides along in the
            // same conversion below.
            {...(() => {
              const roster = buildPartyRoster(step.participants, step.companions)
              return {
                roomAssignment: toIndexKeyedOrUndefined(
                  step.roomAssignment,
                  roster,
                ),
                occupantAgeMap: toIndexKeyedOrUndefined(
                  step.occupantAgeMap,
                  roster,
                ),
                breakfastMap: toIndexKeyedOrUndefined(step.breakfastMap, roster),
                // landr-r6e5x.4: the per-member guide language lives in the
                // DRAFT (the custom-form step writes it) rather than on the
                // step, so it rides the same roster conversion as the three
                // maps above and reaches the submit body as each
                // participant's / companion's `language`.
                // landr-pv2r1 (E3): `{}` for an any-language product, so no
                // stale assignment reaches the submit body.
                participantLanguages: toIndexKeyed(
                  draftLanguagesForProduct(step.product),
                  roster,
                ),
              }
            })()}
            // landr-gb2f.5: thread the per-room add-on map so BookingForm
            // can show breakfast status per room unit in the review.
            perRoomAddons={step.perRoomAddons}
            // landr-gb2f.5: thread room product names for the review labels.
            roomProductNames={step.roomProductNames}
            // landr-71kz.4: custom form answers collected by CustomFormStep(s).
            // Only sent when at least one form_response was accumulated.
            formResponses={formResponses.length > 0 ? formResponses : undefined}
            // landr-fn4i / landr-5krc: top-level lifted state from
            // DetailsStep — see memberPerkOtp's declaration above for why
            // this isn't threaded through step.* like booker/participants.
            memberPerkOtp={memberPerkOtp}
            // landr-otml0.3: the raw invite token (re-resolved server-side)
            // — only sent when the invite actually resolved to a prefill;
            // an expired/invalid link that fell back to the plain wizard
            // must not send a token the API will just reject again.
            inviteToken={inviteData ? (invite ?? undefined) : undefined}
            // landr-otml0.3: the shared-double reference confirmed in
            // AccommodationStep — top-level lifted state, same reasoning as
            // memberPerkOtp above.
            joinRef={joinRef ?? undefined}
            // landr-otml0.3 review fix (MINOR 6): the API's
            // companion_contact_required 422 sends the customer straight
            // back to DetailsStep with that exact row highlighted, rather
            // than leaving them to find it from formatHttpError's text
            // alone. detailsFromDraft rebuilds the SAME details step
            // bookingDraft.booker/participants/companions already carry
            // (afterDetails commits them there on the way forward) —
            // mirrors the pattern App.tsx already uses for a breadcrumb
            // jump back to Dates.
            onCompanionContactRequired={(companionIndex) => {
              setFocusCompanionContactIndex(companionIndex)
              setStep(detailsFromDraft(step.product, step.selection, bookingDraft))
            }}
            // landr-zenj.1: gates the Confirm CTA — see PriceSidebar's
            // onUnPriceableChange prop for where this state comes from.
            unPriceable={estimateUnPriceable}
            onBack={() => {
              // landr-71kz.10: Back from review walks the pre-review tail via
              // stepBeforeReview — the LAST custom form (when the operator
              // configured any), else the hotel-aware non-custom walk that
              // returns to pick-accommodation rather than a skipped pickup
              // picker (landr-87n9.1). All prior provenance + state is threaded
              // through so the upstream step re-mounts restored. Replaces the
              // hardcoded declarations back-hop.
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
                  breakfastMap: step.breakfastMap,
                  remoteFlow: flowForProduct(step.product.product_id),
                  customFormAnswers: bookingDraft.customFormAnswers,
                  // landr-p68d2: per-product, not per-operator.
                  languageStep: offeredLanguagesForProduct(step.product).length > 0,
                }),
              )
            }}
            onConfirmed={(response, email) => {
              // landr-2mgl: the booking is now placed — drop the persisted
              // snapshot so a reload on the confirmation screen can't replay a
              // completed/stale funnel. The persistence effect also skips the
              // non-restorable `confirmed` step, but clearing here is explicit
              // and synchronous with the success transition.
              clearStoredProgress()
              setStep({
                name: 'confirmed',
                response,
                email,
                // landr-otml0.4: carried through so Confirmation can show
                // the shared-double "add reference later" hint.
                isSharedDouble: step.isSharedDouble,
              })
            }}
          />
        ) : null}

        {step.name === 'confirmed' ? (
          <>
            <Confirmation
              response={step.response}
              onRestart={goToProductStep}
              isSharedDouble={step.isSharedDouble}
            />
            {/* landr-atwy: the account-link prompt creates a real LANDR
                account, so it only shows when the operator opts in. */}
            {operatorSettings.offer_account_link ? (
              <AccountLinkPrompt operatorToken={token!} email={step.email} />
            ) : null}
          </>
        ) : null}
        </StepTransition>
        </BreadcrumbNavContext.Provider>
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
            // landr-zenj.1: reports the visible estimate's un_priceable
            // flag up so BookingForm (a sibling, not a child) can block
            // its Confirm CTA on it — see the prop's doc on PriceSidebar.
            onUnPriceableChange={setEstimateUnPriceable}
          />
        ) : null}
      </div>
      {/*
        landr-nils — operator footer copy below the booking widget. No
        headline (by design): a single optional block for legal lines,
        contact info, etc. Full-width, centred to match the content
        column. Plain text with line breaks preserved (never HTML).
      */}
      {/* landr-rjda: footer respects widget_footer_first_page_only gate. */}
      {operatorSettings.widget_footer &&
       (!operatorSettings.widget_footer_first_page_only || isFirstStep) ? (
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

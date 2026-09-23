// landr-5aih0.9: German UI. pickBundle/tr now resolve the customer's
// resolved locale (see src/lib/locale.ts's browserLocale/configureCustomerLocale
// — invite override → operator customer_languages whitelist → browser →
// operator default) to a real bundle: 'de*' gets the German bundle, every
// other locale still gets English (v1 scope — see epic landr-5aih0, absorbs
// landr-wchwi). No i18n library: this file is the whole translation layer,
// extending the EN-only pattern landr-ifcu established. Every widget chrome
// string lives here (or in a page-scoped sibling — see
// components/booking/approvalReplyStrings.ts, which already ships de/en/es
// for ApprovalReplyPage under its own locale-resolution rule) so a German
// review is one file.

type Bundle = {
  multiDayPickerHelp: string
  multiDayPickerHelpRange: string
  multiDayPickerHelpContiguous: string
  /**
   * landr-de6ej: hint under DetailsStep's optional "Anything we should
   * know?" comment field. Sets the expectation that a NON-EMPTY comment
   * routes the booking to human review (the API's approval evaluator
   * forces requires_general_approval whenever this field is filled in)
   * before the customer types anything, rather than surprising them later.
   */
  customerCommentHint: string
  /**
   * landr-80ubl.1: zen-by-default primitives. `nextActionPrefix` leads the
   * accent cue NextAction shows over the one pending required control;
   * `helpDisclosureLabel` is HelpDisclosure's toggle ("ⓘ" is decoration,
   * added by the component, aria-hidden).
   */
  nextActionPrefix: string
  helpDisclosureLabel: string
  /** landr-80ubl.1: the Continue CTA's own cue once the step is satisfied. */
  continueCue: string
  continueLabel: string
  /** landr-80ubl.1: OptionalReveal's link text for CustomerCommentField. */
  customerCommentAdd: string
  /** landr-80ubl.1: LanguageStep's explanation copy (behind HelpDisclosure). */
  languageStepWhy: string
  languageStepHowTo: string
  /**
   * landr-80ubl.2: rollout A (catalog/product/date steps) NextAction cues
   * and HelpDisclosure copy. Picker steps with no real "how it works" to
   * explain (a tile grid, a calendar) get no HelpDisclosure — only the ones
   * with an actual gesture to teach (MultiDayPicker's tap/range modes).
   */
  categoryStepCue: string
  noCategoriesAvailable: string
  productListCue: string
  productDetailCue: string
  singleDatePickerCue: string
  multiDayPickerCue: string
  selectionModeAria: string
  dateRangeModeLabel: string
  individualDaysModeLabel: string
  diffAddedLabel: string
  diffRemovedLabel: string
  fixedDateWindowCue: string
  availabilityDateCue: string
  availabilityTimeCue: string

  // ---- landr-5aih0.9: shared/common chrome (reused across several steps) ----
  required: string
  requiredPickAtLeastTemplate: string
  enterValidEmail: string
  readyToContinue: string
  somethingWentWrong: string
  somethingWentWrongRetry: string
  couldNotLoadAvailability: string
  pickADate: string
  availableDaysFor: string
  sendingEllipsis: string
  loadingProducts: string
  couldNotLoadProducts: string
  noProductsInCategory: string
  checkBackLater: string
  priceOnRequest: string
  tryAgain: string
  backLabel: string
  bookingStepsAriaLabel: string

  // ---- StepBackButton / breadcrumb ----
  // (backLabel / bookingStepsAriaLabel above)

  // ---- AvailabilityPicker / SingleDatePicker ----
  noTimesAvailable: string
  anyTime: string
  timesOnTemplate: string
  seatSingular: string
  seatPlural: string
  selectedDateTemplate: string

  // ---- FixedDateWindowPicker / FixedDateWindowChips ----
  pickACourseWindow: string
  couldNotLoadCourseWindows: string
  loadingWindows: string
  noUpcomingWindows: string
  upcomingWindowsFor: string
  fullBadge: string
  tooLateToBook: string
  availableBadge: string
  seatLeftSingular: string
  seatsLeftPlural: string

  // ---- MultiDayStep ----
  pickYourDates: string
  yourDates: string
  loadingAvailabilityEllipsis: string
  changeYourDatesToContinue: string
  readyToContinueWithHostsDates: string
  continueWithTheseDates: string
  changeDates: string
  sameDaysAsHostFor: string
  hostDayUnavailableOne: string
  hostDaysUnavailableOther: string

  // ---- PickupLocationPicker ----
  pickupLocationTitle: string
  pickupLocationCue: string
  chooseWhereWePickYouUp: string
  loadingPickupLocations: string
  noPickupLocationsConfigured: string
  choosePickupLocationToContinue: string

  // ---- LanguageStep / ParticipantLanguageBoard ----
  guideLanguageTitle: string
  optionalSuffix: string
  unassignedOption: string
  roomFullSuffix: string
  languagesColon: string
  addLanguageColon: string
  guestSuffix: string
  guestBadgeLabel: string
  unassignedCountTemplate: string
  dropNamesHere: string
  assignWithDropdownsInstead: string
  languageDropdownPlaceholder: string
  assignToLanguageAriaTemplate: string
  everyoneSpeaksTemplate: string
  moveSelectedHereUnassign: string

  // ---- CustomFormStep ----
  selectPlaceholder: string
  noFormConfigForProduct: string
  formDefinitionNotFound: string
  couldNotLoadFormRetry: string
  additionalInformationTitle: string
  completeEveryRequiredField: string
  unsupportedFieldTypeTemplate: string
  productFormSubtitleTemplate: string
  loadingEllipsis: string

  // ---- CustomerCommentField ----
  customerCommentPlaceholder: string
  anythingWeShouldKnowLabel: string

  // ---- DetailsStep ----
  participantsTitle: string
  yourContactDetailsTitle: string
  requestLargerGroupLink: string
  addParticipantAria: string
  addCompanionAria: string
  addParticipantButton: string
  addGuestButton: string
  enterYourNameEmailPhoneCue: string
  fillInEveryRequiredField: string
  roleLabel: string
  includeYourCountryCode: string
  memberPerkOtpLabel: string
  maxAdditionalParticipantsTemplate: string
  needLargerGroupHint: string
  requestMoreButton: string
  needLargerGroupDialogDescription: string
  othersSharingYourRoom: string
  howAreTheyJoining: string
  companionKindGuestLabel: string
  companionKindSeparateGuidingLabel: string

  // ---- GroupInquiryForm ----
  enterValidGroupSize: string
  sendEnquiry: string
  groupInquiryPlaceholder: string
  groupSizeLabel: string
  messageLabel: string
  addYourNameAndEmailCue: string
  yourNameLabel: string
  closeLabel: string
  cancelLabel: string
  thanksWellBeInTouch: string
  couldNotSendMessage: string
  orEmailUs: string

  // ---- AccountLinkPrompt ----
  trackBookingTitle: string
  accountLinkBodyTemplate: string
  checkYourInboxTemplate: string
  couldNotSendLinkTemplate: string
  accountLinkOptionalNote: string
  noThanksContinueAsGuest: string
  yesSendMeALink: string
  magicLinkFailed: string

  // ---- AccommodationStep ----
  accommodationTitle: string
  hotelStayRequired: string
  addHotelStayOptional: string
  guidingOnlyLabel: string
  guidingOnlyHint: string
  bookAccommodationPackageLabel: string
  bookAccommodationPackageHint: string
  sharedDoubleLabel: string
  chooseYourHotel: string
  noHotelsConfigured: string
  roomsLegend: string
  additionalAccommodationLegend: string
  loadingRooms: string
  noRoomsConfigured: string
  perNightSuffix: string
  roomAssignmentLegend: string
  assignEveryoneToARoomCue: string
  stayNightsLabel: string
  hotelPaidAtCheckin: string
  completeStepsAboveToContinue: string
  checkingAccommodationAvailability: string
  howWouldYouLikeToHandleAccommodation: string
  sharedDoubleInviteNotice: string
  sharedDoubleNormalNotice: string
  travellingWithFamilyHint: string
  pleaseEnterChildAgeHint: string
  // ---- landr-5aih0.17: shared-double reference-lookup mini-flow,
  // occupancy-mismatch warning, "staying at" notice ----
  sharedDoubleReferenceInputLabel: string
  sharedDoubleReferenceLookingUp: string
  sharedDoubleReferenceNotFoundTemplate: string
  sharedDoubleReferenceFoundTemplate: string
  sharedDoubleReferenceConfirmYes: string
  sharedDoubleReferenceConfirmNo: string
  sharedDoubleReferenceLinkedTemplate: string
  sharedDoubleReferenceHelp: string
  additionalAccommodationOptionalHint: string
  sharedDoubleOthersTooLateTemplate: string
  stayingAtTemplate: string

  // ---- RoomAssignment ----
  whoStaysWhereTitle: string
  roomAssignmentHelp: string
  adultOption: string
  childOption: string
  ageBandAria: string
  childAgeAria: string
  agePlaceholder: string
  breakfastLabel: string
  emptyLabel: string
  swapInHereLabel: string
  placeHereLabel: string
  everyoneHasARoom: string
  addBreakfastButton: string
  giveBreakfastToTemplate: string

  // ---- BookingForm ----
  reviewYourBookingTitle: string
  hotelPrefix: string
  paidDirectlyToHotel: string
  yourContactHeading: string
  nameLabel: string
  emailLabel: string
  phoneLabel: string
  roomBreakfastHeading: string
  assignEveryParticipantToALanguage: string
  additionalAccommodationLabel: string
  additionalAccommodationForTemplate: string
  yourCompanionsAndCoPilots: string
  yourCoPilots: string
  yourCompanions: string
  othersJoiningReviewHeading: string
  breakfastIncludedLabel: string
  breakfastPartialLabel: string
  noBreakfastLabel: string
  withBreakfastLabel: string
  withoutBreakfastLabel: string
  otherParticipantsTotalTemplate: string
  addAnyoneElseUpToTemplate: string
  participantOrdinalTemplate: string
  companionOrdinalTemplate: string
  maxCompanionsReachedTemplate: string
  companionInviteHint: string
  companionContactRequiredTemplate: string
  themFallback: string
  youWillBeListedAsParticipant1: string
  notAMemberOrNoCode: string
  companionsShareAccommodationExplainer: string
  guestFallbackTemplate: string
  readyToConfirm: string
  submittingYourBookingEllipsis: string
  sharedDoubleOwnBedNote: string
  joiningActivitySeparateGuiding: string
  notDoingActivity: string
  submittingEllipsis: string
  confirmBookingLabel: string

  // ---- Confirmation ----
  yourBookingTitle: string
  priceBreakdownTitle: string
  atHotelPayAtCheckin: string
  referenceLabel: string
  addToGoogleCalendarAria: string
  addToOutlookCalendarAria: string
  copyLinkLabel: string
  copyLabel: string
  copiedLabel: string
  couldNotCopyAutomatically: string
  shareReferenceHint: string
  retryEmailLabel: string
  emailLabelShort: string
  bookingCreated: string
  bookingConfirmed: string
  bookingReceived: string
  confirmationEmailFailed: string
  confirmationEmailSent: string
  confirmationEmailPending: string
  downloadIcsButton: string
  makeAnotherBookingLink: string
  bookingConfirmedInboxNote: string
  paymentLinkOnItsWay: string
  // landr-k9pji.5 — payment_mode-aware confirmation copy (API landr-k9pji.4
  // PR #848). paymentLinkOnItsWay above stays as the fallback for an older
  // API deploy that predates response.payment_mode.
  payOnSiteNote: string
  bankTransferNote: string
  paymentLinkForDepositOnItsWay: string
  awaitingOperatorConfirmation: string
  participantCountSingular: string
  participantCountPlural: string
  pickupPrefix: string
  savingsConsecutiveTemplate: string
  savingsNonConsecutiveTemplate: string
  /**
   * landr-5aih0.2: meeting-point block (address + map deep links) under the
   * pickup line — aria-labels only, same pattern as
   * addToGoogleCalendarAria/addToOutlookCalendarAria above. The visible
   * button text ("Google Maps"/"Waze") stays an untranslated brand name
   * (see noEnglishLiteral.test.ts's ALLOWED_LITERALS for Confirmation.tsx).
   */
  meetingPointOpenInGoogleMapsAria: string
  meetingPointOpenInWazeAria: string
  // ---- landr-5aih0.17: invite/group cards, join flow, status line ----
  bookedRefTemplate: string
  sendBookingLinkToTemplate: string
  inviteEmailSentLabel: string
  emailUnavailableNotice: string
  groupBookedTogetherWith: string
  bookedTogetherMemberTemplate: string
  hostSuffixLabel: string
  sharedDoubleHintQuestion: string
  addReferenceLinkLabel: string
  joinErrorUnknownReference: string
  joinErrorSameBooking: string
  joinErrorJoinFailed: string
  joinErrorFollowup: string
  bookingConfirmedEmailFailed: string
  contactOperatorToConfirm: string
  nextStepSendGroupLinkSingular: string
  nextStepSendGroupLinkPlural: string
  eachCompletesOwnBooking: string
  linkCannotBeEmailed: string
  emailAddressRejected: string
  tooManyEmailsRetry: string
  couldNotSendEmailGeneric: string

  // CancelPage (landr-5aih0.7) speaks the booking EMAIL's language from its
  // own page-scoped bundle, src/components/booking/cancelStrings.ts — same
  // pattern as ApprovalReplyPage — so it has no keys here.

  // ---- OfferPage ----
  confirmingYourPayment: string
  usuallyTakesAFewSeconds: string
  pleaseWaitConfirmingPayment: string
  paymentComplete: string
  yourBookingIsConfirmed: string
  paymentCompleteBody: string
  stillConfirmingYourPayment: string
  takingLongerThanUsual: string
  paymentPendingBody: string
  couldNotCheckPaymentStatusTitle: string
  paymentUnknownBody: string
  paymentCancelledTitle: string
  yourBookingHasNotBeenCharged: string
  paymentCancelledBody: string
  paymentLinkNotFoundTitle: string
  offerNotFoundTitle: string
  offerLinkInvalidBody: string
  paymentFailedToStartTitle: string
  loadingYourOffer: string
  pleaseWait: string
  completeYourPayment: string
  yourCustomOffer: string
  payModeDescription: string
  offerModeDescription: string
  statusLabel: string
  whatYoureBooking: string
  productsAria: string
  offerParticipantsTitle: string
  offerPriceBreakdownTitle: string
  offerSubtotalLabel: string
  taxLabel: string
  amountDueLabel: string
  nothingDueNow: string
  // landr-k9pji.5 — deposit_percent operators (API landr-k9pji.4): shown
  // once POST /initiate reports an `amount` below the full balance.
  depositLabelTemplate: string
  depositRemainderNote: string
  continueToStripeLabel: string
  yourShareOfThisBooking: string
  totalBookingValueLabel: string
  offerTotalLabel: string
  amountDueNowLabel: string
  totalBookingValueNote: string
  payableDirectlyToHotel: string
  hotelSettledAtCheckin: string
  nothingToPay: string
  redirectingToPaymentEllipsis: string
  payNowLabel: string
  acceptAndPayLabel: string
  nothingFurtherToPay: string
  paymentLinkPersonal: string
  offerLinkPersonal: string
  couldNotStartPayment: string

  // ---- MembershipCheckoutStep / MembershipReturnPage ----
  becomeAMember: string
  backToProductsLabel: string
  membershipRedirectHelp: string
  enterYourEmailCue: string
  yourNameThing: string
  firstNameLabel: string
  lastNameLabel: string
  becomeAMemberCue: string
  membershipUnavailableTitle: string
  membershipUnavailableBody: string
  tooManyAttemptsTitle: string
  tooManyAttemptsBody: string
  membershipGenericErrorBody: string
  redirectingToPaymentDots: string
  onYourWayToMembershipTitle: string
  membershipBeingActivated: string
  checkoutCancelledTitle: string
  membershipNotCharged: string
  membershipCancelledBody: string
  continueBrowsing: string
  membershipActivatingBody: string

  // ---- ServiceAddonsStep / AddonsList ----
  addonsTitle: string
  loadingAddons: string
  noAddonsAvailable: string
  pickRequiredAddonsCue: string
  pickRequiredAddonsToContinue: string
  requiredSuffix: string
  eachSuffix: string
  overbookManyRoomsTemplate: string
  overbookOneRoomTemplate: string
  underbookManyRoomsTemplate: string
  underbookOneRoomTemplate: string

  // ---- FullyBookedNotice / ViewToggle / catalog ----
  fullyBookedLabel: string
  fullyBookedBlurb: string
  gridViewLabel: string
  listViewLabel: string
  catalogueLayoutAria: string
  offerCountOne: string
  offerCountOther: string

  // ---- detail/ProductFacts / ProductGallery ----
  productDetailsAria: string
  productImageThumbnailsAria: string
  showImageAria: string
  hotelIncluded: string
  hotelOptional: string
  pickupAvailable: string
  offeredInPrefix: string
  backLinkArrow: string
  bookNow: string
  tickEveryLanguageHelp: string
  draftPreviewBadge: string
  shopComingSoonBodyTemplate: string
  landingPageTitle: string

  // ---- priceSidebarHelpers: discount explanation lines ----
  perDaySuffix: string
  daySingular: string
  dayPlural: string
  consecutiveDayPlural: string
  savesVsStandardRate: string
  participantSuffixSingular: string
  participantSuffixPlural: string
  multiDayDiscountLabel: string
  streakDiscountLabel: string
  voucherAppliedLabel: string

  // ---- PriceSidebar ----
  calculatingEllipsis: string
  couldNotFetchPrice: string
  pickYourOptionsToSeePrice: string
  bookingOverviewTitle: string
  updatePriceTitle: string
  grandTotalLabel: string
  forNamesTemplate: string
  forNamesOtherSingularTemplate: string
  forNamesOtherPluralTemplate: string
  youPayNowHeading: string
  atHotelTotalPayAtCheckin: string
  hotelSpanTemplate: string
  nightSingular: string
  nightPlural: string
  updatingEllipsis: string
  payableDirectlyToHotelCaveat: string
  multiDayRateAppliedHeading: string
  tapToExpand: string
  tapToCollapse: string
  atHotelSuffix: string
  qtyTimesDayTemplate: string

  // ---- landr-5aih0.27: JSX-attribute template-literal strings (AddonsList,
  // AccommodationStep, RoomAssignment, ParticipantLanguageBoard,
  // RankedLanguagePicker, DetailsStep) ----
  decreaseQtyAriaTemplate: string
  increaseQtyAriaTemplate: string
  ownerHasBreakfastTemplate: string
  breakfastDragHintTemplate: string
  roomUnitAriaTemplate: string
  assignToRoomTemplate: string
  languageSpeakersTemplate: string
  removeLanguageTemplate: string
  reorderLanguageTemplate: string
  removeParticipantAriaTemplate: string
  removeCompanionAriaTemplate: string
  useYourEmailAria: string
  useYourPhoneAria: string
}

const en: Bundle = {
  // landr-4xyd: Shift/Cmd/Ctrl wording removed; mode toggle in the picker
  // now drives help text. This string is kept for callers that pass it as
  // a helpText override; MultiDayStep no longer passes it (passes undefined).
  multiDayPickerHelp: 'Tap days to add or remove them.',
  multiDayPickerHelpRange: 'Tap a start date, then tap another to span the days between.',
  multiDayPickerHelpContiguous:
    'Click a start date, then click another to extend the range. Selection must be consecutive days.',
  customerCommentHint:
    'If you add a comment, a person will read your request before it is ' +
    'confirmed, so it can take a little longer. If it matters, please do ' +
    'tell us.',
  nextActionPrefix: 'Next:',
  helpDisclosureLabel: 'How this works',
  continueCue: 'continue',
  continueLabel: 'Continue',
  customerCommentAdd: 'a note for us',
  languageStepWhy:
    'Tell us who speaks what, so the guide briefs everyone in a language ' +
    'they understand.',
  languageStepHowTo:
    'Tap a language to put everyone in it. To split the group, drag a name ' +
    'onto another language — or tap a name and then tap a language.',
  categoryStepCue: 'choose a category',
  noCategoriesAvailable: 'No categories are available right now.',
  productListCue: 'choose a product',
  productDetailCue: 'book this trip',
  // landr-80ubl.2: deliberately NOT "pick a date" / "pick your dates" — the
  // NextAction cue's text ("Next: <cue>") sits right beside the step's own
  // CardTitle ("Pick a date" / "Pick your dates"), and App.test.tsx's
  // step-arrival assertions do screen.getByText(/Pick a date/i) etc., which
  // matches ANY element whose text contains that phrase. A cue that repeats
  // the heading makes getByText ambiguous (two matches) and times out the
  // whole flow-advancing helper. Distinct verbs sidestep it.
  singleDatePickerCue: 'choose a date',
  multiDayPickerCue: 'choose your dates',
  selectionModeAria: 'Selection mode',
  dateRangeModeLabel: 'Date range',
  individualDaysModeLabel: 'Individual days',
  diffAddedLabel: 'Added',
  diffRemovedLabel: 'Removed',
  fixedDateWindowCue: 'choose a window',
  availabilityDateCue: 'choose a date',
  availabilityTimeCue: 'choose a time',

  required: 'Required',
  requiredPickAtLeastTemplate: 'Required — pick at least {n}',
  enterValidEmail: 'Enter a valid email address',
  readyToContinue: 'Ready to continue.',
  somethingWentWrong: 'Something went wrong.',
  somethingWentWrongRetry: 'Something went wrong. Please try again later.',
  couldNotLoadAvailability: 'Could not load availability.',
  pickADate: 'Pick a date',
  availableDaysFor: 'Available days for {name}.',
  sendingEllipsis: 'Sending…',
  loadingProducts: 'Loading products…',
  couldNotLoadProducts: 'We could not load the products.',
  noProductsInCategory: 'No products in this category.',
  checkBackLater: 'Please check back later.',
  priceOnRequest: 'Price on request',
  tryAgain: 'Try again',
  backLabel: 'Back',
  bookingStepsAriaLabel: 'Booking steps',

  noTimesAvailable: 'No times available.',
  anyTime: 'Any time',
  timesOnTemplate: 'Times on {date}',
  seatSingular: 'seat',
  seatPlural: 'seats',
  selectedDateTemplate: 'Selected: {date}',

  pickACourseWindow: 'Pick a course window',
  couldNotLoadCourseWindows: 'Could not load course windows.',
  loadingWindows: 'Loading windows…',
  noUpcomingWindows: 'No upcoming windows for this course. Please check back later.',
  upcomingWindowsFor: 'Upcoming {name} windows. Pick one to continue.',
  fullBadge: 'Full',
  tooLateToBook: 'Too late to book',
  availableBadge: 'Available',
  seatLeftSingular: '{n} seat left',
  seatsLeftPlural: '{n} seats left',

  pickYourDates: 'Pick your dates',
  yourDates: 'Your dates',
  loadingAvailabilityEllipsis: 'Loading availability…',
  changeYourDatesToContinue: 'Change your dates to continue.',
  readyToContinueWithHostsDates: "Ready to continue with the host's dates.",
  continueWithTheseDates: 'Continue with these dates',
  changeDates: 'Change dates',
  sameDaysAsHostFor: 'The same days as {host} for {product}.',
  hostDayUnavailableOne:
    "1 of {host}'s days is no longer available — change your dates to continue.",
  hostDaysUnavailableOther:
    "{n} of {host}'s days are no longer available — change your dates to continue.",

  pickupLocationTitle: 'Pickup location',
  pickupLocationCue: 'choose your pickup location',
  chooseWhereWePickYouUp: 'Choose where we pick you up',
  loadingPickupLocations: 'Loading pickup locations…',
  noPickupLocationsConfigured: 'No pickup locations configured — contact operator',
  choosePickupLocationToContinue: 'Choose a pickup location to continue.',

  guideLanguageTitle: 'Guide language',
  optionalSuffix: '(optional)',
  unassignedOption: 'Unassigned',
  roomFullSuffix: ' (full)',
  languagesColon: 'Languages:',
  addLanguageColon: 'Add language:',
  guestSuffix: '(guest)',
  guestBadgeLabel: 'guest',
  unassignedCountTemplate: 'Unassigned ({n})',
  dropNamesHere: 'Drop names here',
  assignWithDropdownsInstead: 'Assign with dropdowns instead',
  languageDropdownPlaceholder: '→ language…',
  assignToLanguageAriaTemplate: 'Assign {name} to a language',
  everyoneSpeaksTemplate: 'Everyone speaks {language}',
  moveSelectedHereUnassign: 'Move selected here (unassign)',

  selectPlaceholder: '— select —',
  noFormConfigForProduct: 'No form configuration found for this product.',
  formDefinitionNotFound: 'Form definition not found.',
  couldNotLoadFormRetry: 'Could not load the form. Please go back and try again.',
  additionalInformationTitle: 'Additional information',
  completeEveryRequiredField: 'Complete every required field to continue.',
  unsupportedFieldTypeTemplate: '(Unsupported field type: {type})',
  productFormSubtitleTemplate: '{product} · please complete the form below',
  loadingEllipsis: 'Loading…',

  customerCommentPlaceholder:
    'e.g. a dietary need, an accessibility request, a special occasion…',
  anythingWeShouldKnowLabel: 'Anything we should know? (optional)',

  participantsTitle: 'Participants',
  yourContactDetailsTitle: 'Your contact details',
  requestLargerGroupLink: 'Request a larger group',
  addParticipantAria: 'Add participant',
  addCompanionAria: 'Add companion',
  addParticipantButton: '+ Add participant',
  addGuestButton: '+ Add guest',
  enterYourNameEmailPhoneCue: 'enter your name, email and phone',
  fillInEveryRequiredField: 'Fill in every required field to continue.',
  roleLabel: 'Role',
  includeYourCountryCode: 'Include your country code',
  memberPerkOtpLabel: 'Member? Enter the 6-digit code we emailed you to apply your member price.',
  maxAdditionalParticipantsTemplate: 'Maximum of {n} additional participants reached',
  needLargerGroupHint: 'Need a larger group or a custom booking?',
  requestMoreButton: 'Request more',
  needLargerGroupDialogDescription:
    "Need a larger group or a custom booking? Send us the details and we'll be in touch.",
  othersSharingYourRoom: 'Others sharing your room',
  howAreTheyJoining: 'How are they joining?',
  companionKindGuestLabel: 'Not doing the activity (partner / child / friend)',
  companionKindSeparateGuidingLabel: 'Joining the activity — booking their own guiding separately',

  enterValidGroupSize: 'Enter a valid group size',
  sendEnquiry: 'Send enquiry',
  groupInquiryPlaceholder: 'Tell us about your group, preferred dates, and any questions…',
  groupSizeLabel: 'Group size',
  messageLabel: 'Message',
  addYourNameAndEmailCue: 'add your name and email',
  yourNameLabel: 'Your name',
  closeLabel: 'Close',
  cancelLabel: 'Cancel',
  thanksWellBeInTouch: "Thanks — we'll be in touch!",
  couldNotSendMessage: "Couldn't send your message. Please get in touch",
  orEmailUs: 'Or email us',

  trackBookingTitle: 'Track this booking in the LANDR app',
  accountLinkBodyTemplate:
    'Link {email} to a LANDR account so you can see your booking, get updates, and manage cancellations from your phone.',
  checkYourInboxTemplate: 'Check your inbox — we sent a sign-in link to {email}.',
  couldNotSendLinkTemplate: "Couldn't send the link: {message}. Your booking is still confirmed.",
  accountLinkOptionalNote: 'Optional — your booking is already confirmed either way.',
  noThanksContinueAsGuest: 'No thanks, continue as guest',
  yesSendMeALink: 'Yes, send me a link',
  magicLinkFailed: 'Your booking is still confirmed.',

  accommodationTitle: 'Accommodation',
  hotelStayRequired: 'Hotel stay required',
  addHotelStayOptional: 'Add a hotel stay (optional)',
  guidingOnlyLabel: 'Guiding only — I bring my own accommodation',
  guidingOnlyHint: 'No hotel booked through us — straight to pickup.',
  bookAccommodationPackageLabel: 'Book accommodation (package)',
  bookAccommodationPackageHint: 'Pick a hotel and rooms for your stay.',
  sharedDoubleLabel: 'I am sharing a double room booked by someone else',
  chooseYourHotel: 'Choose your hotel',
  noHotelsConfigured: 'No hotels configured for this operator yet.',
  roomsLegend: 'Rooms',
  additionalAccommodationLegend: 'Additional accommodation',
  loadingRooms: 'Loading rooms…',
  noRoomsConfigured: 'No rooms configured for this hotel yet.',
  perNightSuffix: '/ night',
  roomAssignmentLegend: 'Room assignment',
  assignEveryoneToARoomCue: 'assign everyone to a room',
  stayNightsLabel: 'Stay',
  hotelPaidAtCheckin:
    'Hotel is paid directly at check-in (cash / card) — not included in your booking total.',
  completeStepsAboveToContinue: 'Complete the steps above to continue.',
  checkingAccommodationAvailability: 'Checking accommodation availability for this date…',
  howWouldYouLikeToHandleAccommodation: 'How would you like to handle accommodation?',
  sharedDoubleInviteNotice:
    'Your own room is already booked — you are sharing the double room of the person who invited you, and you will be collected from the hotel.',
  sharedDoubleNormalNotice:
    'You are sharing a double room with another guest. No room is booked for you — the other guest holds the room — and you will be collected from the hotel.',
  travellingWithFamilyHint:
    'Travelling with family or friends? Add them as companions in the previous step and you can book additional rooms for them here.',
  pleaseEnterChildAgeHint:
    'Please enter the age for each child guest — the hotel needs it to prepare the room.',
  sharedDoubleReferenceInputLabel: 'Booking reference of the person who booked the room',
  sharedDoubleReferenceLookingUp: 'Looking that up…',
  sharedDoubleReferenceNotFoundTemplate:
    "We couldn't find that reference for this operator — double-check it, or just leave it blank and add it later.",
  sharedDoubleReferenceFoundTemplate: 'Booking of {name} from {date} — is that them?',
  sharedDoubleReferenceConfirmYes: 'Yes, link us',
  sharedDoubleReferenceConfirmNo: 'No',
  sharedDoubleReferenceLinkedTemplate: "Linked to {name}'s booking.",
  sharedDoubleReferenceHelp:
    "It's nice if you have the code, totally fine if not — you can add it later from your booking page. " +
    'Easiest is to ask the person who booked for their invite link, then everything is prefilled.',
  additionalAccommodationOptionalHint:
    'Optional — rooms for the people travelling with you. Your own bed is already covered by the shared double room.',
  sharedDoubleOthersTooLateTemplate:
    "Only you share the host's room; it's too late to book rooms for other pilots ({names}) — remove them or contact the operator.",
  stayingAtTemplate: 'Staying at {hotel}.',

  whoStaysWhereTitle: 'Who stays where?',
  roomAssignmentHelp:
    'Drag a name onto a room, or tap a name then tap a room. You can also ' +
    'use the dropdown on each name. When a room has fewer breakfasts than ' +
    'guests, drag the Breakfast chip onto whoever gets it.',
  adultOption: 'Adult',
  childOption: 'Child',
  ageBandAria: 'Age band',
  childAgeAria: 'Child age',
  agePlaceholder: 'Age',
  breakfastLabel: 'Breakfast',
  emptyLabel: 'Empty',
  swapInHereLabel: 'Swap in here',
  placeHereLabel: 'Place here',
  everyoneHasARoom: 'Everyone has a room.',
  addBreakfastButton: '+ breakfast',
  giveBreakfastToTemplate: 'Give breakfast to {name}',

  reviewYourBookingTitle: 'Review your booking',
  hotelPrefix: 'Hotel:',
  paidDirectlyToHotel: 'Paid directly to hotel — not included in your booking total.',
  yourContactHeading: 'Your contact',
  nameLabel: 'Name',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  roomBreakfastHeading: 'Room breakfast',
  assignEveryParticipantToALanguage: 'Assign every participant to a language.',
  additionalAccommodationLabel: 'Additional accommodation',
  additionalAccommodationForTemplate: 'Additional accommodation (for {who})',
  yourCompanionsAndCoPilots: 'your companions and co-pilots',
  yourCoPilots: 'your co-pilots',
  yourCompanions: 'your companions',
  othersJoiningReviewHeading: 'Others joining',
  breakfastIncludedLabel: 'breakfast included',
  breakfastPartialLabel: 'breakfast for some guests only',
  noBreakfastLabel: 'no breakfast',
  withBreakfastLabel: 'with breakfast',
  withoutBreakfastLabel: 'without breakfast',
  otherParticipantsTotalTemplate: 'Other participants ({n} total)',
  addAnyoneElseUpToTemplate: 'Add anyone else taking part. You can add up to {n} more.',
  participantOrdinalTemplate: 'Participant {n}',
  companionOrdinalTemplate: 'Guest {n}',
  maxCompanionsReachedTemplate: 'Maximum of {n} guests reached',
  companionInviteHint: "We'll use this to send them their own booking link.",
  companionContactRequiredTemplate: 'We need an email or phone number to send {name} their booking link',
  themFallback: 'them',
  youWillBeListedAsParticipant1:
    "You'll be listed as participant 1. Add more people below if others are joining.",
  notAMemberOrNoCode:
    "Not a member, or don't have a code? Leave this blank — it won't affect your booking.",
  companionsShareAccommodationExplainer:
    'Anyone else sharing your accommodation — partners, friends, family members, or fellow activity ' +
    "participants who book and pay for their own guiding separately. They're added to the hotel headcount " +
    "and room assignment, but not to this booking's activity or price.",
  guestFallbackTemplate: 'Guest {n}',
  readyToConfirm: 'Ready to confirm.',
  submittingYourBookingEllipsis: 'Submitting your booking…',
  sharedDoubleOwnBedNote: 'Your own bed is the shared double room booked by the host.',
  joiningActivitySeparateGuiding: 'joining the activity (separate guiding)',
  notDoingActivity: 'not doing the activity',
  submittingEllipsis: 'Submitting…',
  confirmBookingLabel: 'Confirm booking',

  yourBookingTitle: 'Your booking',
  priceBreakdownTitle: 'Price breakdown',
  atHotelPayAtCheckin: 'At hotel · pay at check-in',
  referenceLabel: 'Reference',
  addToGoogleCalendarAria: 'Add to Google Calendar',
  addToOutlookCalendarAria: 'Add to Outlook Calendar',
  copyLinkLabel: 'Copy link',
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  couldNotCopyAutomatically: "Couldn't copy automatically — select and copy:",
  shareReferenceHint: 'Share this with anyone booking their own guiding who wants to be grouped with you.',
  retryEmailLabel: 'Retry email',
  emailLabelShort: 'Email',
  bookingCreated: 'Booking created',
  bookingConfirmed: 'Booking confirmed',
  bookingReceived: 'Booking received',
  confirmationEmailFailed:
    'We received your booking request, but we could not send the confirmation email.',
  confirmationEmailSent: 'A confirmation email has been sent with your booking details.',
  confirmationEmailPending: 'You will receive a confirmation email shortly with the next steps.',
  downloadIcsButton: 'Download .ics',
  makeAnotherBookingLink: 'Make another booking',
  bookingConfirmedInboxNote: 'Your booking is confirmed — the details are in your inbox.',
  paymentLinkOnItsWay: 'A payment link is on its way.',
  payOnSiteNote: 'Please pay on the day, at the meeting point.',
  bankTransferNote: 'Bank details are in your confirmation email.',
  paymentLinkForDepositOnItsWay: 'A payment link for your deposit is on its way.',
  awaitingOperatorConfirmation: 'Your booking is awaiting confirmation from the operator.',
  participantCountSingular: '{n} participant',
  participantCountPlural: '{n} participants',
  pickupPrefix: 'Pickup:',
  savingsConsecutiveTemplate: '{days} {dayWord} in a row — you saved {amount}!',
  savingsNonConsecutiveTemplate: 'You saved {amount} by booking {days} {dayWord}!',
  meetingPointOpenInGoogleMapsAria: 'Open in Google Maps',
  meetingPointOpenInWazeAria: 'Open in Waze',
  bookedRefTemplate: 'Booked ✓ (ref {ref})',
  sendBookingLinkToTemplate: 'Send booking link to {name}',
  inviteEmailSentLabel: 'Sent ✓',
  emailUnavailableNotice: 'Email sending unavailable — copy the link instead.',
  groupBookedTogetherWith: 'Booked together with',
  bookedTogetherMemberTemplate: '{name} (ref {ref})',
  hostSuffixLabel: ' — host',
  sharedDoubleHintQuestion: 'Sharing a room booked by someone else?',
  addReferenceLinkLabel: 'Add their reference on your booking page',
  joinErrorUnknownReference:
    "We couldn't find a booking with that reference, so your booking wasn't linked to theirs.",
  joinErrorSameBooking: 'That reference points to your own booking, so there was nothing to link.',
  joinErrorJoinFailed: "We couldn't link your booking to that reference right now.",
  joinErrorFollowup:
    'Your booking itself is confirmed as usual — you can still add the reference later on your booking page.',
  bookingConfirmedEmailFailed: 'Your booking is confirmed — but we could not send the confirmation email.',
  contactOperatorToConfirm: 'Please contact the operator directly to confirm your booking details.',
  nextStepSendGroupLinkSingular: 'Next step: send your group their booking link',
  nextStepSendGroupLinkPlural: 'Next step: send your group their booking links',
  eachCompletesOwnBooking: 'Each of them completes their own booking from their link.',
  linkCannotBeEmailed: "This link can't be emailed from here any more — copy it instead.",
  emailAddressRejected: 'That email address was rejected.',
  tooManyEmailsRetry: 'Too many emails right now — try again in a few minutes.',
  couldNotSendEmailGeneric:
    'Could not send that email — please try again, or use WhatsApp / copy the link instead.',

  confirmingYourPayment: 'Confirming your payment…',
  usuallyTakesAFewSeconds: 'This usually takes a few seconds.',
  pleaseWaitConfirmingPayment: 'Please wait while we confirm your payment with our records.',
  paymentComplete: 'Payment complete',
  yourBookingIsConfirmed: 'Your booking is confirmed.',
  paymentCompleteBody:
    'Thank you! We have received your payment and your booking is confirmed. ' +
    'You will receive a confirmation email shortly.',
  stillConfirmingYourPayment: 'Still confirming your payment',
  takingLongerThanUsual: 'This is taking longer than usual.',
  paymentPendingBody:
    'We have not been able to confirm your payment yet. This does not ' +
    'necessarily mean anything is wrong — we will email you a confirmation ' +
    'as soon as it is processed. If you do not hear from us shortly, please ' +
    'contact us.',
  couldNotCheckPaymentStatusTitle: 'We could not check your payment status',
  paymentUnknownBody:
    'We were unable to reach our records just now. If your payment ' +
    'succeeded, you will receive a confirmation email shortly. If you are ' +
    'not sure, please contact us.',
  paymentCancelledTitle: 'Payment cancelled',
  yourBookingHasNotBeenCharged: 'Your booking has not been charged.',
  paymentCancelledBody:
    'You left the payment page without completing payment. Your booking is ' +
    'still reserved — click below to try again.',
  paymentLinkNotFoundTitle: 'Payment link not found',
  offerNotFoundTitle: 'Offer not found',
  offerLinkInvalidBody:
    'This offer link is invalid or has expired. Please contact the operator for a fresh link.',
  paymentFailedToStartTitle: 'Payment failed to start',
  loadingYourOffer: 'Loading your offer…',
  pleaseWait: 'Please wait.',
  completeYourPayment: 'Complete your payment',
  yourCustomOffer: 'Your custom offer',
  payModeDescription: 'Your booking is confirmed. Pay the outstanding balance below to secure it.',
  offerModeDescription: 'Review the details below and click Accept & Pay to confirm your booking.',
  statusLabel: 'Status:',
  whatYoureBooking: "What you're booking",
  productsAria: 'Products',
  offerParticipantsTitle: 'Participants',
  offerPriceBreakdownTitle: 'Price breakdown',
  offerSubtotalLabel: 'Subtotal',
  taxLabel: 'Tax',
  amountDueLabel: 'Amount due',
  nothingDueNow: 'Nothing due now',
  depositLabelTemplate: 'Deposit ({n} %)',
  depositRemainderNote: 'The rest is due later.',
  continueToStripeLabel: 'Continue to payment',
  yourShareOfThisBooking: 'Your share of this booking',
  totalBookingValueLabel: 'Total booking value',
  offerTotalLabel: 'Total',
  amountDueNowLabel: 'Amount due now',
  totalBookingValueNote: 'This is the full value of the booking — not the amount being charged now.',
  payableDirectlyToHotel: 'Payable directly to the hotel on arrival',
  hotelSettledAtCheckin:
    'Your accommodation is settled with the hotel at check-in. It is not part of the amount charged here.',
  nothingToPay: 'Nothing to pay',
  redirectingToPaymentEllipsis: 'Redirecting to payment…',
  payNowLabel: 'Pay now',
  acceptAndPayLabel: 'Accept & Pay',
  nothingFurtherToPay: "There's nothing further to pay through this link right now.",
  paymentLinkPersonal: 'This payment link is personal. Do not share it.',
  offerLinkPersonal: 'This offer link is personal. Do not share it.',
  couldNotStartPayment: 'We could not start the payment. Please try again or contact us.',

  becomeAMember: 'Become a member',
  backToProductsLabel: 'Back to products',
  membershipRedirectHelp:
    "You'll be redirected to our secure payment provider to complete your membership.",
  enterYourEmailCue: 'enter your email',
  yourNameThing: 'your name',
  firstNameLabel: 'First name',
  lastNameLabel: 'Last name',
  becomeAMemberCue: 'become a member',
  membershipUnavailableTitle: 'Membership unavailable',
  membershipUnavailableBody:
    'This membership option is not available right now. Please contact the operator directly.',
  tooManyAttemptsTitle: 'Too many attempts',
  tooManyAttemptsBody: 'Please wait a few minutes and try again.',
  membershipGenericErrorBody: 'We could not start checkout. Please try again or contact the operator.',
  redirectingToPaymentDots: 'Redirecting to payment…',
  onYourWayToMembershipTitle: "You're on your way to becoming a member",
  membershipBeingActivated: 'Your membership is being activated.',
  checkoutCancelledTitle: 'Checkout cancelled',
  membershipNotCharged: 'You have not been charged.',
  membershipCancelledBody:
    'You left checkout without completing your membership. No payment was taken — you can try again any time.',
  continueBrowsing: 'Continue browsing',
  membershipActivatingBody:
    "Thank you! We received your payment and your membership is being set up now. You'll get a confirmation email as soon as it's active — this is usually quick, but please don't refresh this page waiting for it to change.",

  addonsTitle: 'Add-ons',
  loadingAddons: 'Loading add-ons…',
  noAddonsAvailable: 'No add-ons available for this option.',
  pickRequiredAddonsCue: 'pick your required add-ons',
  pickRequiredAddonsToContinue: 'Pick every required add-on to continue.',
  requiredSuffix: 'required',
  eachSuffix: 'each',
  overbookManyRoomsTemplate: 'More {addon} ({qty}) than these {roomQty} rooms sleep ({expected}) — bringing extras?',
  overbookOneRoomTemplate: 'More {addon} ({qty}) than this room sleeps ({expected}) — bringing extras?',
  underbookManyRoomsTemplate: 'Only {qty} {addon} for {roomQty} rooms ({expected} guests) — one per room?',
  underbookOneRoomTemplate: 'Only {qty} {addon} for a room that sleeps {expected} — one per guest?',

  fullyBookedLabel: 'Fully booked',
  fullyBookedBlurb: 'There are no upcoming dates available for this product right now. Please check back later.',
  gridViewLabel: 'Grid view',
  listViewLabel: 'List view',
  catalogueLayoutAria: 'Catalogue layout',
  offerCountOne: 'offer',
  offerCountOther: 'offers',

  productDetailsAria: 'Product details',
  productImageThumbnailsAria: 'Product image thumbnails',
  showImageAria: 'Show image {name}',
  hotelIncluded: 'Hotel included',
  hotelOptional: 'Hotel optional',
  pickupAvailable: 'Pickup available',
  offeredInPrefix: 'Offered in',
  backLinkArrow: '← Back',
  bookNow: 'Book now',
  tickEveryLanguageHelp: 'Tick every language you speak, and drag your preferred one to the top.',
  draftPreviewBadge: 'Draft — preview',
  shopComingSoonBodyTemplate:
    'This {kind} is sold in our Shop, which is coming soon. Please contact the operator directly to order it in the meantime.',
  landingPageTitle: 'This is the booking-widget host for Landr',

  perDaySuffix: '/day',
  daySingular: 'day',
  dayPlural: 'days',
  consecutiveDayPlural: 'consecutive days',
  savesVsStandardRate: 'saves {amount} vs standard rate',
  participantSuffixSingular: '× {n} participant',
  participantSuffixPlural: '× {n} participants',
  multiDayDiscountLabel: 'Multi-day discount',
  streakDiscountLabel: 'Streak discount',
  voucherAppliedLabel: 'Voucher applied',

  calculatingEllipsis: 'Calculating…',
  couldNotFetchPrice: "Couldn't fetch price — your final total will be shown at confirmation.",
  pickYourOptionsToSeePrice: 'Pick your options to see the price.',
  bookingOverviewTitle: 'Booking overview',
  updatePriceTitle: 'Update price',
  grandTotalLabel: 'Grand total',
  forNamesTemplate: 'For {names}',
  forNamesOtherSingularTemplate: 'For {names} + {n} other',
  forNamesOtherPluralTemplate: 'For {names} + {n} others',
  youPayNowHeading: 'You pay now',
  atHotelTotalPayAtCheckin: 'At-hotel total · pay at check-in',
  hotelSpanTemplate: 'Hotel: {from} → {to}, {nights} {nightWord}',
  nightSingular: 'night',
  nightPlural: 'nights',
  updatingEllipsis: 'Updating…',
  payableDirectlyToHotelCaveat: 'Paid directly to the hotel at check-in. Not included in your booking total.',
  multiDayRateAppliedHeading: 'Multi-day rate applied',
  tapToExpand: 'Tap to expand',
  tapToCollapse: 'Tap to collapse',
  atHotelSuffix: 'at hotel',
  qtyTimesDayTemplate: '{qty} × {units} {unitWord}',

  // ---- landr-5aih0.27 ----
  decreaseQtyAriaTemplate: 'Decrease {item} quantity',
  increaseQtyAriaTemplate: 'Increase {item} quantity',
  ownerHasBreakfastTemplate: '{owner} has breakfast',
  breakfastDragHintTemplate: "{owner}'s breakfast — drag onto another guest to move it",
  roomUnitAriaTemplate: '{room} — unit {n}',
  assignToRoomTemplate: 'Assign {name} to a room',
  languageSpeakersTemplate: '{language} speakers',
  removeLanguageTemplate: 'Remove {language}',
  reorderLanguageTemplate: 'Reorder {language}',
  removeParticipantAriaTemplate: 'Remove participant {n}',
  removeCompanionAriaTemplate: 'Remove companion {n}',
  useYourEmailAria: 'Use your email',
  useYourPhoneAria: 'Use your phone',
}

const de: Bundle = {
  multiDayPickerHelp: 'Tippen Sie auf Tage, um sie hinzuzufügen oder zu entfernen.',
  multiDayPickerHelpRange:
    'Tippen Sie auf ein Startdatum und dann auf ein weiteres, um die Tage dazwischen einzuschließen.',
  multiDayPickerHelpContiguous:
    'Klicken Sie auf ein Startdatum und dann auf ein weiteres, um den Zeitraum zu erweitern. Die Auswahl muss aufeinanderfolgende Tage umfassen.',
  customerCommentHint:
    'Wenn Sie einen Kommentar hinzufügen, liest eine Person Ihre Anfrage, ' +
    'bevor sie bestätigt wird — das kann etwas länger dauern. Wenn es ' +
    'wichtig ist, teilen Sie es uns bitte mit.',
  nextActionPrefix: 'Weiter:',
  helpDisclosureLabel: 'So funktioniert das',
  continueCue: 'weiter',
  continueLabel: 'Weiter',
  customerCommentAdd: 'eine Notiz für uns',
  languageStepWhy:
    'Sagen Sie uns, wer welche Sprache spricht, damit der Guide alle in ' +
    'einer verständlichen Sprache einweist.',
  languageStepHowTo:
    'Tippen Sie auf eine Sprache, um alle dieser Sprache zuzuordnen. Um die ' +
    'Gruppe aufzuteilen, ziehen Sie einen Namen auf eine andere Sprache — ' +
    'oder tippen Sie auf einen Namen und dann auf eine Sprache.',
  categoryStepCue: 'Kategorie wählen',
  noCategoriesAvailable: 'Derzeit sind keine Kategorien verfügbar.',
  productListCue: 'Angebot wählen',
  productDetailCue: 'diese Tour buchen',
  singleDatePickerCue: 'Datum wählen',
  multiDayPickerCue: 'Ihre Termine wählen',
  selectionModeAria: 'Auswahlmodus',
  dateRangeModeLabel: 'Zeitraum',
  individualDaysModeLabel: 'Einzelne Tage',
  diffAddedLabel: 'Hinzugefügt',
  diffRemovedLabel: 'Entfernt',
  fixedDateWindowCue: 'einen Zeitraum wählen',
  availabilityDateCue: 'Datum wählen',
  availabilityTimeCue: 'Uhrzeit wählen',

  required: 'Erforderlich',
  requiredPickAtLeastTemplate: 'Erforderlich — mindestens {n} auswählen',
  enterValidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  readyToContinue: 'Bereit, um fortzufahren.',
  somethingWentWrong: 'Etwas ist schiefgelaufen.',
  somethingWentWrongRetry: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.',
  couldNotLoadAvailability: 'Verfügbarkeit konnte nicht geladen werden.',
  pickADate: 'Datum wählen',
  availableDaysFor: 'Verfügbare Tage für {name}.',
  sendingEllipsis: 'Wird gesendet…',
  loadingProducts: 'Angebote werden geladen…',
  couldNotLoadProducts: 'Die Angebote konnten nicht geladen werden.',
  noProductsInCategory: 'Keine Angebote in dieser Kategorie.',
  checkBackLater: 'Bitte schauen Sie später wieder vorbei.',
  priceOnRequest: 'Preis auf Anfrage',
  tryAgain: 'Erneut versuchen',
  backLabel: 'Zurück',
  bookingStepsAriaLabel: 'Buchungsschritte',

  noTimesAvailable: 'Keine Uhrzeiten verfügbar.',
  anyTime: 'Beliebige Uhrzeit',
  timesOnTemplate: 'Uhrzeiten am {date}',
  seatSingular: 'Platz',
  seatPlural: 'Plätze',
  selectedDateTemplate: 'Ausgewählt: {date}',

  pickACourseWindow: 'Zeitraum wählen',
  couldNotLoadCourseWindows: 'Zeiträume konnten nicht geladen werden.',
  loadingWindows: 'Zeiträume werden geladen…',
  noUpcomingWindows: 'Keine bevorstehenden Termine für diesen Kurs. Bitte schauen Sie später wieder vorbei.',
  upcomingWindowsFor: 'Bevorstehende Termine für {name}. Wählen Sie einen aus, um fortzufahren.',
  fullBadge: 'Ausgebucht',
  tooLateToBook: 'Zu spät zum Buchen',
  availableBadge: 'Verfügbar',
  seatLeftSingular: 'noch {n} Platz frei',
  seatsLeftPlural: 'noch {n} Plätze frei',

  pickYourDates: 'Ihre Termine wählen',
  yourDates: 'Ihre Termine',
  loadingAvailabilityEllipsis: 'Verfügbarkeit wird geladen…',
  changeYourDatesToContinue: 'Ändern Sie Ihre Termine, um fortzufahren.',
  readyToContinueWithHostsDates: 'Bereit, mit den Terminen des Gastgebers fortzufahren.',
  continueWithTheseDates: 'Mit diesen Terminen fortfahren',
  changeDates: 'Termine ändern',
  sameDaysAsHostFor: 'Die gleichen Termine wie {host} für {product}.',
  hostDayUnavailableOne:
    '1 der Termine von {host} ist nicht mehr verfügbar — ändern Sie Ihre Termine, um fortzufahren.',
  hostDaysUnavailableOther:
    '{n} der Termine von {host} sind nicht mehr verfügbar — ändern Sie Ihre Termine, um fortzufahren.',

  pickupLocationTitle: 'Abholort',
  pickupLocationCue: 'Abholort wählen',
  chooseWhereWePickYouUp: 'Wählen Sie, wo wir Sie abholen',
  loadingPickupLocations: 'Abholorte werden geladen…',
  noPickupLocationsConfigured: 'Keine Abholorte eingerichtet — bitte kontaktieren Sie den Anbieter',
  choosePickupLocationToContinue: 'Wählen Sie einen Abholort, um fortzufahren.',

  guideLanguageTitle: 'Guide-Sprache',
  optionalSuffix: '(optional)',
  unassignedOption: 'Nicht zugeordnet',
  roomFullSuffix: ' (voll)',
  languagesColon: 'Sprachen:',
  addLanguageColon: 'Sprache hinzufügen:',
  guestSuffix: '(Gast)',
  guestBadgeLabel: 'Gast',
  unassignedCountTemplate: 'Nicht zugeordnet ({n})',
  dropNamesHere: 'Namen hierher ziehen',
  assignWithDropdownsInstead: 'Stattdessen über Dropdowns zuordnen',
  languageDropdownPlaceholder: '→ Sprache…',
  assignToLanguageAriaTemplate: '{name} eine Sprache zuordnen',
  everyoneSpeaksTemplate: 'Alle sprechen {language}',
  moveSelectedHereUnassign: 'Ausgewählte hierher verschieben (nicht zugeordnet)',

  selectPlaceholder: '— auswählen —',
  noFormConfigForProduct: 'Für dieses Angebot wurde keine Formularkonfiguration gefunden.',
  formDefinitionNotFound: 'Formulardefinition nicht gefunden.',
  couldNotLoadFormRetry: 'Das Formular konnte nicht geladen werden. Bitte gehen Sie zurück und versuchen Sie es erneut.',
  additionalInformationTitle: 'Zusätzliche Informationen',
  completeEveryRequiredField: 'Füllen Sie alle Pflichtfelder aus, um fortzufahren.',
  unsupportedFieldTypeTemplate: '(Nicht unterstützter Feldtyp: {type})',
  productFormSubtitleTemplate: '{product} · bitte füllen Sie das folgende Formular aus',
  loadingEllipsis: 'Wird geladen…',

  customerCommentPlaceholder:
    'z. B. eine Ernährungsbesonderheit, ein Bedarf für Barrierefreiheit, ein besonderer Anlass…',
  anythingWeShouldKnowLabel: 'Möchten Sie uns noch etwas mitteilen? (optional)',

  participantsTitle: 'Teilnehmer',
  yourContactDetailsTitle: 'Ihre Kontaktdaten',
  requestLargerGroupLink: 'Größere Gruppe anfragen',
  addParticipantAria: 'Teilnehmer hinzufügen',
  addCompanionAria: 'Begleitperson hinzufügen',
  addParticipantButton: '+ Teilnehmer hinzufügen',
  addGuestButton: '+ Gast hinzufügen',
  enterYourNameEmailPhoneCue: 'Name, E-Mail und Telefon eingeben',
  fillInEveryRequiredField: 'Füllen Sie alle Pflichtfelder aus, um fortzufahren.',
  roleLabel: 'Rolle',
  includeYourCountryCode: 'Bitte mit Landesvorwahl',
  memberPerkOtpLabel: 'Mitglied? Geben Sie den 6-stelligen Code ein, den wir Ihnen per E-Mail geschickt haben, um Ihren Mitgliederpreis anzuwenden.',
  maxAdditionalParticipantsTemplate: 'Maximal {n} zusätzliche Teilnehmer erreicht',
  needLargerGroupHint: 'Größere Gruppe oder individuelle Buchung gewünscht?',
  requestMoreButton: 'Mehr anfragen',
  needLargerGroupDialogDescription:
    'Größere Gruppe oder individuelle Buchung gewünscht? Senden Sie uns die Details und wir melden uns bei Ihnen.',
  othersSharingYourRoom: 'Weitere Personen in Ihrem Zimmer',
  howAreTheyJoining: 'Wie nehmen sie teil?',
  companionKindGuestLabel: 'Nimmt nicht an der Aktivität teil (Partner/in, Kind, Freund/in)',
  companionKindSeparateGuidingLabel: 'Nimmt an der Aktivität teil — bucht eigenes Guiding separat',

  enterValidGroupSize: 'Bitte geben Sie eine gültige Gruppengröße ein',
  sendEnquiry: 'Anfrage senden',
  groupInquiryPlaceholder: 'Erzählen Sie uns von Ihrer Gruppe, den bevorzugten Terminen und allen Fragen…',
  groupSizeLabel: 'Gruppengröße',
  messageLabel: 'Nachricht',
  addYourNameAndEmailCue: 'Name und E-Mail eingeben',
  yourNameLabel: 'Ihr Name',
  closeLabel: 'Schließen',
  cancelLabel: 'Abbrechen',
  thanksWellBeInTouch: 'Danke — wir melden uns bei Ihnen!',
  couldNotSendMessage: 'Ihre Nachricht konnte nicht gesendet werden. Bitte nehmen Sie Kontakt auf',
  orEmailUs: 'Oder schreiben Sie uns eine E-Mail',

  trackBookingTitle: 'Diese Buchung in der LANDR-App verfolgen',
  accountLinkBodyTemplate:
    'Verknüpfen Sie {email} mit einem LANDR-Konto, um Ihre Buchung einzusehen, Updates zu erhalten und Stornierungen von Ihrem Telefon aus zu verwalten.',
  checkYourInboxTemplate: 'Schauen Sie in Ihr Postfach — wir haben einen Anmeldelink an {email} gesendet.',
  couldNotSendLinkTemplate: 'Der Link konnte nicht gesendet werden: {message}. Ihre Buchung ist weiterhin bestätigt.',
  accountLinkOptionalNote: 'Optional — Ihre Buchung ist in jedem Fall bereits bestätigt.',
  noThanksContinueAsGuest: 'Nein danke, als Gast fortfahren',
  yesSendMeALink: 'Ja, Link zusenden',
  magicLinkFailed: 'Ihre Buchung ist weiterhin bestätigt.',

  accommodationTitle: 'Unterkunft',
  hotelStayRequired: 'Hotelaufenthalt erforderlich',
  addHotelStayOptional: 'Hotelaufenthalt hinzufügen (optional)',
  guidingOnlyLabel: 'Nur Guiding — ich bringe meine eigene Unterkunft mit',
  guidingOnlyHint: 'Kein Hotel über uns gebucht — direkt zur Abholung.',
  bookAccommodationPackageLabel: 'Unterkunft buchen (Paket)',
  bookAccommodationPackageHint: 'Wählen Sie ein Hotel und Zimmer für Ihren Aufenthalt.',
  sharedDoubleLabel: 'Ich teile mir ein Doppelzimmer, das von jemand anderem gebucht wurde',
  chooseYourHotel: 'Wählen Sie Ihr Hotel',
  noHotelsConfigured: 'Für diesen Anbieter sind noch keine Hotels eingerichtet.',
  roomsLegend: 'Zimmer',
  additionalAccommodationLegend: 'Zusätzliche Unterkunft',
  loadingRooms: 'Zimmer werden geladen…',
  noRoomsConfigured: 'Für dieses Hotel sind noch keine Zimmer eingerichtet.',
  perNightSuffix: '/ Nacht',
  roomAssignmentLegend: 'Zimmerzuordnung',
  assignEveryoneToARoomCue: 'alle einem Zimmer zuordnen',
  stayNightsLabel: 'Aufenthalt',
  hotelPaidAtCheckin:
    'Das Hotel wird direkt beim Check-in bezahlt (bar / Karte) — nicht in Ihrem Buchungsbetrag enthalten.',
  completeStepsAboveToContinue: 'Schließen Sie die obigen Schritte ab, um fortzufahren.',
  checkingAccommodationAvailability: 'Verfügbarkeit der Unterkunft für dieses Datum wird geprüft…',
  howWouldYouLikeToHandleAccommodation: 'Wie möchten Sie die Unterkunft handhaben?',
  sharedDoubleInviteNotice:
    'Ihr eigenes Zimmer ist bereits gebucht — Sie teilen sich das Doppelzimmer der Person, die Sie eingeladen hat, und werden vom Hotel abgeholt.',
  sharedDoubleNormalNotice:
    'Sie teilen sich ein Doppelzimmer mit einem anderen Gast. Für Sie ist kein Zimmer gebucht — der andere Gast hat das Zimmer — und Sie werden vom Hotel abgeholt.',
  travellingWithFamilyHint:
    'Reisen Sie mit Familie oder Freunden? Fügen Sie sie im vorherigen Schritt als Begleitpersonen hinzu, dann können Sie hier zusätzliche Zimmer für sie buchen.',
  pleaseEnterChildAgeHint:
    'Bitte geben Sie für jedes Kind das Alter an — das Hotel benötigt es zur Vorbereitung des Zimmers.',
  sharedDoubleReferenceInputLabel: 'Buchungsreferenz der Person, die das Zimmer gebucht hat',
  sharedDoubleReferenceLookingUp: 'Wird gesucht…',
  sharedDoubleReferenceNotFoundTemplate:
    'Wir konnten diese Referenz für diesen Anbieter nicht finden — prüfen Sie sie noch einmal, oder lassen Sie das Feld leer und tragen Sie sie später nach.',
  sharedDoubleReferenceFoundTemplate: 'Buchung von {name} vom {date} — ist das die richtige Person?',
  sharedDoubleReferenceConfirmYes: 'Ja, verknüpfen',
  sharedDoubleReferenceConfirmNo: 'Nein',
  sharedDoubleReferenceLinkedTemplate: 'Mit der Buchung von {name} verknüpft.',
  sharedDoubleReferenceHelp:
    'Schön, wenn Sie den Code zur Hand haben — kein Problem, wenn nicht, Sie können ihn später auf Ihrer ' +
    'Buchungsseite nachtragen. Am einfachsten ist es, die Person, die gebucht hat, nach ihrem Einladungslink ' +
    'zu fragen — dann ist alles schon ausgefüllt.',
  additionalAccommodationOptionalHint:
    'Optional — Zimmer für die Personen, die mit Ihnen reisen. Ihr eigenes Bett ist bereits durch das gemeinsame Doppelzimmer abgedeckt.',
  sharedDoubleOthersTooLateTemplate:
    'Nur Sie teilen sich das Zimmer mit dem Gastgeber; für die anderen Piloten ({names}) ist es zu spät, ' +
    'um Zimmer zu buchen — entfernen Sie sie oder kontaktieren Sie den Anbieter.',
  stayingAtTemplate: 'Übernachtung in {hotel}.',

  whoStaysWhereTitle: 'Wer wohnt wo?',
  roomAssignmentHelp:
    'Ziehen Sie einen Namen auf ein Zimmer, oder tippen Sie auf einen Namen ' +
    'und dann auf ein Zimmer. Sie können auch das Dropdown bei jedem Namen ' +
    'nutzen. Wenn ein Zimmer weniger Frühstücke als Gäste hat, ziehen Sie ' +
    'den Frühstücks-Chip auf die Person, die es bekommt.',
  adultOption: 'Erwachsener',
  childOption: 'Kind',
  ageBandAria: 'Altersgruppe',
  childAgeAria: 'Alter des Kindes',
  agePlaceholder: 'Alter',
  breakfastLabel: 'Frühstück',
  emptyLabel: 'Leer',
  swapInHereLabel: 'Hier tauschen',
  placeHereLabel: 'Hier platzieren',
  everyoneHasARoom: 'Alle haben ein Zimmer.',
  addBreakfastButton: '+ Frühstück',
  giveBreakfastToTemplate: 'Frühstück an {name} geben',

  reviewYourBookingTitle: 'Ihre Buchung überprüfen',
  hotelPrefix: 'Hotel:',
  paidDirectlyToHotel: 'Direkt an das Hotel bezahlt — nicht in Ihrem Buchungsbetrag enthalten.',
  yourContactHeading: 'Ihr Kontakt',
  nameLabel: 'Name',
  emailLabel: 'E-Mail',
  phoneLabel: 'Telefon',
  roomBreakfastHeading: 'Zimmerfrühstück',
  assignEveryParticipantToALanguage: 'Ordnen Sie jedem Teilnehmer eine Sprache zu.',
  additionalAccommodationLabel: 'Zusätzliche Unterkunft',
  additionalAccommodationForTemplate: 'Zusätzliche Unterkunft (für {who})',
  yourCompanionsAndCoPilots: 'Ihre Begleitpersonen und weitere Teilnehmer',
  yourCoPilots: 'weitere Teilnehmer',
  yourCompanions: 'Ihre Begleitpersonen',
  othersJoiningReviewHeading: 'Begleitpersonen',
  breakfastIncludedLabel: 'Frühstück inklusive',
  breakfastPartialLabel: 'Frühstück nur für einige Gäste',
  noBreakfastLabel: 'kein Frühstück',
  withBreakfastLabel: 'mit Frühstück',
  withoutBreakfastLabel: 'ohne Frühstück',
  otherParticipantsTotalTemplate: 'Weitere Teilnehmer ({n} insgesamt)',
  addAnyoneElseUpToTemplate: 'Fügen Sie alle weiteren Teilnehmenden hinzu. Sie können bis zu {n} weitere hinzufügen.',
  participantOrdinalTemplate: 'Teilnehmer {n}',
  companionOrdinalTemplate: 'Gast {n}',
  maxCompanionsReachedTemplate: 'Maximal {n} Gäste erreicht',
  companionInviteHint: 'Damit senden wir ihnen ihren eigenen Buchungslink.',
  companionContactRequiredTemplate:
    'Wir benötigen eine E-Mail-Adresse oder Telefonnummer, um {name} den Buchungslink zu senden',
  themFallback: 'ihnen',
  youWillBeListedAsParticipant1:
    'Sie werden als Teilnehmer 1 aufgeführt. Fügen Sie unten weitere Personen hinzu, wenn andere mitkommen.',
  notAMemberOrNoCode:
    'Kein Mitglied oder keinen Code zur Hand? Lassen Sie dieses Feld leer — das hat keinen Einfluss auf Ihre Buchung.',
  companionsShareAccommodationExplainer:
    'Alle weiteren Personen, die sich Ihre Unterkunft teilen — Partner/innen, Freunde, Familienmitglieder ' +
    'oder andere Aktivitätsteilnehmende, die ihr Guiding separat buchen und bezahlen. Sie werden zur ' +
    'Hotelbelegung und Zimmerzuteilung hinzugefügt, aber nicht zur Aktivität oder zum Preis dieser Buchung.',
  guestFallbackTemplate: 'Gast {n}',
  readyToConfirm: 'Bereit zum Bestätigen.',
  submittingYourBookingEllipsis: 'Ihre Buchung wird gesendet…',
  sharedDoubleOwnBedNote: 'Ihr eigenes Bett ist das vom Gastgeber gebuchte Doppelzimmer.',
  joiningActivitySeparateGuiding: 'nimmt an der Aktivität teil (separates Guiding)',
  notDoingActivity: 'nimmt nicht an der Aktivität teil',
  submittingEllipsis: 'Wird gesendet…',
  confirmBookingLabel: 'Buchung bestätigen',

  yourBookingTitle: 'Ihre Buchung',
  priceBreakdownTitle: 'Preisaufschlüsselung',
  atHotelPayAtCheckin: 'Im Hotel · Zahlung beim Check-in',
  referenceLabel: 'Referenz',
  addToGoogleCalendarAria: 'Zu Google Kalender hinzufügen',
  addToOutlookCalendarAria: 'Zu Outlook Kalender hinzufügen',
  copyLinkLabel: 'Link kopieren',
  copyLabel: 'Kopieren',
  copiedLabel: 'Kopiert',
  couldNotCopyAutomatically: 'Automatisches Kopieren fehlgeschlagen — bitte auswählen und kopieren:',
  shareReferenceHint: 'Teilen Sie dies mit allen, die ihre eigene Tour buchen und sich mit Ihnen zusammenschließen möchten.',
  retryEmailLabel: 'E-Mail erneut senden',
  emailLabelShort: 'E-Mail',
  bookingCreated: 'Buchung erstellt',
  bookingConfirmed: 'Buchung bestätigt',
  bookingReceived: 'Buchung erhalten',
  confirmationEmailFailed:
    'Wir haben Ihre Buchungsanfrage erhalten, konnten aber die Bestätigungs-E-Mail nicht senden.',
  confirmationEmailSent: 'Eine Bestätigungs-E-Mail mit Ihren Buchungsdetails wurde gesendet.',
  confirmationEmailPending: 'Sie erhalten in Kürze eine Bestätigungs-E-Mail mit den nächsten Schritten.',
  downloadIcsButton: '.ics herunterladen',
  makeAnotherBookingLink: 'Weitere Buchung vornehmen',
  bookingConfirmedInboxNote: 'Ihre Buchung ist bestätigt — die Details finden Sie in Ihrem Postfach.',
  paymentLinkOnItsWay: 'Ein Zahlungslink ist unterwegs.',
  payOnSiteNote: 'Bitte zahlen Sie am Tag der Aktivität direkt am Treffpunkt.',
  bankTransferNote: 'Die Bankverbindung finden Sie in Ihrer Bestätigungs-E-Mail.',
  paymentLinkForDepositOnItsWay: 'Ein Zahlungslink für Ihre Anzahlung ist unterwegs.',
  awaitingOperatorConfirmation: 'Ihre Buchung wartet auf die Bestätigung durch den Anbieter.',
  participantCountSingular: '{n} Teilnehmer',
  participantCountPlural: '{n} Teilnehmer',
  pickupPrefix: 'Abholung:',
  savingsConsecutiveTemplate: '{days} {dayWord} in Folge — Sie haben {amount} gespart!',
  savingsNonConsecutiveTemplate: 'Sie haben {amount} gespart, weil Sie {days} {dayWord} gebucht haben!',
  meetingPointOpenInGoogleMapsAria: 'In Google Maps öffnen',
  meetingPointOpenInWazeAria: 'In Waze öffnen',
  bookedRefTemplate: 'Gebucht ✓ (Ref. {ref})',
  sendBookingLinkToTemplate: 'Buchungslink senden an {name}',
  inviteEmailSentLabel: 'Gesendet ✓',
  emailUnavailableNotice: 'E-Mail-Versand nicht verfügbar — kopieren Sie stattdessen den Link.',
  groupBookedTogetherWith: 'Gemeinsam gebucht mit',
  bookedTogetherMemberTemplate: '{name} (Ref. {ref})',
  hostSuffixLabel: ' — Gastgeber',
  sharedDoubleHintQuestion: 'Teilen Sie sich ein Zimmer, das jemand anders gebucht hat?',
  addReferenceLinkLabel: 'Referenz auf Ihrer Buchungsseite hinzufügen',
  joinErrorUnknownReference:
    'Wir konnten keine Buchung mit dieser Referenz finden, daher wurde Ihre Buchung nicht damit verknüpft.',
  joinErrorSameBooking: 'Diese Referenz verweist auf Ihre eigene Buchung, es gab also nichts zu verknüpfen.',
  joinErrorJoinFailed: 'Wir konnten Ihre Buchung gerade nicht mit dieser Referenz verknüpfen.',
  joinErrorFollowup:
    'Ihre Buchung selbst ist wie gewohnt bestätigt — Sie können die Referenz später weiterhin auf Ihrer Buchungsseite hinzufügen.',
  bookingConfirmedEmailFailed:
    'Ihre Buchung ist bestätigt — die Bestätigungs-E-Mail konnten wir jedoch nicht senden.',
  contactOperatorToConfirm: 'Bitte kontaktieren Sie den Anbieter direkt, um Ihre Buchungsdetails zu bestätigen.',
  nextStepSendGroupLinkSingular: 'Nächster Schritt: Senden Sie Ihrer Gruppe ihren Buchungslink',
  nextStepSendGroupLinkPlural: 'Nächster Schritt: Senden Sie Ihrer Gruppe ihre Buchungslinks',
  eachCompletesOwnBooking: 'Jede Person schließt ihre eigene Buchung über ihren Link ab.',
  linkCannotBeEmailed: 'Dieser Link kann von hier aus nicht mehr per E-Mail versendet werden — kopieren Sie ihn stattdessen.',
  emailAddressRejected: 'Diese E-Mail-Adresse wurde abgelehnt.',
  tooManyEmailsRetry: 'Gerade zu viele E-Mails — versuchen Sie es in ein paar Minuten erneut.',
  couldNotSendEmailGeneric:
    'Diese E-Mail konnte nicht gesendet werden — bitte versuchen Sie es erneut, oder nutzen Sie WhatsApp / kopieren Sie den Link.',

  confirmingYourPayment: 'Ihre Zahlung wird bestätigt…',
  usuallyTakesAFewSeconds: 'Das dauert normalerweise nur wenige Sekunden.',
  pleaseWaitConfirmingPayment: 'Bitte warten Sie, während wir Ihre Zahlung mit unseren Unterlagen abgleichen.',
  paymentComplete: 'Zahlung abgeschlossen',
  yourBookingIsConfirmed: 'Ihre Buchung ist bestätigt.',
  paymentCompleteBody:
    'Vielen Dank! Wir haben Ihre Zahlung erhalten und Ihre Buchung ist bestätigt. ' +
    'Sie erhalten in Kürze eine Bestätigungs-E-Mail.',
  stillConfirmingYourPayment: 'Ihre Zahlung wird noch bestätigt',
  takingLongerThanUsual: 'Das dauert länger als gewöhnlich.',
  paymentPendingBody:
    'Wir konnten Ihre Zahlung noch nicht bestätigen. Das muss nicht bedeuten, ' +
    'dass etwas falsch gelaufen ist — wir schicken Ihnen eine Bestätigung, ' +
    'sobald sie verarbeitet ist. Falls Sie sich nicht bald bei uns melden hören, ' +
    'kontaktieren Sie uns bitte.',
  couldNotCheckPaymentStatusTitle: 'Wir konnten Ihren Zahlungsstatus nicht prüfen',
  paymentUnknownBody:
    'Wir konnten unsere Unterlagen gerade nicht erreichen. Falls Ihre Zahlung ' +
    'erfolgreich war, erhalten Sie in Kürze eine Bestätigungs-E-Mail. Falls Sie ' +
    'unsicher sind, kontaktieren Sie uns bitte.',
  paymentCancelledTitle: 'Zahlung abgebrochen',
  yourBookingHasNotBeenCharged: 'Ihre Buchung wurde nicht belastet.',
  paymentCancelledBody:
    'Sie haben die Zahlungsseite verlassen, ohne die Zahlung abzuschließen. Ihre ' +
    'Buchung ist weiterhin reserviert — klicken Sie unten, um es erneut zu versuchen.',
  paymentLinkNotFoundTitle: 'Zahlungslink nicht gefunden',
  offerNotFoundTitle: 'Angebot nicht gefunden',
  offerLinkInvalidBody:
    'Dieser Angebotslink ist ungültig oder abgelaufen. Bitte kontaktieren Sie den Anbieter für einen neuen Link.',
  paymentFailedToStartTitle: 'Zahlung konnte nicht gestartet werden',
  loadingYourOffer: 'Ihr Angebot wird geladen…',
  pleaseWait: 'Bitte warten.',
  completeYourPayment: 'Zahlung abschließen',
  yourCustomOffer: 'Ihr individuelles Angebot',
  payModeDescription: 'Ihre Buchung ist bestätigt. Zahlen Sie unten den ausstehenden Betrag, um sie zu sichern.',
  offerModeDescription: 'Prüfen Sie die Details unten und klicken Sie auf „Annehmen & Bezahlen“, um Ihre Buchung zu bestätigen.',
  statusLabel: 'Status:',
  whatYoureBooking: 'Was Sie buchen',
  productsAria: 'Angebote',
  offerParticipantsTitle: 'Teilnehmer',
  offerPriceBreakdownTitle: 'Preisaufschlüsselung',
  offerSubtotalLabel: 'Zwischensumme',
  taxLabel: 'Steuer',
  amountDueLabel: 'Fälliger Betrag',
  nothingDueNow: 'Derzeit nichts fällig',
  depositLabelTemplate: 'Anzahlung ({n} %)',
  depositRemainderNote: 'Der Restbetrag ist später fällig.',
  continueToStripeLabel: 'Weiter zur Zahlung',
  yourShareOfThisBooking: 'Ihr Anteil an dieser Buchung',
  totalBookingValueLabel: 'Gesamtwert der Buchung',
  offerTotalLabel: 'Gesamt',
  amountDueNowLabel: 'Jetzt fälliger Betrag',
  totalBookingValueNote: 'Dies ist der volle Wert der Buchung — nicht der jetzt berechnete Betrag.',
  payableDirectlyToHotel: 'Direkt bei Ankunft an das Hotel zu zahlen',
  hotelSettledAtCheckin:
    'Ihre Unterkunft wird beim Check-in mit dem Hotel abgerechnet. Sie ist nicht Teil des hier berechneten Betrags.',
  nothingToPay: 'Nichts zu bezahlen',
  redirectingToPaymentEllipsis: 'Weiterleitung zur Zahlung…',
  payNowLabel: 'Jetzt bezahlen',
  acceptAndPayLabel: 'Annehmen & Bezahlen',
  nothingFurtherToPay: 'Über diesen Link ist derzeit nichts weiter zu bezahlen.',
  paymentLinkPersonal: 'Dieser Zahlungslink ist persönlich. Bitte nicht weitergeben.',
  offerLinkPersonal: 'Dieser Angebotslink ist persönlich. Bitte nicht weitergeben.',
  couldNotStartPayment: 'Die Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns.',

  becomeAMember: 'Mitglied werden',
  backToProductsLabel: 'Zurück zu den Angeboten',
  membershipRedirectHelp:
    'Sie werden zu unserem sicheren Zahlungsanbieter weitergeleitet, um Ihre Mitgliedschaft abzuschließen.',
  enterYourEmailCue: 'E-Mail eingeben',
  yourNameThing: 'Ihren Namen',
  firstNameLabel: 'Vorname',
  lastNameLabel: 'Nachname',
  becomeAMemberCue: 'Mitglied werden',
  membershipUnavailableTitle: 'Mitgliedschaft nicht verfügbar',
  membershipUnavailableBody:
    'Diese Mitgliedschaftsoption ist derzeit nicht verfügbar. Bitte kontaktieren Sie den Anbieter direkt.',
  tooManyAttemptsTitle: 'Zu viele Versuche',
  tooManyAttemptsBody: 'Bitte warten Sie ein paar Minuten und versuchen Sie es erneut.',
  membershipGenericErrorBody: 'Der Checkout konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie den Anbieter.',
  redirectingToPaymentDots: 'Weiterleitung zur Zahlung…',
  onYourWayToMembershipTitle: 'Sie sind auf dem Weg zur Mitgliedschaft',
  membershipBeingActivated: 'Ihre Mitgliedschaft wird gerade aktiviert.',
  checkoutCancelledTitle: 'Checkout abgebrochen',
  membershipNotCharged: 'Sie wurden nicht belastet.',
  membershipCancelledBody:
    'Sie haben den Checkout verlassen, ohne Ihre Mitgliedschaft abzuschließen. Es wurde keine Zahlung ' +
    'vorgenommen — Sie können es jederzeit erneut versuchen.',
  continueBrowsing: 'Weiter stöbern',
  membershipActivatingBody:
    'Vielen Dank! Wir haben Ihre Zahlung erhalten und Ihre Mitgliedschaft wird jetzt eingerichtet. Sie erhalten eine Bestätigungs-E-Mail, sobald sie aktiv ist — das geht normalerweise schnell, aber bitte laden Sie diese Seite nicht neu, um auf die Änderung zu warten.',

  addonsTitle: 'Zusatzleistungen',
  loadingAddons: 'Zusatzleistungen werden geladen…',
  noAddonsAvailable: 'Für diese Option sind keine Zusatzleistungen verfügbar.',
  pickRequiredAddonsCue: 'erforderliche Zusatzleistungen wählen',
  pickRequiredAddonsToContinue: 'Wählen Sie alle erforderlichen Zusatzleistungen, um fortzufahren.',
  requiredSuffix: 'erforderlich',
  eachSuffix: 'je Stück',
  overbookManyRoomsTemplate: 'Mehr {addon} ({qty}) als diese {roomQty} Zimmer fassen ({expected}) — bringen Sie zusätzliche Gäste mit?',
  overbookOneRoomTemplate: 'Mehr {addon} ({qty}) als dieses Zimmer fasst ({expected}) — bringen Sie zusätzliche Gäste mit?',
  underbookManyRoomsTemplate: 'Nur {qty} {addon} für {roomQty} Zimmer ({expected} Gäste) — eines pro Zimmer?',
  underbookOneRoomTemplate: 'Nur {qty} {addon} für ein Zimmer mit Platz für {expected} — eines pro Gast?',

  fullyBookedLabel: 'Ausgebucht',
  fullyBookedBlurb: 'Für dieses Angebot sind derzeit keine bevorstehenden Termine verfügbar. Bitte schauen Sie später wieder vorbei.',
  gridViewLabel: 'Rasteransicht',
  listViewLabel: 'Listenansicht',
  catalogueLayoutAria: 'Katalog-Layout',
  offerCountOne: 'Angebot',
  offerCountOther: 'Angebote',

  productDetailsAria: 'Produktdetails',
  productImageThumbnailsAria: 'Vorschaubilder',
  showImageAria: 'Bild {name} anzeigen',
  hotelIncluded: 'Hotel inklusive',
  hotelOptional: 'Hotel optional',
  pickupAvailable: 'Abholung verfügbar',
  offeredInPrefix: 'Angeboten in',
  backLinkArrow: '← Zurück',
  bookNow: 'Jetzt buchen',
  tickEveryLanguageHelp:
    'Kreuzen Sie jede Sprache an, die Sie sprechen, und ziehen Sie Ihre bevorzugte nach oben.',
  draftPreviewBadge: 'Entwurf — Vorschau',
  shopComingSoonBodyTemplate:
    'Diese Art von Produkt ({kind}) wird über unseren Shop verkauft, der in Kürze verfügbar ist. Bitte kontaktieren Sie den Anbieter direkt, um es in der Zwischenzeit zu bestellen.',
  landingPageTitle: 'Dies ist die Host-Seite für das Landr-Buchungswidget.',

  perDaySuffix: '/Tag',
  daySingular: 'Tag',
  dayPlural: 'Tage',
  consecutiveDayPlural: 'aufeinanderfolgende Tage',
  savesVsStandardRate: 'spart {amount} gegenüber dem Standardpreis',
  participantSuffixSingular: '× {n} Teilnehmer',
  participantSuffixPlural: '× {n} Teilnehmer',
  multiDayDiscountLabel: 'Mehrtagesrabatt',
  streakDiscountLabel: 'Serienrabatt',
  voucherAppliedLabel: 'Gutschein eingelöst',

  calculatingEllipsis: 'Wird berechnet…',
  couldNotFetchPrice: 'Preis konnte nicht abgerufen werden — Ihr Endbetrag wird bei der Bestätigung angezeigt.',
  pickYourOptionsToSeePrice: 'Wählen Sie Ihre Optionen, um den Preis zu sehen.',
  bookingOverviewTitle: 'Buchungsübersicht',
  updatePriceTitle: 'Preis aktualisieren',
  grandTotalLabel: 'Gesamtsumme',
  forNamesTemplate: 'Für {names}',
  forNamesOtherSingularTemplate: 'Für {names} + {n} weitere Person',
  forNamesOtherPluralTemplate: 'Für {names} + {n} weitere',
  youPayNowHeading: 'Sie zahlen jetzt',
  atHotelTotalPayAtCheckin: 'Gesamtbetrag im Hotel · Zahlung beim Check-in',
  hotelSpanTemplate: 'Hotel: {from} → {to}, {nights} {nightWord}',
  nightSingular: 'Nacht',
  nightPlural: 'Nächte',
  updatingEllipsis: 'Wird aktualisiert…',
  payableDirectlyToHotelCaveat: 'Direkt beim Check-in an das Hotel bezahlt — nicht in Ihrem Buchungsbetrag enthalten.',
  multiDayRateAppliedHeading: 'Mehrtagespreis angewendet',
  tapToExpand: 'Zum Erweitern tippen',
  tapToCollapse: 'Zum Einklappen tippen',
  atHotelSuffix: 'im Hotel',
  qtyTimesDayTemplate: '{qty} × {units} {unitWord}',

  // ---- landr-5aih0.27 ----
  decreaseQtyAriaTemplate: 'Menge von {item} verringern',
  increaseQtyAriaTemplate: 'Menge von {item} erhöhen',
  ownerHasBreakfastTemplate: '{owner} hat Frühstück',
  breakfastDragHintTemplate: 'Frühstück von {owner} — auf einen anderen Gast ziehen, um es zu verschieben',
  roomUnitAriaTemplate: '{room} — Einheit {n}',
  assignToRoomTemplate: '{name} einem Zimmer zuweisen',
  languageSpeakersTemplate: '{language}-Sprechende',
  removeLanguageTemplate: '{language} entfernen',
  reorderLanguageTemplate: '{language} verschieben',
  removeParticipantAriaTemplate: 'Teilnehmer {n} entfernen',
  removeCompanionAriaTemplate: 'Begleitperson {n} entfernen',
  useYourEmailAria: 'E-Mail übernehmen',
  useYourPhoneAria: 'Telefon übernehmen',
}

/**
 * Resolve an arbitrary BCP-47-ish locale string ('de-AT', 'DE', 'de-DE', …)
 * to a supported bundle. Only 'de' is a real bundle today (v1 scope, epic
 * landr-5aih0 / landr-wchwi) — every other language, including an absent
 * locale, falls back to English. Mirrors approvalReplyStrings.ts's
 * normalizeReplyLocale base/case-fold rule so the two locale layers agree
 * on how a tag is read.
 */
export function pickBundle(locale?: string): Bundle {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return base === 'de' ? de : en
}

export function tr(key: keyof Bundle, locale?: string): string {
  return pickBundle(locale)[key]
}

/** True when the resolved locale gets the German bundle. */
export function isGermanLocale(locale?: string): boolean {
  return pickBundle(locale) === de
}

/**
 * Minimal pluraliser — English and German split the same way (n === 1 is
 * singular, everything else — including 0 — takes the "other" form), so one
 * helper covers both bundles. Callers compose the count in themselves, e.g.
 * `${n} ${plural(n, t.nightSingular, t.nightPlural)}`.
 */
export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other
}

/** Substitute a single `{name}` placeholder in a bundle template string. */
function fillName(template: string, name: string): string {
  return template.replace('{name}', name)
}

/**
 * Split a bundle template on a single `{token}` placeholder into
 * [before, after] — for callers (AccountLinkPrompt) that need to interpose
 * a styled <span> where the placeholder sits rather than a plain string
 * substitution. Falls back to [template, ''] if the placeholder is absent
 * (should not happen with the bundle's own templates, but never throws).
 */
export function splitOnPlaceholder(template: string, token: string): [string, string] {
  const marker = `{${token}}`
  const idx = template.indexOf(marker)
  if (idx === -1) return [template, '']
  return [template.slice(0, idx), template.slice(idx + marker.length)]
}

export function availableDaysForLabel(name: string, locale?: string): string {
  return fillName(tr('availableDaysFor', locale), name)
}

export function upcomingWindowsForLabel(name: string, locale?: string): string {
  return fillName(tr('upcomingWindowsFor', locale), name)
}

/** "1 seat left" / "4 seats left" badge text (FixedDateWindowPicker/Chips). */
export function seatsLeftLabel(available: number, locale?: string): string {
  const t = pickBundle(locale)
  const template = plural(available, t.seatLeftSingular, t.seatsLeftPlural)
  return template.replace('{n}', String(available))
}

/** MultiDayStep invite-summary subtitle: "The same days as {host} for {product}." */
export function sameDaysAsHostForLabel(host: string, product: string, locale?: string): string {
  return tr('sameDaysAsHostFor', locale).replace('{host}', host).replace('{product}', product)
}

/** MultiDayStep invite-summary blocked-days notice. */
export function hostDaysUnavailableMessage(blocked: number, host: string, locale?: string): string {
  const t = pickBundle(locale)
  const template = plural(blocked, t.hostDayUnavailableOne, t.hostDaysUnavailableOther)
  return template.replace('{host}', host).replace('{n}', String(blocked))
}

/** "1 day selected" / "N days selected" chip (MultiDayStep). */
export function daysSelectedLabel(count: number, locale?: string): string {
  return isGermanLocale(locale)
    ? `${count} ${plural(count, 'Termin', 'Termine')} ausgewählt`
    : `${count} ${plural(count, 'day', 'days')} selected`
}

/**
 * PriceSidebar's "For Ada, Grace + 1 other" line. `names` is already the
 * head slice (≤2 names) the caller computed; `rest` is how many more names
 * exist beyond that slice (0 when the full list already fit).
 */
export function forNamesLine(names: string[], rest: number, locale?: string): string {
  if (rest <= 0) {
    return tr('forNamesTemplate', locale).replace('{names}', names.join(', '))
  }
  const template = plural(
    rest,
    tr('forNamesOtherSingularTemplate', locale),
    tr('forNamesOtherPluralTemplate', locale),
  )
  return template.replace('{names}', names.join(', ')).replace('{n}', String(rest))
}

/** PriceSidebar's "Hotel: Sun 24 May → Thu 29 May, 5 nights" span line. */
export function hotelSpanLabel(from: string, to: string, nights: number, locale?: string): string {
  const t = pickBundle(locale)
  const nightWord = plural(nights, t.nightSingular, t.nightPlural)
  return t.hotelSpanTemplate
    .replace('{from}', from)
    .replace('{to}', to)
    .replace('{nights}', String(nights))
    .replace('{nightWord}', nightWord)
}

/**
 * BookingForm's shared-double room-block heading: "Additional accommodation"
 * or "Additional accommodation (for your co-pilots)" etc. `hasCoPilots` /
 * `hasCompanions` mirror the component's own derivation.
 */
export function additionalAccommodationHeading(
  hasCoPilots: boolean,
  hasCompanions: boolean,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const who = hasCoPilots && hasCompanions
    ? t.yourCompanionsAndCoPilots
    : hasCoPilots
      ? t.yourCoPilots
      : hasCompanions
        ? t.yourCompanions
        : null
  return who ? t.additionalAccommodationForTemplate.replace('{who}', who) : t.additionalAccommodationLabel
}

/** AddonsList's quantity-deviation warning line (over- or under-booked). */
export function addonDeviationMessage(
  kind: 'over' | 'under',
  addonName: string,
  qty: number,
  expected: number,
  roomQty: number,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const template =
    kind === 'over'
      ? roomQty > 1
        ? t.overbookManyRoomsTemplate
        : t.overbookOneRoomTemplate
      : roomQty > 1
        ? t.underbookManyRoomsTemplate
        : t.underbookOneRoomTemplate
  return template
    .replace('{addon}', addonName.toLowerCase())
    .replace('{qty}', String(qty))
    .replace('{roomQty}', String(roomQty))
    .replace('{expected}', String(expected))
}

/** "1 participant" / "N participants" (Confirmation summary). */
export function participantCountLabel(n: number, locale?: string): string {
  const t = pickBundle(locale)
  const template = plural(n, t.participantCountSingular, t.participantCountPlural)
  return template.replace('{n}', String(n))
}

/** "N nights" (bare word, no count) — nights/days label reused across the widget. */
export function nightsWord(n: number, locale?: string): string {
  const t = pickBundle(locale)
  return plural(n, t.nightSingular, t.nightPlural)
}

/** "3 × 2 nights" / "3 × 2 days" line-item subtitle (PriceSidebar). */
export function qtyTimesUnits(
  qty: number,
  units: number,
  unit: 'day' | 'night',
  locale?: string,
): string {
  const t = pickBundle(locale)
  const unitWord =
    unit === 'day' ? plural(units, t.daySingular, t.dayPlural) : plural(units, t.nightSingular, t.nightPlural)
  return t.qtyTimesDayTemplate
    .replace('{qty}', String(qty))
    .replace('{units}', String(units))
    .replace('{unitWord}', unitWord)
}

/** "1 offer" / "4 offers" — CategoryTile's count chip (landr-872c copy). */
export function offerCountText(count: number, locale?: string): string {
  const t = pickBundle(locale)
  return `${count} ${plural(count, t.offerCountOne, t.offerCountOther)}`
}

export function optionalRevealLabel(thing: string, locale?: string): string {
  const german = isGermanLocale(locale)
  // landr-5aih0.9: the auto-lowercase-a-sentence-case-label heuristic is
  // English-specific punctuation convention — German capitalises formal
  // "Sie/Ihre/Ihnen" pronouns mid-sentence too, so lowercasing "Ihren Namen"
  // would be a style error. Only apply it for the English bundle.
  const t =
    !german && /^[A-Z][a-z]/.test(thing) ? thing.charAt(0).toLowerCase() + thing.slice(1) : thing
  const addWord = german ? 'Hinzufügen' : 'Add'
  return `${addWord} ${t}`
}

/**
 * landr-80ubl.1: LanguageStep's NextAction cue. Nobody placed yet and a group
 * → one tap does it for everyone, so say so; otherwise name who is left.
 */
export function languageStepCue(
  unassignedNames: string[],
  anyoneAssigned: boolean,
  locale?: string,
): string {
  const de_ = isGermanLocale(locale)
  if (!anyoneAssigned && unassignedNames.length > 1) {
    return de_ ? 'die Sprache Ihrer Gruppe antippen' : 'tap the language your group speaks'
  }
  const [first, second] = unassignedNames
  const who =
    unassignedNames.length === 1
      ? first
      : unassignedNames.length === 2
        ? de_
          ? `${first} und ${second}`
          : `${first} and ${second}`
        : de_
          ? `${first} und ${unassignedNames.length - 1} weitere`
          : `${first} and ${unassignedNames.length - 1} others`
  return de_ ? `eine Sprache für ${who} wählen` : `pick a language for ${who}`
}

/** landr-80ubl.1: LanguageStep's gate line beside Continue. */
export function languageStepGate(unassignedNames: string[], locale?: string): string {
  if (unassignedNames.length === 0) {
    return isGermanLocale(locale) ? 'Alle haben eine Sprache.' : 'Everyone has a language.'
  }
  return isGermanLocale(locale)
    ? `Ordnen Sie jedem Teilnehmer eine Sprache zu — noch offen: ${unassignedNames.join(', ')}.`
    : `Assign every participant to a language — still waiting on ${unassignedNames.join(', ')}.`
}

/**
 * landr-80ubl.2: SingleDatePicker / AvailabilityPicker / FixedDateWindowPicker's
 * gate line beside Continue. Deliberately "Choose…", not "Pick…" — the
 * CardTitle above already reads "Pick a date" and App.test.tsx's
 * screen.getByText(/Pick a date/i) helpers match ANY element containing that
 * phrase, so a gate line repeating it makes the query ambiguous (see the cue
 * strings' comment above for the same trap).
 */
export function singleDateGate(hasSelection: boolean, locale?: string): string {
  if (isGermanLocale(locale)) {
    return hasSelection ? 'Datum ausgewählt.' : 'Wählen Sie ein Datum, um fortzufahren.'
  }
  return hasSelection ? 'Date selected.' : 'Choose a date to continue.'
}

/** landr-80ubl.2: MultiDayStep's gate line beside Continue. */
export function multiDayGate(selectedCount: number, locale?: string): string {
  if (isGermanLocale(locale)) {
    if (selectedCount === 0) return 'Wählen Sie mindestens einen Termin, um fortzufahren.'
    return selectedCount === 1 ? '1 Termin ausgewählt.' : `${selectedCount} Termine ausgewählt.`
  }
  if (selectedCount === 0) return 'Choose at least one date to continue.'
  return selectedCount === 1 ? '1 date selected.' : `${selectedCount} dates selected.`
}

/** landr-80ubl.2: FixedDateWindowPicker's gate line beside Continue. */
export function fixedDateWindowGate(hasSelection: boolean, locale?: string): string {
  if (isGermanLocale(locale)) {
    return hasSelection ? 'Zeitraum ausgewählt.' : 'Wählen Sie einen Zeitraum, um fortzufahren.'
  }
  return hasSelection ? 'Window selected.' : 'Choose a window to continue.'
}

/** landr-80ubl.2: AvailabilityPicker's gate line beside Continue. */
export function availabilityGate(
  hasDate: boolean,
  hasTime: boolean,
  locale?: string,
): string {
  if (isGermanLocale(locale)) {
    if (hasTime) return 'Uhrzeit ausgewählt.'
    if (hasDate) return 'Wählen Sie eine Uhrzeit, um fortzufahren.'
    return 'Wählen Sie ein Datum, um fortzufahren.'
  }
  if (hasTime) return 'Time selected.'
  if (hasDate) return 'Choose a time to continue.'
  return 'Choose a date to continue.'
}

/**
 * landr-t869m.2: the "activity still bookable, hotel too late" copy —
 * shown in AccommodationStep when a day is activity_bookable but the
 * derived stay's own lead time (products.accommodation_lead_time_minutes)
 * has run out (hotel_offering='optional' only; 'mandatory' never reaches
 * this because the day itself is excluded from the picker). Takes an
 * already-formatted date label (see formatDayLabel in dateLabel.ts) rather
 * than a raw ISO string so this stays a plain template, matching every
 * other date-bearing string surface in the widget.
 */
export function accommodationTooLateMessage(
  checkinDateLabel: string,
  locale?: string,
): string {
  if (isGermanLocale(locale)) {
    return (
      `Sie können dieses Datum weiterhin buchen — die Aktivität ist verfügbar. ` +
      `Ein Hotelaufenthalt ist für dieses Datum jedoch nicht mehr möglich: ` +
      `der Check-in hätte am ${checkinDateLabel} sein müssen.`
    )
  }
  return (
    `You can still book this date — the activity is available. ` +
    `Booking a hotel stay is no longer possible for this date, though: ` +
    `check-in would have needed to be on ${checkinDateLabel}.`
  )
}

/**
 * landr-t869m.5: which gate(s) a staff force-book bypassed. Lives here
 * (rather than in bookability.ts, which components import) because it's
 * purely about copy — `forceReasonsFor` in bookability.ts is what computes
 * which of these apply to a given slot/window.
 *
 * Staff-only surface (force-book override banner in the review step, and
 * MultiDayPicker's own inline forced-days badge) — kept English-only for
 * now, same as the other staff-mode-only copy this ticket leaves out (see
 * the PR description's "deferred" list). ok is the only staff user today.
 */
export type ForceReason = 'capacity' | 'lead_time' | 'accommodation_lead_time'

const FORCE_REASON_CLAUSE: Record<ForceReason, string> = {
  capacity: 'past capacity',
  lead_time: 'inside the lead-time window',
  accommodation_lead_time: "with the hotel stay past the hotel's own lead time",
}

const FORCE_REASON_CONSEQUENCE: Record<ForceReason, string> = {
  capacity: 'Capacity will be exceeded',
  lead_time: 'the customer will not have the normal preparation time',
  accommodation_lead_time: "the hotel will not have its normal preparation time",
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * landr-t869m.5: the clause fragment naming which gate(s) were bypassed —
 * e.g. "past capacity", "inside the lead-time window", or "past capacity
 * and inside the lead-time window" when more than one applied. Used both by
 * BookingForm's review-forced banner (via forceBookReasonMessage below) and
 * by MultiDayPicker's own inline forced-days badge, so the two surfaces
 * never drift into contradicting each other about why a day was forced.
 */
export function describeForceReasons(reasons: ForceReason[]): string {
  const effective = reasons.length > 0 ? reasons : (['capacity'] as ForceReason[])
  return joinWithAnd(effective.map((r) => FORCE_REASON_CLAUSE[r]))
}

/**
 * landr-t869m.5: names the actual gate(s) a staff force-book bypassed, on
 * BookingForm's review-forced banner. This used to be one hard-coded
 * capacity-flavoured sentence regardless of why the pick was actually
 * forced — wrong (and misleading to the operator) the moment a lead-time
 * override folded into the same `forced`/`forcedDays` flag (landr-t869m.2's
 * pickers reuse isDayBookable's combined gate for exactly that reason).
 *
 * Capacity-only (or an empty/omitted `reasons` — the FAIL-OPEN default for
 * any caller that predates this ticket) renders the EXACT pre-existing
 * copy, character for character. A lead-time reason gets its own wording
 * instead of the (false) "capacity will be exceeded" claim; a pick that hit
 * more than one gate at once names every reason that applies.
 */
export function forceBookReasonMessage(
  reasons: ForceReason[],
  forcedDaysCount: number,
  locale?: string,
): string {
  void locale
  const effective = reasons.length > 0 ? reasons : (['capacity'] as ForceReason[])
  const subject =
    forcedDaysCount > 0
      ? `${forcedDaysCount} day${forcedDaysCount === 1 ? '' : 's'} booked`
      : 'This window was booked'
  const clause = describeForceReasons(effective)
  const consequence = joinWithAnd(effective.map((r) => FORCE_REASON_CONSEQUENCE[r]))
  const capitalizedConsequence =
    consequence.charAt(0).toUpperCase() + consequence.slice(1)
  return `${subject} ${clause}. ${capitalizedConsequence} for this booking.`
}

// ---------------------------------------------------------------------------
// landr-5aih0.17: template-filling helpers for the newly-bundled strings
// above (shared-double reference lookup, MultiDayPicker diff chrome,
// Confirmation invite/group cards, DetailsStep participant/companion copy,
// ShopComingSoonStub, CustomFormStep). Mirrors the existing helper pattern
// (availableDaysForLabel etc.) — a thin `.replace()` over a bundle template,
// or direct locale branching where German's plural/grammar genuinely
// diverges from a shared placeholder template.
// ---------------------------------------------------------------------------

/** AccommodationStep shared-double reference lookup: "not found" copy has no placeholders — exposed as a function for symmetry with its siblings below. */
export function sharedDoubleReferenceNotFoundMessage(locale?: string): string {
  return tr('sharedDoubleReferenceNotFoundTemplate', locale)
}

/** "Booking of {name} from {date} — is that them?" */
export function sharedDoubleReferenceFoundLabel(name: string, dateLabel: string, locale?: string): string {
  return tr('sharedDoubleReferenceFoundTemplate', locale)
    .replace('{name}', name)
    .replace('{date}', dateLabel)
}

/** "Linked to {name}'s booking." */
export function sharedDoubleReferenceLinkedLabel(name: string, locale?: string): string {
  return tr('sharedDoubleReferenceLinkedTemplate', locale).replace('{name}', name)
}

/** shared-double "too late for other pilots" notice, naming who is affected. */
export function sharedDoubleOthersTooLateMessage(names: string, locale?: string): string {
  return tr('sharedDoubleOthersTooLateTemplate', locale).replace('{names}', names)
}

/**
 * AccommodationStep's room-vs-occupant capacity mismatch warning. English
 * and German pluralise "person"/"bed" differently from every other bundle
 * plural pair already in this file, so this stays a small direct-branching
 * helper rather than four more bundle fields.
 */
export function occupancyOverbookWarning(occupants: number, beds: number, locale?: string): string {
  const german = isGermanLocale(locale)
  const occupantWord = german ? plural(occupants, 'Person', 'Personen') : plural(occupants, 'person', 'people')
  const bedWord = german ? plural(beds, 'Bett', 'Betten') : plural(beds, 'bed', 'beds')
  return german
    ? `Sie haben ${occupants} ${occupantWord}, aber nur ${beds} ${bedWord} — sind Sie sicher?`
    : `You have ${occupants} ${occupantWord} but only ${beds} ${bedWord} — sure?`
}

/** ShopComingSoonStub's body copy, given an already-localized product-kind label. */
export function shopComingSoonBody(kindLabel: string, locale?: string): string {
  return tr('shopComingSoonBodyTemplate', locale).replace('{kind}', kindLabel)
}

/** MultiDayPicker's invite-diff "+N day(s) / −M day(s) vs <original>" summary line. */
export function multiDayDiffSummary(
  added: number,
  removed: number,
  originalLabel: string | null | undefined,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const addedWord = plural(added, t.daySingular, t.dayPlural)
  const removedWord = plural(removed, t.daySingular, t.dayPlural)
  const original = originalLabel ?? (isGermanLocale(locale) ? 'die ursprüngliche Buchung' : 'the original booking')
  return isGermanLocale(locale)
    ? `+${added} ${addedWord} / −${removed} ${removedWord} gegenüber ${original}`
    : `+${added} ${addedWord} / −${removed} ${removedWord} vs ${original}`
}

/** MultiDayPicker's "Reset to <original>'s dates" button label. */
export function multiDayResetToDatesLabel(originalLabel: string | null | undefined, locale?: string): string {
  if (isGermanLocale(locale)) {
    return originalLabel
      ? `Zurücksetzen auf die Termine von ${originalLabel}`
      : 'Zurücksetzen auf die ursprünglichen Termine'
  }
  return `Reset to ${originalLabel ?? 'the original'}’s dates`
}

/** MultiDayPicker's "N of <host>'s days are no longer available" reset-drop notice. */
export function multiDayResetDroppedNotice(
  count: number,
  originalLabel: string | null | undefined,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const dayWord = plural(count, t.daySingular, t.dayPlural)
  if (isGermanLocale(locale)) {
    const name = originalLabel ?? 'des Gastgebers'
    const verb = count === 1 ? 'ist' : 'sind'
    return `${count} ${dayWord} von ${name} ${verb} nicht mehr verfügbar.`
  }
  const name = originalLabel ?? 'the host'
  const verb = count === 1 ? 'is' : 'are'
  return `${count} of ${name}'s days ${verb} no longer available.`
}

/** ParticipantLanguageBoard's "Everyone speaks {language}" one-tap button. */
export function everyoneSpeaksLabel(languageDisplayName: string, locale?: string): string {
  return tr('everyoneSpeaksTemplate', locale).replace('{language}', languageDisplayName)
}

/** Confirmation invite card: "Booked ✓ (ref ABC123)". */
export function bookedRefLabel(ref: string, locale?: string): string {
  return tr('bookedRefTemplate', locale).replace('{ref}', ref)
}

/** Confirmation invite card: "Send booking link to {name}". */
export function sendBookingLinkToLabel(name: string, locale?: string): string {
  return tr('sendBookingLinkToTemplate', locale).replace('{name}', name)
}

/** Confirmation group block: "{name} (ref {ref})" plus an optional " — host" suffix. */
export function bookedTogetherMemberLabel(
  name: string,
  ref: string,
  isHost: boolean,
  locale?: string,
): string {
  const base = tr('bookedTogetherMemberTemplate', locale).replace('{name}', name).replace('{ref}', ref)
  return isHost ? `${base}${tr('hostSuffixLabel', locale)}` : base
}

/** Confirmation's "Next step: send your group their booking link(s)" heading. */
export function nextStepSendGroupLabel(inviteCount: number, locale?: string): string {
  return inviteCount === 1
    ? tr('nextStepSendGroupLinkSingular', locale)
    : tr('nextStepSendGroupLinkPlural', locale)
}

/** DetailsStep: "Other participants ({n} total)". */
export function otherParticipantsHeading(n: number, locale?: string): string {
  return tr('otherParticipantsTotalTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep: "Add anyone else taking part. You can add up to {n} more." */
export function addAnyoneElseUpTo(n: number, locale?: string): string {
  return tr('addAnyoneElseUpToTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep per-row heading: "Participant {n}". */
export function participantOrdinalLabel(n: number, locale?: string): string {
  return tr('participantOrdinalTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep per-row companion fallback name: "Guest {n}". */
export function companionOrdinalLabel(n: number, locale?: string): string {
  return tr('companionOrdinalTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep companion contact-required error, naming the companion (or a generic fallback). */
export function companionContactRequiredMessage(name: string | undefined, locale?: string): string {
  const who = name && name.trim().length > 0 ? name : tr('themFallback', locale)
  return tr('companionContactRequiredTemplate', locale).replace('{name}', who)
}

/** DetailsStep: "Maximum of {n} guests reached". */
export function maxCompanionsReachedMessage(n: number, locale?: string): string {
  return tr('maxCompanionsReachedTemplate', locale).replace('{n}', String(n))
}

/** CustomFormStep's dev/config-error fallback for an unrecognised field type. */
export function unsupportedFieldTypeLabel(fieldType: string, locale?: string): string {
  return tr('unsupportedFieldTypeTemplate', locale).replace('{type}', fieldType)
}

/** CustomFormStep's "{product} · please complete the form below" subtitle. */
export function productFormSubtitle(productName: string, locale?: string): string {
  return tr('productFormSubtitleTemplate', locale).replace('{product}', productName)
}

/** AccommodationStep additional-accommodation hint when it's mandatory (a shared-double companion needs their own room). */
export function additionalAccommodationRequiredHint(names: string, count: number, locale?: string): string {
  if (isGermanLocale(locale)) {
    const verb = count === 1 ? 'braucht' : 'brauchen'
    return `Zimmer für die Personen, die mit Ihnen reisen. Ihr eigenes Bett ist bereits durch das gemeinsame Doppelzimmer abgedeckt, aber ${names} ${verb} hier ein Zimmer.`
  }
  const verb = count === 1 ? 'needs' : 'need'
  return `Rooms for the people travelling with you. Your own bed is already covered by the shared double room, but ${names} ${verb} a room here.`
}

/** AvailabilityPicker's "Times on {date}" subheading. */
export function timesOnLabel(dateLabel: string, locale?: string): string {
  return tr('timesOnTemplate', locale).replace('{date}', dateLabel)
}

/** AvailabilityPicker's bare "{n} seats" count (operators.expose_seats_to_customer). */
export function seatsCountLabel(n: number, locale?: string): string {
  const t = pickBundle(locale)
  return `${n} ${plural(n, t.seatSingular, t.seatPlural)}`
}

/**
 * landr-5aih0.27: JSX-attribute template-literal strings — the ~15 aria-
 * label/title values the noEnglishLiteral AST guard couldn't see before
 * this ticket extended it to walk JsxAttribute → TemplateExpression (see
 * noEnglishLiteral.test.ts's header). Each of these replaces a raw
 * `` `Some text ${x}` `` attribute value with a bundle-backed call.
 */

/** AddonsList / AccommodationStep quantity-stepper aria-label ("Decrease {item} quantity" / "Increase {item} quantity"). */
export function qtyAdjustAriaLabel(
  direction: 'decrease' | 'increase',
  itemName: string,
  locale?: string,
): string {
  const key = direction === 'decrease' ? 'decreaseQtyAriaTemplate' : 'increaseQtyAriaTemplate'
  return tr(key, locale).replace('{item}', itemName)
}

/** RoomAssignment's static (all-mode) breakfast chip aria-label: "{owner} has breakfast". */
export function ownerHasBreakfastLabel(ownerLabel: string, locale?: string): string {
  return tr('ownerHasBreakfastTemplate', locale).replace('{owner}', ownerLabel)
}

/** RoomAssignment's draggable breakfast chip aria-label — names the owner and the drag affordance. */
export function breakfastDragHintLabel(ownerLabel: string, locale?: string): string {
  return tr('breakfastDragHintTemplate', locale).replace('{owner}', ownerLabel)
}

/** RoomAssignment's room-unit droppable aria-label: "{room} — unit {n}". */
export function roomUnitAriaLabel(roomName: string, unitNumber: number, locale?: string): string {
  return tr('roomUnitAriaTemplate', locale).replace('{room}', roomName).replace('{n}', String(unitNumber))
}

/** RoomAssignment's unassigned-tray inline select aria-label: "Assign {name} to a room". */
export function assignToRoomAriaLabel(name: string, locale?: string): string {
  return tr('assignToRoomTemplate', locale).replace('{name}', name)
}

/** ParticipantLanguageBoard column aria-label: "{language} speakers". */
export function languageSpeakersAriaLabel(languageDisplayName: string, locale?: string): string {
  return tr('languageSpeakersTemplate', locale).replace('{language}', languageDisplayName)
}

/** ParticipantLanguageBoard's "close an empty language column" aria-label: "Remove {language}". */
export function removeLanguageAriaLabel(languageDisplayName: string, locale?: string): string {
  return tr('removeLanguageTemplate', locale).replace('{language}', languageDisplayName)
}

/** RankedLanguagePicker's drag-handle aria-label: "Reorder {language}". */
export function reorderLanguageAriaLabel(languageDisplayName: string, locale?: string): string {
  return tr('reorderLanguageTemplate', locale).replace('{language}', languageDisplayName)
}

/** DetailsStep's per-row remove-participant button aria-label: "Remove participant {n}". */
export function removeParticipantAriaLabel(n: number, locale?: string): string {
  return tr('removeParticipantAriaTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep's per-row remove-companion button aria-label: "Remove companion {n}". */
export function removeCompanionAriaLabel(n: number, locale?: string): string {
  return tr('removeCompanionAriaTemplate', locale).replace('{n}', String(n))
}

/**
 * DetailsStep's "copy from booker" affordance aria-label / title ("Use
 * your email" / "Use your phone"). Named without a `use` prefix
 * (landr-5aih0.27 review fix) — eslint's react-hooks/rules-of-hooks
 * treats any `useXxx`-named function as a Hook and flags a call inside
 * a conditional-return component (CopyFromBookerButton's early `return
 * null`) as a rules-of-hooks violation, even though this is a plain
 * string-lookup helper with no hook behavior at all.
 */
export function copyFromBookerAriaLabel(field: 'email' | 'phone', locale?: string): string {
  const t = pickBundle(locale)
  return field === 'email' ? t.useYourEmailAria : t.useYourPhoneAria
}

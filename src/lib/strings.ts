// Widget chrome strings. pickBundle/tr resolve the customer's resolved locale
// (see src/lib/locale.ts's browserLocale/configureCustomerLocale — invite
// override → operator customer_languages whitelist → browser → operator
// default) to a bundle: en (source, inline here), de (landr-5aih0.9), es and tr
// (landr-8r6oc.4), all lazy-loaded from src/lib/locales/ (landr-8r6oc.18); every
// other locale gets English. No i18n
// library: the bundles are the whole translation layer, extending the
// EN-only pattern landr-ifcu established. Every widget chrome string lives
// here or in a catalog under locales/ (or in a page-scoped sibling — see
// components/booking/approvalReplyStrings.ts and cancelStrings.ts) so a
// language review is one file.

export type Bundle = {
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
  /** aria-label of the dismiss (x) button on the invite notice banner. */
  dismissLabel: string
  /** Placeholder of the shared-double reference-code input. */
  sharedDoubleRefPlaceholder: string
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
  /** landr-bwm91.4: price notes under the product page's "from" price. */
  priceNoteBase: string
  priceNoteWeekends: string
  priceNoteWeekdays: string
  priceNoteStartTemplate: string
  /** landr-soewf: chevron next to a named price note / surcharge row that has a description. */
  priceNoteDetailsShow: string
  priceNoteDetailsHide: string
  // landr-bwm91.7: the "from €X" headline on product cards + the detail page.
  priceFromTemplate: string
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
  // A slot with no start time (the operator confirms the time after booking).
  timeConfirmedByOperator: string
  timeConfirmedHelper: string
  // Staff-only: a plain time_slot product on a day with no times lets the
  // operator type the start time themselves.
  freeStartTimeLabel: string
  freeStartTimeHint: string
  freeStartTimePast: string
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
  dayNoLongerAvailableReason: string
  capacityExceededMessage: string
  slotCapacityExceededMessage: string
  slotStartTimeInvalidMessage: string
  seatsShortOne: string
  seatsShortOther: string
  seatsShortNone: string
  /** landr-rmcsu.5: several selected days are short — "{days} have fewer than {need} seats left." */
  seatsShortDays: string
  /** landr-rmcsu.5: dates-step group-size stepper. */
  partySizeLabel: string
  partySizeDecreaseAria: string
  partySizeIncreaseAria: string
  /** landr-rmcsu.5: "12 dates fit 3 people" / none fit in the loaded window. */
  seatFitCountOne: string
  seatFitCountOther: string
  seatFitNone: string
  seatFitFewerButton: string
  seatFitInquiryButton: string
  /** landr-rmcsu.5: calendar legend for days with too few seats for the group. */
  shortDayLegend: string
  /** landr-rmcsu.7: slot / course-window chip when it has seats, but fewer than the group needs. */
  slotSeatsShort: string
  slotSeatsShortNoCount: string
  /** landr-rmcsu.7: course-window variants of the fit notice. */
  seatFitWindowsOne: string
  seatFitWindowsOther: string
  seatFitNoneWindows: string
  holdHeldOne: string
  holdRequested: string
  holdUntilOnly: string
  holdHeldOther: string
  holdNotHeld: string
  holdTonight: string
  holdToday: string
  holdTomorrow: string
  inviteHoldActive: string
  inviteHoldEnded: string
  readyToContinueWithHostsDates: string
  continueWithTheseDates: string
  changeDates: string
  pickCourse: string
  courseFallbackName: string
  fixedDateWindowAmbiguousMessage: string
  sameDaysAsHostFor: string
  /** Invite banner (App.tsx) — {host}, {ref}. Hotel variant only when the invite prefills a hotel (landr-2jsaf). */
  inviteBannerDatesAndHotel: string
  inviteBannerDatesOnly: string
  inviteBannerOwnAccommodation: string
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
  guideLanguageOthersHint: string
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
  formPersonParticipantTag: string
  formPersonGuestTag: string
  formPersonFallbackName: string
  staffFormCustomerCompletes: string
  staffFormCustomerCompletesHint: string
  staffFormFillInNow: string
  staffFormLetCustomerComplete: string
  staffReviewCustomerCompletes: string
  formPersonSectionHint: string
  formResponsesInvalidIntro: string

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
  enterYourNameEmailPhoneBillingCue: string
  fillInEveryRequiredField: string
  roleLabel: string
  includeYourCountryCode: string
  billingAddressTitle: string
  billingAddressHelper: string
  billingStreetLabel: string
  billingAddressLine2Label: string
  billingPostalCodeLabel: string
  billingCityLabel: string
  billingCountryLabel: string
  billingCountryPlaceholder: string
  billingInvoiceToCompanyLabel: string
  billingInvoiceNameLabel: string
  billingInvoiceNameHint: string
  billingCompanyLabel: string
  billingTaxIdLabel: string
  memberPerkOtpLabel: string
  maxAdditionalParticipantsTemplate: string
  needLargerGroupHint: string
  requestMoreButton: string
  needLargerGroupDialogDescription: string
  othersSharingYourRoom: string
  // landr-wp8e9.2: invite mode + the inviter's room is full -> the legend
  // can no longer promise the companions share a room.
  peopleTravellingWithYou: string
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
  // Stay-kind (apartment / private room) wording: one payer, guests not participants.
  stayOtherGuestsTotalTemplate: string
  stayGuestsTotalTemplate: string
  stayAddGuestAria: string
  stayAddGuestButton: string
  stayMaxAdditionalGuestsTemplate: string
  stayMaxGuestsReachedOne: string
  stayMaxGuestsReachedTemplate: string
  otherParticipantsTotalTemplate: string
  addAnyoneElseUpToTemplate: string
  participantOrdinalTemplate: string
  companionOrdinalTemplate: string
  maxCompanionsReachedTemplate: string
  companionInviteHint: string
  companionOwnAccommodationLabel: string
  companionOwnAccommodationHint: string
  ownAccommodationNoRoomBooked: string
  inviteOwnBookRoomLabel: string
  inviteOwnBookRoomHint: string
  companionContactRequiredTemplate: string
  themFallback: string
  youWillBeListedAsParticipant1: string
  // landr-jiagg.2: "booking for someone else" (booker pays, does not take part).
  bookingForSomeoneElseLabel: string
  addPeopleJoiningBelow: string
  participantsTotalTemplate: string
  sameAsYoursPlaceholder: string
  invoiceToLabel: string
  notTakingPartPaysInvoice: string
  sharedDoubleRequiresBookerMessage: string
  maxParticipantsReachedOne: string
  maxParticipantsReachedTemplate: string
  /** Product switch: the carried party was cut to the new product's cap. */
  alternativePartyClampedTemplate: string
  tooManyPeopleRemoveSomeone: string
  notAMemberOrNoCode: string
  companionsShareAccommodationExplainer: string
  participantsYouPayForHint: string
  guestsPayingForThemselves: string
  guestsPayingForThemselvesExplainer: string
  guestFallbackTemplate: string
  readyToConfirm: string
  /** landr-xpbt2: review step's confirm box label — the final step, not "Next: continue". */
  reviewStepCueLabel: string
  submittingYourBookingEllipsis: string
  sharedDoubleOwnBedNote: string
  joiningActivitySeparateGuiding: string
  notDoingActivity: string
  submittingEllipsis: string
  confirmBookingLabel: string

  // ---- Confirmation ----
  yourBookingTitle: string
  // landr-jsu3n.1: confirmation "Party" block — same groups as the email.
  partyHeading: string
  partyIncludedHeading: string
  partySeparateGuidingHeading: string
  partyGuestsHeading: string
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
  // landr-k9pji.15 — OfferPage's /pay/{token} link is valid for 30 days;
  // the operator may have switched payment_mode away from 'online' since it
  // was sent (POST /initiate then 409s payment_mode_not_online). These
  // replace the generic "payment failed to start" error with the actual
  // instructions for how this booking is now paid.
  payModeNotOnlineTitle: string
  payModeNotOnlinePayOnSite: string
  payModeNotOnlineBankTransfer: string
  payModeNotOnlineGeneric: string
  // landr-t63w0 — /pay page shows the operator's other ticked rails.
  payByBankTransferTitle: string
  bankAccountHolderLabel: string
  bankIbanLabel: string
  bankBicLabel: string
  bankReferenceLabel: string
  bankTransferReferenceHint: string
  payOnSiteAlsoHint: string
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
  changeActivityHint: string
  changeActivityHintNoOperator: string
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
  paymentPageTitle: string
  yourCustomOffer: string
  payModeDescription: string
  offerModeDescription: string
  statusLabel: string
  whatYoureBooking: string
  // landr-1zkp7 — /pay + /offer restyle (dates table, per-line prices, hero)
  offerColItem: string
  /** Footer links on the standalone token pages (offer/pay/cancel/reply). */
  legalImprint: string
  legalPrivacy: string
  offerColDates: string
  offerColLength: string
  offerLengthDaySingular: string
  offerLengthDayPlural: string
  /** Total row under a line booked on non-consecutive days (landr pay page). */
  offerLengthTotalLabel: string
  offerLengthNightSingular: string
  offerLengthNightPlural: string
  offerYourTripWithTemplate: string
  offerHeroWithAccommodation: string
  // landr-8f1sh.4 — custom offer v2: positions, discount row, periods table
  offerColPeriod: string
  offerPeriodArrival: string
  offerPeriodDeparture: string
  offerPerDaySuffix: string
  offerDiscountLabel: string
  offerGroupDiscountTemplate: string
  offerFreeSpotsTemplate: string
  offerFreeLabel: string
  offerPayableAtHotelShort: string
  productsAria: string
  offerParticipantsTitle: string
  offerPriceBreakdownTitle: string
  offerSubtotalLabel: string
  // landr-1l6hl.5: price rows the API explains by `kind` (special price etc.)
  savingSpecialPriceLabel: string
  savingOfferDiscountLabel: string
  savingGroupDiscountLabel: string
  savingFreeSpotsLabel: string
  savingImportedPriceLabel: string
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
  // landr-bo0wd.5 — offer v3: acceptance flow, hotel note, savings layout
  offerAcceptLabel: string
  offerAcceptingEllipsis: string
  offerAcceptErrorTitle: string
  offerAcceptErrorChanged: string
  offerAcceptErrorClosed: string
  offerAcceptErrorGeneric: string
  offerAgreedTitle: string
  offerAgreedDescription: string
  offerAcceptedDescription: string
  offerReviewHotelDescription: string
  offerReviewAcceptDescription: string
  offerHotelNote: string
  offerHotelNoteAfterAccept: string
  offerHotelNoteNow: string
  /** landr-xcyh1.3: the hotel said yes ("Hotel confirmed"). */
  offerHotelConfirmed: string
  offerHotelConfirmedAfterAccept: string
  offerHotelConfirmedAccepted: string
  /** landr-xcyh1.3: the hotel declined, the operator is updating the offer. */
  offerHotelDeclined: string
  offerHotelDeclinedBody: string
  offerSavingsIntroTemplate: string
  offerYouSavePerDayTemplate: string
  offerYouSaveTemplate: string
  offerFreeSpotLabel: string
  offerRegularOnUsTemplate: string
  offerOnUs: string
  offerRegularPriceLabel: string
  offerYourPriceLabel: string
  offerInclTaxTemplate: string
  offerPriceExclTaxLabel: string
  offerTaxAddedTemplate: string
  /** landr-bo0wd.7: same rows with the picked tax's name ({n}, e.g. "IVA"). */
  offerInclTaxNamedTemplate: string
  offerTaxAddedNamedTemplate: string
  offerPaidAtHotelTemplate: string
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
  shopKindPass: string
  passPickTier: string
  passNoTiers: string
  passLoadFailed: string
  passValidityDay: string
  passValidityDays: string
  passValidityWeek: string
  passValiditySeason: string
  passPerGuest: string
  passStartDateLabel: string
  passSeasonStartNote: string
  passGuestsLabel: string
  passGuestNameLabel: string
  passMemberHint: string
  passStaffMemberNote: string
  passStaffNoOperator: string
  passMemberToggle: string
  passMemberSendCode: string
  passMemberCodeSent: string
  passMemberCodeLabel: string
  passMemberApply: string
  passMemberApplied: string
  passMemberFailed: string
  passMemberPriceLabel: string
  passTotalLabel: string
  passBuyCta: string
  passBuying: string
  passCheckoutError: string
  passStartInPast: string
  passTicketsTitle: string
  passTicketsHelp: string
  passEnterDetailsCue: string
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
  /** landr-lmudr.10: a stock-limited add-on with no room left on the chosen dates. */
  addonSoldOut: string
  /** landr-lmudr.19: a whole-unit add-on whose last unit another group has. */
  addonUnitTaken: string
  /** Same, led by the operator's own word for the unit as written — `{unit}`
   *  = "Raft" / "Floß" (never re-cased: German nouns stay capitalised). */
  addonUnitTakenTemplate: string
  /** landr-lmudr.32: the stepper reached the stock left — `{n}` = how many. */
  addonStockLeftTemplate: string
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
  alternativesHeadingDay: string
  alternativesHeadingDays: string
  alternativesHeadingCourses: string
  alternativesHeadingAny: string
  alternativesStartsTemplate: string
  altDayAria: string
  altDayNotOfferedAria: string
  altDayShortAria: string
  altDayFullNotice: string
  altDayNotOfferedNotice: string
  altDayShortNotice: string
  altDayGate: string
  altDayLegend: string
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
  /** landr-xtkae.10: "powered by LANDR" credit line under the widget (plans without branding.remove_powered_by). */
  poweredByLandr: string

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
  stayWindowTemplate: string
  nightSingular: string
  nightPlural: string
  updatingEllipsis: string
  payableDirectlyToHotelCaveat: string
  multiDayRateAppliedHeading: string
  tapToExpand: string
  tapToCollapse: string
  atHotelSuffix: string
  paidToPayeeOnTheDay: string
  paidDirectlyToPayeeCaveat: string
  paidToPayeeSuffix: string
  payeeFallbackLabel: string
  qtyTimesOnlyTemplate: string
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

  // ---- landr-kcxx5.10: customer-completes-forms (/details page + inline offer step), form validation ----
  detailsPageTitle: string
  detailsLoadingTitle: string
  detailsLoadingBody: string
  detailsInvalidTitle: string
  detailsInvalidBody: string
  detailsErrorTitle: string
  detailsErrorBody: string
  detailsRetry: string
  detailsNothingTitle: string
  detailsNothingBody: string
  detailsNothingBodyNoOperator: string
  detailsDoneTitle: string
  detailsDoneBody: string
  detailsDoneBodyNoOperator: string
  detailsIntro: string
  detailsIntroNoOperator: string
  detailsInlineIntro: string
  detailsInlineIntroNoOperator: string
  detailsStepCounter: string
  detailsSubmit: string
  detailsSubmitAndAccept: string
  detailsSaving: string
  detailsConfirmTitle: string
  detailsConfirmBody: string
  detailsConfirmBodyNoOperator: string
  detailsConfirmButton: string
  detailsProblemsTitle: string
  detailsSaveFailed: string
  detailsBookingClosed: string
  fieldRequiredTemplate: string
  fieldMinLengthTemplate: string
  fieldMaxLengthTemplate: string
  fieldInvalidDateTemplate: string
  fieldMinTemplate: string
  fieldMaxTemplate: string
  fieldInvalidFormatTemplate: string
  fieldInvalidOptionTemplate: string
  fieldInvalidValueTemplate: string
  staffCustomerDetailsPending: string
  // landr-8r6oc.4: phrases that used to be locale-branched helpers in this file,
  // now plain bundle fields so a further language is a catalog file only.
  revealLabelCase: 'lower' | 'keep'
  /** Conjunction for a natural-language list ("English, Spanish and German"). */
  listAndWord: string
  daysSelectedOne: string
  daysSelectedOther: string
  optionalRevealAddTemplate: string
  languageStepCueGroup: string
  languageStepCueWhoTemplate: string
  namesPairTemplate: string
  namesAndOthersTemplate: string
  languageStepGateDone: string
  languageStepGateWaitingTemplate: string
  singleDateGateSelected: string
  singleDateGateEmpty: string
  multiDayGateNone: string
  multiDayGateOne: string
  multiDayGateOther: string
  fixedDateWindowGateSelected: string
  fixedDateWindowGateEmpty: string
  availabilityGateTimeSelected: string
  availabilityGateChooseTime: string
  accommodationTooLateTemplate: string
  occupantSingular: string
  occupantPlural: string
  bedSingular: string
  bedPlural: string
  occupancyOverbookTemplate: string
  multiDayDiffSummaryTemplate: string
  multiDayDiffOriginalFallback: string
  multiDayResetToDatesTemplate: string
  multiDayResetToOriginalDates: string
  multiDayResetDroppedOne: string
  multiDayResetDroppedOther: string
  multiDayResetDroppedHostFallback: string
  additionalAccommodationRequiredOne: string
  additionalAccommodationRequiredOther: string
  hostRoomFullOne: string
  hostRoomFullMany: string
  hostRoomFewBedsOne: string
  hostRoomFewBedsOther: string
  inviteRoomBookedTemplate: string
  inviteRoomBookedWhoFallback: string
  inviteRoomLabelTemplate: string
  inviteRoomLabelWhoFallback: string
  inviteRoomHintText: string
  hostRoomFullRequiredHintText: string
  // landr-8r6oc.18: product-kind labels and calendar-day aria words live in the catalog so catalogs.test.ts enforces them.
  shopKindService: string
  shopKindHotelRoom: string
  shopKindSubscription: string
  shopKindDigitalGood: string
  shopKindPhysicalGood: string
  shopKindGiftCard: string
  shopKindFallback: string
  factKindGiftCard: string
  factKindDigitalGood: string
  factKindPhysicalGood: string
  factKindMembership: string
  factKindSubscription: string
  factKindHotelRoom: string
  factKindAddon: string
  calendarDaySelected: string
  calendarDayAdded: string
  calendarDayRemoved: string
  // Standalone stays (range picker, price breakdown, add-on units).
  stayPickerTitle: string
  stayPickerCue: string
  stayTimesTemplate: string
  staySpanTemplate: string
  stayMinNightsTemplate: string
  stayGateEmpty: string
  stayGateCheckOut: string
  stayErrInvalidRange: string
  stayErrNotContiguous: string
  stayErrCheckInPast: string
  stayErrBelowMin: string
  stayErrAboveMax: string
  stayErrTooManyGuests: string
  stayErrBlockedTemplate: string
  stayErrTakenTemplate: string
  cleaningFeeLabel: string
  stayNightsTimesRateTemplate: string
  perGuestSuffix: string
  perGuestNightSuffix: string
  perStaySuffix: string
  addonUnitsTimesRateTemplate: string
  // Add more to this booking (review-step cross-sell)
  addMoreTitle: string
  addMoreIntro: string
  addMoreRemove: string
  addMoreDates: string
  addMoreNights: string
  addMoreRemoveDay: string
  addMoreDate: string
  addMoreNoTimes: string
  addMorePickTime: string
  addMorePickWindow: string
  addMoreNoWindows: string
  addMoreQuantity: string
  addMoreForGroup: string
  addMoreChecking: string
  addMoreUnavailable: string
  addMoreNoDays: string
  addMoreIncomplete: string
  addMoreModuleSave: string
  addMoreModuleDone: string
  addMoreModuleChange: string
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
  dismissLabel: 'Dismiss',
  sharedDoubleRefPlaceholder: 'e.g. A1B2C3D4',
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
  priceNoteBase: 'Base price {amount}',
  priceNoteWeekends: 'Weekends',
  priceNoteWeekdays: 'Weekdays',
  priceNoteStartTemplate: '{time} start',
  priceNoteDetailsShow: 'Show details about {name}',
  priceNoteDetailsHide: 'Hide details about {name}',
  priceFromTemplate: 'from {price}',
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
  timeConfirmedByOperator: 'Time confirmed by the operator',
  timeConfirmedHelper: 'The operator will confirm the exact time and details after you book.',
  freeStartTimeLabel: 'Start time',
  freeStartTimeHint: 'No set times on this day. Enter the start time (HH:MM).',
  freeStartTimePast: 'That time has already passed today.',
  timesOnTemplate: 'Times on {date}',
  seatSingular: 'seat',
  seatPlural: 'seats',
  selectedDateTemplate: 'Selected: {date}',

  pickACourseWindow: 'Pick a course window',
  couldNotLoadCourseWindows: 'Could not load course windows.',
  loadingWindows: 'Loading available dates…',
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
  dayNoLongerAvailableReason: '{date} is no longer available — remove it to continue.',
  capacityExceededMessage:
    'Sorry, there is not enough space left for your booking on one of your dates. Please change your dates and try again.',
  slotCapacityExceededMessage:
    'Sorry, there is not enough space left at that start time. Please pick another time and try again.',
  slotStartTimeInvalidMessage:
    'Sorry, that start time is no longer available. Please pick another time and try again.',
  seatsShortOne: 'Only 1 seat left on {day} — you need {need}.',
  seatsShortOther: 'Only {n} seats left on {day} — you need {need}.',
  seatsShortNone: 'No seats left on {day} — you need {need}.',
  seatsShortDays: '{days} have fewer than {need} seats left.',
  partySizeLabel: 'How many of you?',
  partySizeDecreaseAria: 'One person fewer',
  partySizeIncreaseAria: 'One person more',
  seatFitCountOne: '1 date fits {n} people',
  seatFitCountOther: '{count} dates fit {n} people',
  seatFitNone: 'No dates with room for {n} people in {range}.',
  seatFitFewerButton: 'Fewer people',
  seatFitInquiryButton: 'Ask for a group booking',
  shortDayLegend: 'Not enough seats for your group',
  slotSeatsShort: 'Only {n} left (you need {need})',
  slotSeatsShortNoCount: 'Not enough seats for {need}',
  seatFitWindowsOne: '1 course date fits {n} people',
  seatFitWindowsOther: '{count} course dates fit {n} people',
  seatFitNoneWindows: 'No upcoming course dates with room for {n} people.',
  holdUntilOnly:
    'When you booked, seats for {name} were still free. Held until {when}.',
  holdRequested:
    'Seats for {name} are requested and held for {n} hours, until {when}. The operator still has to confirm that everyone fits.',
  holdHeldOne:
    'When you booked, seats for {name} were still free. Held for 1 hour, until {when}.',
  holdHeldOther:
    'When you booked, seats for {name} were still free. Held for {n} hours, until {when}.',
  holdNotHeld: 'Seats for {name} are not held — they can book while seats last.',
  holdTonight: 'tonight',
  holdToday: 'today at {time}',
  holdTomorrow: 'tomorrow at {time}',
  inviteHoldActive: 'Your seat is held until {when}.',
  inviteHoldEnded:
    'The hold on your seat has ended — you can still book while seats last.',
  readyToContinueWithHostsDates: "Ready to continue with the host's dates.",
  continueWithTheseDates: 'Continue with these dates',
  changeDates: 'Change dates',
  pickCourse: 'Pick a course',
  courseFallbackName: 'Course {n}',
  fixedDateWindowAmbiguousMessage:
    'More than one course starts on this day. Please go back and pick the course you want.',
  sameDaysAsHostFor: 'The same days as {host} for {product}.',
  inviteBannerDatesAndHotel:
    'You’re joining {host}’s booking (ref {ref}). Dates and hotel are prefilled — change anything that differs for you.',
  inviteBannerDatesOnly:
    'You’re joining {host}’s booking (ref {ref}). Dates are prefilled — change anything that differs for you.',
  inviteBannerOwnAccommodation:
    'You’re joining {host}’s booking (ref {ref}). Dates are prefilled. No room is booked for you there — choose guiding only, or book a room with us.',
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
  guideLanguageOthersHint:
    'Other participants will choose their own language when they make their own booking.',
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
  formPersonParticipantTag: 'Participant',
  formPersonGuestTag: 'Guest',
  formPersonFallbackName: 'Person',
  staffFormCustomerCompletes: 'Customer completes this via their booking link ✓',
  staffFormCustomerCompletesHint: 'They will be asked for these answers after you add the booking.',
  staffFormFillInNow: 'Fill in now instead',
  staffFormLetCustomerComplete: 'Let the customer complete this instead',
  staffReviewCustomerCompletes: 'Customer completes:',
  formPersonSectionHint: 'Please answer for each person.',
  formResponsesInvalidIntro: 'Some answers in the form need fixing. Please go back to the form and correct:',

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
  enterYourNameEmailPhoneBillingCue: 'enter your name, email, phone and billing address',
  fillInEveryRequiredField: 'Fill in every required field to continue.',
  roleLabel: 'Role',
  includeYourCountryCode: 'Include your country code',
  billingAddressTitle: 'Billing address',
  billingAddressHelper: 'We need this for your invoice.',
  billingStreetLabel: 'Street and number',
  billingAddressLine2Label: 'Address line 2 (optional)',
  billingPostalCodeLabel: 'Postal code',
  billingCityLabel: 'City',
  billingCountryLabel: 'Country',
  billingCountryPlaceholder: '— select a country —',
  billingInvoiceToCompanyLabel: 'Invoice to a company?',
  billingInvoiceNameLabel: 'Invoice name (optional)',
  billingInvoiceNameHint: 'Only if the invoice should be made out to a different name than yours.',
  billingCompanyLabel: 'Company',
  billingTaxIdLabel: 'Tax ID (NIF / VAT)',
  memberPerkOtpLabel: 'Member? Enter the 6-digit code we emailed you to apply your member price.',
  maxAdditionalParticipantsTemplate: 'Maximum of {n} additional participants reached',
  needLargerGroupHint: 'Need a larger group or a custom booking?',
  requestMoreButton: 'Request more',
  needLargerGroupDialogDescription:
    "Need a larger group or a custom booking? Send us the details and we'll be in touch.",
  othersSharingYourRoom: 'Others sharing your room',
  peopleTravellingWithYou: 'People travelling with you',
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
  guidingOnlyLabel: 'Guiding only — I will take care of accommodation myself',
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
  stayOtherGuestsTotalTemplate: 'Other guests ({n} total)',
  stayGuestsTotalTemplate: 'Guests ({n} total)',
  stayAddGuestAria: 'Add guest',
  stayAddGuestButton: '+ Add guest',
  stayMaxAdditionalGuestsTemplate: 'Maximum of {n} additional guests reached',
  stayMaxGuestsReachedOne: 'Maximum of 1 guest reached',
  stayMaxGuestsReachedTemplate: 'Maximum of {n} guests reached',
  otherParticipantsTotalTemplate: 'Other participants ({n} total)',
  addAnyoneElseUpToTemplate: 'Add anyone else taking part. You can add up to {n} more.',
  participantOrdinalTemplate: 'Participant {n}',
  companionOrdinalTemplate: 'Guest {n}',
  maxCompanionsReachedTemplate: 'Maximum of {n} guests reached',
  companionInviteHint: "We'll use this to send them their own booking link.",
  companionOwnAccommodationLabel: 'Arranges own accommodation (no room booked through us)',
  companionOwnAccommodationHint:
    'No room is booked for them in this booking. Their invite link lets them book guiding only or a room of their own.',
  ownAccommodationNoRoomBooked: 'own accommodation — no room booked',
  inviteOwnBookRoomLabel: 'Book a room with us',
  inviteOwnBookRoomHint: 'Pick a hotel and a room of your own. The hotel of the person who invited you is preselected.',
  companionContactRequiredTemplate: 'We need an email or phone number to send {name} their booking link',
  themFallback: 'them',
  youWillBeListedAsParticipant1:
    "You'll be listed as participant 1. Add more people below if others are joining.",
  bookingForSomeoneElseLabel: "I'm booking for someone else and won't take part",
  addPeopleJoiningBelow: 'Add the people who are joining below.',
  participantsTotalTemplate: 'Participants ({n} total)',
  sameAsYoursPlaceholder: 'same as yours',
  invoiceToLabel: 'Invoice to:',
  notTakingPartPaysInvoice: 'Not taking part · pays the invoice',
  maxParticipantsReachedOne: 'Maximum of 1 participant reached',
  maxParticipantsReachedTemplate: 'Maximum of {n} participants reached',
  alternativePartyClampedTemplate: '{name} takes up to {n} people, so the group was reduced to {n}.',
  tooManyPeopleRemoveSomeone:
    'There are more people than this activity allows — remove someone to continue.',
  sharedDoubleRequiresBookerMessage:
    'A shared double room covers your own bed, so you can only pick it when you take part yourself. Please go back to accommodation and choose another option.',
  notAMemberOrNoCode:
    "Not a member, or don't have a code? Leave this blank — it won't affect your booking.",
  participantsYouPayForHint: "People you're booking and paying for.",
  guestsPayingForThemselves: 'Guests paying for themselves',
  guestsPayingForThemselvesExplainer:
    "Joining the activity but booking and paying for their own spot. We'll send them a link to complete their booking — they're not added to your price.",
  companionsShareAccommodationExplainer:
    'Anyone else sharing your accommodation — partners, friends, family members, or fellow activity ' +
    "participants who book and pay for their own guiding separately. They're added to the hotel headcount " +
    "and room assignment, but not to this booking's activity or price.",
  guestFallbackTemplate: 'Guest {n}',
  readyToConfirm: 'Ready to confirm.',
  reviewStepCueLabel: 'Last step: confirm your booking',
  submittingYourBookingEllipsis: 'Submitting your booking…',
  sharedDoubleOwnBedNote: 'Your own bed is the shared double room booked by the host.',
  joiningActivitySeparateGuiding: 'joining the activity (separate guiding)',
  notDoingActivity: 'not doing the activity',
  submittingEllipsis: 'Submitting…',
  confirmBookingLabel: 'Confirm booking',

  yourBookingTitle: 'Your booking',
  partyHeading: 'Party',
  partyIncludedHeading: 'Participants (included in this booking)',
  partySeparateGuidingHeading: 'Joining the activity — separate guiding booking',
  partyGuestsHeading: 'Not doing the activity (guests)',
  priceBreakdownTitle: 'Price breakdown',
  atHotelPayAtCheckin: 'At hotel · pay at check-in',
  referenceLabel: 'Reference',
  addToGoogleCalendarAria: 'Add to Google Calendar',
  addToOutlookCalendarAria: 'Add to Outlook Calendar',
  copyLinkLabel: 'Copy link',
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  couldNotCopyAutomatically: "Couldn't copy automatically — select and copy:",
  shareReferenceHint: 'Share this reference with anyone booking the same activity who wants to be grouped with you.',
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
  payModeNotOnlineTitle: 'This booking is no longer paid online',
  payModeNotOnlinePayOnSite: 'Please pay on the day, at the meeting point.',
  payModeNotOnlineBankTransfer: 'Please pay by bank transfer — details are in your confirmation email.',
  payModeNotOnlineGeneric: 'Online payment is no longer available for this booking. Please contact the operator about how to pay.',
  payByBankTransferTitle: 'Pay by bank transfer',
  bankAccountHolderLabel: 'Account holder',
  bankIbanLabel: 'IBAN',
  bankBicLabel: 'BIC',
  bankReferenceLabel: 'Reference',
  bankTransferReferenceHint: 'Please quote the reference so we can match your transfer.',
  payOnSiteAlsoHint: 'You can also pay on site, on the day.',
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
  changeActivityHint: 'Want a different activity? Contact {operator} to change it.',
  changeActivityHintNoOperator: 'Want a different activity? Contact the operator to change it.',
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
  paymentPageTitle: 'Payment site',
  yourCustomOffer: 'Your custom offer',
  payModeDescription: 'Your booking is confirmed. Pay the outstanding balance below to secure it.',
  offerModeDescription: 'Review the details below and click Accept & Pay to confirm your booking.',
  statusLabel: 'Status:',
  whatYoureBooking: "What you're booking",
  offerColItem: 'Item',
  legalImprint: 'Imprint',
  legalPrivacy: 'Privacy Policy',
  offerColDates: 'Dates',
  offerColLength: 'Length',
  offerLengthDaySingular: '{n} day',
  offerLengthDayPlural: '{n} days',
  offerLengthTotalLabel: 'Total',
  offerLengthNightSingular: '{n} night',
  offerLengthNightPlural: '{n} nights',
  offerYourTripWithTemplate: 'Your trip with {operator}',
  offerHeroWithAccommodation: 'with accommodation',
  offerColPeriod: 'Period',
  offerPeriodArrival: 'Arrival',
  offerPeriodDeparture: 'Departure',
  offerPerDaySuffix: '/day',
  offerDiscountLabel: 'Your discount',
  offerGroupDiscountTemplate: 'Group discount ({pct} %)',
  offerFreeSpotsTemplate: 'Free spots × {n}',
  offerFreeLabel: 'Free',
  offerPayableAtHotelShort: 'payable at the hotel',
  productsAria: 'Products',
  offerParticipantsTitle: 'Participants',
  offerPriceBreakdownTitle: 'Price breakdown',
  offerSubtotalLabel: 'Subtotal',
  savingSpecialPriceLabel: 'Special price (agreed)',
  savingOfferDiscountLabel: 'Offer discount',
  savingGroupDiscountLabel: 'Group discount',
  savingFreeSpotsLabel: 'Free spots',
  savingImportedPriceLabel: 'Imported price',
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
  offerAcceptLabel: 'Accept offer',
  offerAcceptingEllipsis: 'Accepting…',
  offerAcceptErrorTitle: 'Could not accept the offer',
  offerAcceptErrorChanged: 'The operator changed this offer after the link was sent. Please open the link in your latest email.',
  offerAcceptErrorClosed: 'This booking is no longer open.',
  offerAcceptErrorGeneric: 'We could not record your acceptance. Please try again or contact us.',
  offerAgreedTitle: 'Your booking as agreed',
  offerAgreedDescription: 'This is your booking as we agreed it, so there is nothing for you to accept.',
  offerAcceptedDescription: 'You have accepted this offer.',
  offerReviewHotelDescription: 'Review the details below. You can accept the offer now; we send your confirmation and payment link as soon as the hotel confirms.',
  offerReviewAcceptDescription: 'Review the details below and click Accept offer to confirm your booking.',
  offerHotelNote: 'Your offer becomes valid once the hotel confirms your dates.',
  offerHotelNoteAfterAccept: 'You can accept now — we send your confirmation and payment link as soon as the hotel confirms.',
  offerHotelNoteNow: 'You have accepted. We are waiting for the hotel; we send your confirmation and payment link as soon as it confirms.',
  offerHotelConfirmed: 'Hotel confirmed',
  offerHotelConfirmedAfterAccept: 'The hotel has confirmed your rooms. Accept the offer to get your confirmation and payment link.',
  offerHotelConfirmedAccepted: 'The hotel has confirmed your rooms.',
  offerHotelDeclined: 'We are updating your offer.',
  offerHotelDeclinedBody: 'The hotel could not confirm these rooms. We will send you an updated offer shortly. Nothing is due now.',
  offerSavingsIntroTemplate: 'You save {x} compared to our regular prices.',
  offerYouSavePerDayTemplate: 'You save {a} per day · {b}',
  offerYouSaveTemplate: 'You save {b}',
  offerFreeSpotLabel: 'Free spot',
  offerRegularOnUsTemplate: 'Regular price {x} — on us',
  offerOnUs: 'On us',
  offerRegularPriceLabel: 'Regular price',
  offerYourPriceLabel: 'Your price',
  offerInclTaxTemplate: 'incl. {a} tax ({p} %)',
  offerPriceExclTaxLabel: 'Price excl. tax',
  offerTaxAddedTemplate: '+ {a} tax ({p} %)',
  offerInclTaxNamedTemplate: 'incl. {a} {n} ({p} %)',
  offerTaxAddedNamedTemplate: '+ {a} {n} ({p} %)',
  offerPaidAtHotelTemplate: '+ {a} paid at the hotel on arrival',
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
  shopKindPass: 'pass',
  passPickTier: 'Choose your pass',
  passNoTiers: 'No passes are on sale right now.',
  passLoadFailed: 'Passes could not be loaded. Please try again.',
  passValidityDay: 'Valid for 1 day',
  passValidityDays: 'Valid for {n} days',
  passValidityWeek: 'Valid for 7 days',
  passValiditySeason: 'Valid {from} – {until}',
  passPerGuest: '{price} per guest',
  passStartDateLabel: 'Start date',
  passSeasonStartNote: 'A season pass is valid for the whole season.',
  passGuestsLabel: 'Guests',
  passGuestNameLabel: 'Guest {n}: first and last name',
  passMemberHint: 'Members pay less on this pass.',
  passStaffMemberNote: 'The member price applies automatically when this email belongs to an active member.',
  passStaffNoOperator: 'Could not determine the operator for this staff booking. Reopen the booking modal and try again.',
  passMemberToggle: 'I am a member',
  passMemberSendCode: 'Email me a code',
  passMemberCodeSent: 'If this address belongs to a member, a code is on its way.',
  passMemberCodeLabel: 'Code from your email',
  passMemberApply: 'Apply member price',
  passMemberApplied: 'Member price applied',
  passMemberFailed: 'That code did not work. Request a new one.',
  passMemberPriceLabel: 'Member price',
  passTotalLabel: 'Total',
  passBuyCta: 'Book pass',
  passBuying: 'Booking…',
  passCheckoutError: 'We could not book your pass. Please check your details and try again.',
  passStartInPast: 'Pick today or a later start date.',
  passTicketsTitle: 'Your pass tickets',
  passTicketsHelp: 'Show this QR code at the entrance. Valid {from} – {until}.',
  passEnterDetailsCue: 'enter your name, email, phone and billing address',
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
  addonSoldOut: 'Sold out for your dates.',
  addonUnitTaken: 'Reserved for another group on your dates.',
  addonUnitTakenTemplate: '{unit}: fully reserved for another group on your dates.',
  addonStockLeftTemplate: 'Only {n} left for your dates.',
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
  alternativesHeadingDay: 'Also available on this day',
  alternativesHeadingDays: 'Also available on these days',
  alternativesHeadingCourses: 'Also starting in {month}',
  alternativesHeadingAny: 'Also available',
  alternativesStartsTemplate: 'Starts {date}',
  altDayAria: 'fully booked, other activities available',
  altDayNotOfferedAria: 'not offered, other activities available',
  altDayShortAria: 'not enough places for {n} people, other activities available',
  altDayFullNotice: '{product} is fully booked on {date}',
  altDayNotOfferedNotice: '{product} is not offered on {date}',
  altDayShortNotice: '{product} has too few seats left for your group on {date}',
  altDayGate: 'Pick one of the other activities below',
  altDayLegend: 'another activity is free on this day',
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
  poweredByLandr: 'Powered by LANDR',

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
  stayWindowTemplate: 'Check-in {checkIn} – Check-out {checkOut} ({nights} {nightWord})',
  nightSingular: 'night',
  nightPlural: 'nights',
  updatingEllipsis: 'Updating…',
  payableDirectlyToHotelCaveat: 'Paid directly to the hotel at check-in. Not included in your booking total.',
  multiDayRateAppliedHeading: 'Multi-day rate applied',
  tapToExpand: 'Tap to expand',
  tapToCollapse: 'Tap to collapse',
  atHotelSuffix: 'at hotel',
  paidToPayeeOnTheDay: 'Paid to your {payee} · on the day',
  paidDirectlyToPayeeCaveat: 'Paid directly to your {payee}. Not included in your booking total.',
  paidToPayeeSuffix: 'to your {payee}',
  payeeFallbackLabel: 'guide',
  qtyTimesOnlyTemplate: '{qty} ×',
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

  // ---- landr-kcxx5.10 ----
  detailsPageTitle: 'Your details',
  detailsLoadingTitle: 'Loading your questions…',
  detailsLoadingBody: 'One moment, please.',
  detailsInvalidTitle: 'This link is no longer valid',
  detailsInvalidBody:
    'The link may have expired or been replaced. Please contact the company you booked with.',
  detailsErrorTitle: 'Something went wrong',
  detailsErrorBody: 'We could not load your questions. Please try again in a moment.',
  detailsRetry: 'Try again',
  detailsNothingTitle: 'Nothing to complete',
  detailsNothingBody: 'There is nothing left for you to fill in. {operator} already has everything they need.',
  detailsNothingBodyNoOperator: 'There is nothing left for you to fill in. The organiser already has everything they need.',
  detailsDoneTitle: 'Thanks — your details are saved',
  detailsDoneBody: 'We have passed them on to {operator}. You can close this page.',
  detailsDoneBodyNoOperator: 'We have passed them on. You can close this page.',
  detailsIntro: 'Please answer the questions below for your booking with {operator}.',
  detailsIntroNoOperator: 'Please answer the questions below for your booking.',
  detailsInlineIntro: 'Before you accept, {operator} needs a few details from you.',
  detailsInlineIntroNoOperator: 'Before you accept, we need a few details from you.',
  detailsStepCounter: 'Form {n} of {total}',
  detailsSubmit: 'Submit',
  detailsSubmitAndAccept: 'Save and accept',
  detailsSaving: 'Saving…',
  detailsConfirmTitle: 'No questions left to answer',
  detailsConfirmBody: 'The questions for this booking are no longer needed. Confirm to let {operator} know.',
  detailsConfirmBodyNoOperator: 'The questions for this booking are no longer needed. Confirm to let the organiser know.',
  detailsConfirmButton: 'Confirm',
  detailsProblemsTitle: 'Please check these answers',
  detailsSaveFailed: 'We could not save your details. Please try again.',
  detailsBookingClosed: 'This booking is closed, so details can no longer be added.',
  fieldRequiredTemplate: '{label} is required.',
  fieldMinLengthTemplate: '{label} must be at least {n} characters.',
  fieldMaxLengthTemplate: '{label} must be at most {n} characters.',
  fieldInvalidDateTemplate: '{label} must be a valid date.',
  fieldMinTemplate: '{label} must be at least {n}.',
  fieldMaxTemplate: '{label} must be at most {n}.',
  fieldInvalidFormatTemplate: '{label} has an invalid format.',
  fieldInvalidOptionTemplate: '{label} contains an invalid option.',
  fieldInvalidValueTemplate: '{label} has an invalid value.',
  staffCustomerDetailsPending: 'The customer still has to complete their details — we sent them the link.',
  // landr-8r6oc.4 (locale-branched helper phrases)
  revealLabelCase: 'lower',
  listAndWord: 'and',
  daysSelectedOne: '{n} day selected',
  daysSelectedOther: '{n} days selected',
  optionalRevealAddTemplate: 'Add {thing}',
  languageStepCueGroup: 'tap the language your group speaks',
  languageStepCueWhoTemplate: 'pick a language for {who}',
  namesPairTemplate: '{first} and {second}',
  namesAndOthersTemplate: '{first} and {n} others',
  languageStepGateDone: 'Everyone has a language.',
  languageStepGateWaitingTemplate: 'Assign every participant to a language — still waiting on {names}.',
  singleDateGateSelected: 'Date selected.',
  singleDateGateEmpty: 'Choose a date to continue.',
  multiDayGateNone: 'Choose at least one date to continue.',
  multiDayGateOne: '1 date selected.',
  multiDayGateOther: '{n} dates selected.',
  fixedDateWindowGateSelected: 'Window selected.',
  fixedDateWindowGateEmpty: 'Choose a window to continue.',
  availabilityGateTimeSelected: 'Time selected.',
  availabilityGateChooseTime: 'Choose a time to continue.',
  accommodationTooLateTemplate: 'You can still book this date — the activity is available. Booking a hotel stay is no longer possible for this date, though: check-in would have needed to be on {date}.',
  occupantSingular: 'person',
  occupantPlural: 'people',
  bedSingular: 'bed',
  bedPlural: 'beds',
  occupancyOverbookTemplate: 'You have {occupants} {occupantWord} but only {beds} {bedWord} — sure?',
  multiDayDiffSummaryTemplate: '+{added} {addedWord} / −{removed} {removedWord} vs {original}',
  multiDayDiffOriginalFallback: 'the original booking',
  multiDayResetToDatesTemplate: 'Reset to {name}’s dates',
  multiDayResetToOriginalDates: 'Reset to the original’s dates',
  multiDayResetDroppedOne: '{n} of {name}\'s days is no longer available.',
  multiDayResetDroppedOther: '{n} of {name}\'s days are no longer available.',
  multiDayResetDroppedHostFallback: 'the host',
  additionalAccommodationRequiredOne: 'Rooms for the people travelling with you. Your own bed is already covered by the shared double room, but {names} needs a room here.',
  additionalAccommodationRequiredOther: 'Rooms for the people travelling with you. Your own bed is already covered by the shared double room, but {names} need a room here.',
  hostRoomFullOne: 'The room you\'re sharing is full — add a room for the person travelling with you.',
  hostRoomFullMany: 'The room you\'re sharing is full — add a room for the people travelling with you.',
  hostRoomFewBedsOne: 'Only 1 more bed is free in the room you\'re sharing — add a room for the rest of the people travelling with you.',
  hostRoomFewBedsOther: 'Only {n} more beds are free in the room you\'re sharing — add a room for the rest of the people travelling with you.',
  inviteRoomBookedTemplate: 'Your room is already booked by {who}{room}. You will be collected from the hotel.',
  inviteRoomBookedWhoFallback: 'the person who invited you',
  inviteRoomLabelTemplate: 'My room is booked by {who}',
  inviteRoomLabelWhoFallback: 'the person who invited me',
  inviteRoomHintText: 'Your bed is in the room the person who invited you already booked. You are collected from the hotel.',
  hostRoomFullRequiredHintText: 'Rooms for the people travelling with you. Your own bed is already covered by the shared double room, but there is no space left in it for anyone else.',
  shopKindService: 'service',
  shopKindHotelRoom: 'hotel room',
  shopKindSubscription: 'subscription',
  shopKindDigitalGood: 'digital product',
  shopKindPhysicalGood: 'physical product',
  shopKindGiftCard: 'gift card',
  shopKindFallback: 'product',
  factKindGiftCard: 'Gift card',
  factKindDigitalGood: 'Digital good',
  factKindPhysicalGood: 'Physical good',
  factKindMembership: 'Membership',
  factKindSubscription: 'Subscription',
  factKindHotelRoom: 'Hotel room',
  factKindAddon: 'Addon',
  calendarDaySelected: 'selected',
  calendarDayAdded: 'added',
  calendarDayRemoved: 'removed',
  // Standalone stays.
  stayPickerTitle: 'Choose your dates',
  stayPickerCue: 'Pick your check-in day, then your check-out day.',
  stayTimesTemplate: 'Check-in from {checkIn} · check-out by {checkOut}',
  staySpanTemplate: '{from} → {to}, {nights} {nightWord}',
  stayMinNightsTemplate: 'Minimum stay: {count} {nightWord}',
  stayGateEmpty: 'Choose a check-in and a check-out date to continue.',
  stayGateCheckOut: 'Now choose your check-out date.',
  stayErrInvalidRange: 'Pick a check-out date after the check-in date.',
  stayErrNotContiguous: 'A stay must cover every night between check-in and check-out.',
  stayErrCheckInPast: 'The check-in date has already passed.',
  stayErrBelowMin: 'This stay needs more nights.',
  stayErrAboveMax: 'This stay allows fewer nights.',
  stayErrTooManyGuests: 'This place sleeps fewer guests than selected.',
  stayErrBlockedTemplate: 'The night of {date} is not available.',
  stayErrTakenTemplate: 'The night of {date} is already booked.',
  cleaningFeeLabel: 'Cleaning fee',
  stayNightsTimesRateTemplate: '{nights} {nightWord} × {rate}',
  perGuestSuffix: '/ guest',
  perGuestNightSuffix: '/ guest / night',
  perStaySuffix: '/ stay',
  addonUnitsTimesRateTemplate: '{units} × {rate} {suffix}',
  addMoreTitle: 'Add more to this booking',
  addMoreIntro: 'Book another product for the same dates, in one go.',
  addMoreRemove: 'Remove',
  addMoreDates: 'Dates',
  addMoreNights: 'Nights',
  addMoreRemoveDay: 'Remove {date}',
  addMoreDate: 'Date',
  addMoreNoTimes: 'No times left on {date}. Pick another date.',
  addMorePickTime: 'Pick a time.',
  addMorePickWindow: 'Course dates',
  addMoreNoWindows: 'No course dates with free places.',
  addMoreQuantity: 'Quantity',
  addMoreForGroup: 'priced for your group of {count}',
  addMoreChecking: 'Checking availability…',
  addMoreUnavailable: 'Not available on {dates}. Remove these dates or this product.',
  addMoreNoDays: 'No dates left for this product. Remove it or pick a date.',
  addMoreIncomplete: 'Finish or remove the added products before confirming.',
  addMoreModuleSave: 'Save',
  addMoreModuleDone: '{title} saved',
  addMoreModuleChange: 'Change',
}

/**
 * Language registry. A further language is a catalog file under
 * src/lib/locales/ (a full `Bundle`, enforced by the type) plus one loader
 * line here: no component or helper changes (landr-8r6oc.4).
 *
 * English is the source catalog and stays inline: it is the fallback for every
 * unsupported or not-yet-loaded language. Every other catalog is a dynamic
 * import (landr-8r6oc.18), so a visitor downloads only the one language they
 * read instead of all four (de/es/it/tr add ~150 kB raw to the main chunk).
 * `loadUiCatalog` fetches the resolved language ahead of the first render
 * (main.tsx) and again once the operator's language rules or an invite
 * resolve (App.tsx). Until a catalog is in, `pickBundle` hands out English:
 * never blank, never a throw (the widget has no error boundary).
 */
const CATALOG_LOADERS: Record<string, () => Promise<Bundle>> = {
  de: () => import('./locales/de').then((m) => m.de),
  es: () => import('./locales/es').then((m) => m.es),
  tr: () => import('./locales/tr').then((m) => m.tr),
  it: () => import('./locales/it').then((m) => m.it),
}

/** Catalogs in memory; `en` is always present. */
const LOADED: Record<string, Bundle> = { en }
const IN_FLIGHT = new Map<string, Promise<void>>()

// landr-8r6oc.26: a catalog that lands after first render (slow network, past
// the wait deadline) must repaint. `pickBundle` is a plain function, not React
// state, so App subscribes to this counter (useSyncExternalStore) and re-renders
// once per catalog that lands.
let catalogVersion = 0
const CATALOG_LISTENERS = new Set<() => void>()

/** Monotonic counter, bumped each time a catalog lands in memory. */
export function getUiCatalogVersion(): number {
  return catalogVersion
}

/** Subscribe to catalog arrivals; returns the unsubscribe function. */
export function subscribeUiCatalogs(listener: () => void): () => void {
  CATALOG_LISTENERS.add(listener)
  return () => {
    CATALOG_LISTENERS.delete(listener)
  }
}

/** Languages that have a real bundle; everything else falls back to English. */
export const SUPPORTED_UI_LANGUAGES: readonly string[] = ['en', ...Object.keys(CATALOG_LOADERS)]

/** The bundle's language code for any BCP-47-ish tag ('de-AT', 'ES', 'tr_TR', …); 'en' when unsupported. */
export function resolveUiLanguage(locale?: string): string {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? ''
  return SUPPORTED_UI_LANGUAGES.includes(base) ? base : 'en'
}

/**
 * Fetch the catalog for `locale`'s resolved UI language so a following
 * `pickBundle(locale)` returns it. Resolves (never rejects) once the catalog
 * is in memory, the load failed, or `maxWaitMs` (default 3 s) passed: English
 * keeps rendering in those last two cases. A load that outlives `maxWaitMs`
 * still lands afterwards and notifies `subscribeUiCatalogs` listeners. A failed
 * load is not guaranteed to be retried by a later call: browsers cache a failed
 * module fetch in the module map, so the same chunk may fail again until reload.
 */
export function loadUiCatalog(locale?: string, maxWaitMs = 3000): Promise<void> {
  const lang = resolveUiLanguage(locale)
  const loader = CATALOG_LOADERS[lang]
  if (!loader || LOADED[lang]) return Promise.resolve()
  let pending = IN_FLIGHT.get(lang)
  if (!pending) {
    pending = loader()
      .then((bundle) => {
        LOADED[lang] = bundle
        catalogVersion += 1
        CATALOG_LISTENERS.forEach((listener) => listener())
      })
      .catch(() => {
        // Offline / chunk 404 after a deploy: stay on English.
      })
      .finally(() => {
        IN_FLIGHT.delete(lang)
      })
    IN_FLIGHT.set(lang, pending)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, maxWaitMs)
  })
  return Promise.race([pending, deadline]).finally(() => clearTimeout(timer))
}

/** Load every registered catalog (tests that exercise several languages). */
export function loadAllUiCatalogs(): Promise<void> {
  return Promise.all(SUPPORTED_UI_LANGUAGES.map((l) => loadUiCatalog(l))).then(() => undefined)
}

/**
 * Resolve an arbitrary BCP-47-ish locale string ('de-AT', 'DE', 'es-ES',
 * 'tr-TR', …) to a supported bundle (en, de, es, it, tr); every other language,
 * including an absent locale, falls back to English, as does a supported
 * language whose catalog has not loaded (yet). Mirrors
 * approvalReplyStrings.ts's normalizeReplyLocale base/case-fold rule so the
 * two locale layers agree on how a tag is read.
 */
export function pickBundle(locale?: string): Bundle {
  return LOADED[resolveUiLanguage(locale)] ?? en
}

export function tr(key: keyof Bundle, locale?: string): string {
  return pickBundle(locale)[key]
}

/** Fill `{name}` placeholders in a bundle template; unknown names are left as-is. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  )
}

/** True when the resolved locale gets the German bundle. */
export function isGermanLocale(locale?: string): boolean {
  return resolveUiLanguage(locale) === 'de'
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

/**
 * Invite banner sentence. Names the hotel only when the invite actually
 * prefills one (landr-2jsaf) — a booking without a hotel must not claim it.
 */
export function inviteBannerMessage(
  host: string,
  reference: string,
  hasHotel: boolean,
  locale?: string,
  ownAccommodation = false,
): string {
  const t = pickBundle(locale)
  // landr-qw2v8.2: no room is booked for this invitee — never claim a hotel.
  const template = ownAccommodation
    ? t.inviteBannerOwnAccommodation
    : hasHotel
      ? t.inviteBannerDatesAndHotel
      : t.inviteBannerDatesOnly
  return template.replace('{host}', host).replace('{ref}', reference)
}

/** MultiDayStep invite-summary blocked-days notice. */
export function hostDaysUnavailableMessage(blocked: number, host: string, locale?: string): string {
  const t = pickBundle(locale)
  const template = plural(blocked, t.hostDayUnavailableOne, t.hostDaysUnavailableOther)
  return template.replace('{host}', host).replace('{n}', String(blocked))
}

/** MultiDayStep gate reason naming a selected day that is no longer bookable. */
export function dayNoLongerAvailableReason(dateLabel: string, locale?: string): string {
  return pickBundle(locale).dayNoLongerAvailableReason.replace('{date}', dateLabel)
}

/** Host party no longer fits a selected day (landr-f987a.4). */
export function seatsShortMessage(
  dayLabel: string,
  left: number,
  need: number,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const template =
    left <= 0 ? t.seatsShortNone : plural(left, t.seatsShortOne, t.seatsShortOther)
  return template
    .replace('{day}', dayLabel)
    .replace('{n}', String(left))
    .replace('{need}', String(need))
}

/**
 * landr-rmcsu.5: name EVERY short day, not just the first — a lone "why
 * Nov 11?" when Nov 12 and 13 are short too was the confusing part. One day
 * keeps the exact seatsShortMessage wording (seats left + need); several
 * become "Wed 11 Nov, Thu 12 Nov and Fri 13 Nov have fewer than 3 seats left."
 */
export function seatsShortDaysMessage(
  days: readonly { label: string; left: number; need: number }[],
  locale?: string,
): string {
  if (days.length === 0) return ''
  if (days.length === 1) {
    const d = days[0]!
    return seatsShortMessage(d.label, d.left, d.need, locale)
  }
  const labels = days.map((d) => d.label)
  let list: string
  try {
    list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(labels)
  } catch {
    list = labels.join(', ')
  }
  return pickBundle(locale)
    .seatsShortDays.replace('{days}', list)
    .replace('{need}', String(days[0]!.need))
}

/** landr-rmcsu.5: "12 dates fit 3 people" under the dates-step calendar. */
export function seatFitCountLabel(count: number, need: number, locale?: string): string {
  const t = pickBundle(locale)
  return plural(count, t.seatFitCountOne, t.seatFitCountOther)
    .replace('{count}', String(count))
    .replace('{n}', String(need))
}

/** landr-rmcsu.7: "Only 2 left (you need 3)" chip; without the count when seats are not exposed. */
export function slotSeatsShortLabel(
  left: number,
  need: number,
  showCount: boolean,
  locale?: string,
): string {
  const t = pickBundle(locale)
  return (showCount ? t.slotSeatsShort : t.slotSeatsShortNoCount)
    .replace('{n}', String(left))
    .replace('{need}', String(need))
}

/** landr-rmcsu.7: course-window flavour of seatFitCountLabel. */
export function seatFitWindowsCountLabel(count: number, need: number, locale?: string): string {
  const t = pickBundle(locale)
  return plural(count, t.seatFitWindowsOne, t.seatFitWindowsOther)
    .replace('{count}', String(count))
    .replace('{n}', String(need))
}

/** landr-rmcsu.7: course-window flavour of seatFitNoneMessage. */
export function seatFitNoneWindowsMessage(need: number, locale?: string): string {
  return pickBundle(locale).seatFitNoneWindows.replace('{n}', String(need))
}

/** landr-rmcsu.5: "No dates with room for 4 people in October 2026 – March 2027." */
export function seatFitNoneMessage(need: number, range: string, locale?: string): string {
  return pickBundle(locale)
    .seatFitNone.replace('{n}', String(need))
    .replace('{range}', range)
}

/** Confirmation: per-invitee hold line (landr-f987a.4). */
export function holdHeldLabel(
  name: string,
  hours: number | null | undefined,
  when: string,
  locale?: string,
): string {
  const t = pickBundle(locale)
  if (!hours) return t.holdUntilOnly.replace('{name}', name).replace('{when}', when)
  return plural(hours, t.holdHeldOne, t.holdHeldOther)
    .replace('{name}', name)
    .replace('{n}', String(hours))
    .replace('{when}', when)
}

export function holdRequestedLabel(
  name: string,
  hours: number | null | undefined,
  when: string,
  locale?: string,
): string {
  // Hours unknown → fall back to the deadline-only wording.
  if (!hours) return holdHeldLabel(name, hours, when, locale)
  return pickBundle(locale)
    .holdRequested.replace('{name}', name)
    .replace('{n}', String(hours))
    .replace('{when}', when)
}

export function holdNotHeldLabel(name: string, locale?: string): string {
  return fillName(pickBundle(locale).holdNotHeld, name)
}

/** Invite landing: live hold / ended hold line. */
export function inviteHoldLabel(when: string | null, locale?: string): string {
  const t = pickBundle(locale)
  return when === null ? t.inviteHoldEnded : t.inviteHoldActive.replace('{when}', when)
}

/** Relative hint templates for a hold deadline ("tonight", "tomorrow at {time}"). */
export function holdRelativeTemplates(locale?: string) {
  const t = pickBundle(locale)
  return { tonight: t.holdTonight, today: t.holdToday, tomorrow: t.holdTomorrow }
}

/** "1 day selected" / "N days selected" chip (MultiDayStep). */
export function daysSelectedLabel(count: number, locale?: string): string {
  const t = pickBundle(locale)
  return plural(count, t.daysSelectedOne, t.daysSelectedOther).replace('{n}', String(count))
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

/** "1 ×" — the unit-less line-item subtitle for non-hotel lines (no night/day word). */
export function qtyOnly(qty: number, locale?: string): string {
  return pickBundle(locale).qtyTimesOnlyTemplate.replace('{qty}', String(qty))
}

/** The payee-aware "pay separately" strings, with `{payee}` filled in (landr-hzovu.5). */
export function payeeText(
  key: 'paidToPayeeOnTheDay' | 'paidDirectlyToPayeeCaveat' | 'paidToPayeeSuffix',
  payee: string | null | undefined,
  locale?: string,
): string {
  const t = pickBundle(locale)
  const label = payee && payee.trim() ? payee.trim() : t.payeeFallbackLabel
  return t[key].replace('{payee}', label)
}

/** "1 offer" / "4 offers" — CategoryTile's count chip (landr-872c copy). */
export function offerCountText(count: number, locale?: string): string {
  const t = pickBundle(locale)
  return `${count} ${plural(count, t.offerCountOne, t.offerCountOther)}`
}

export function optionalRevealLabel(thing: string, locale?: string): string {
  const t = pickBundle(locale)
  // landr-5aih0.9: lowercasing a sentence-case label ("Your name" -> "your
  // name") is a per-language writing convention, so the bundle opts in
  // (revealLabelCase) — German capitalises formal "Sie/Ihre/Ihnen" mid-sentence.
  const label =
    t.revealLabelCase === 'lower' && /^[A-Z][a-z]/.test(thing)
      ? thing.charAt(0).toLowerCase() + thing.slice(1)
      : thing
  return t.optionalRevealAddTemplate.replace('{thing}', label)
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
  const t = pickBundle(locale)
  if (!anyoneAssigned && unassignedNames.length > 1) return t.languageStepCueGroup
  const [first = '', second = ''] = unassignedNames
  const who =
    unassignedNames.length === 1
      ? first
      : unassignedNames.length === 2
        ? fmt(t.namesPairTemplate, { first, second })
        : fmt(t.namesAndOthersTemplate, { first, n: unassignedNames.length - 1 })
  return fmt(t.languageStepCueWhoTemplate, { who })
}

/** landr-80ubl.1: LanguageStep's gate line beside Continue. */
export function languageStepGate(unassignedNames: string[], locale?: string): string {
  const t = pickBundle(locale)
  if (unassignedNames.length === 0) return t.languageStepGateDone
  return fmt(t.languageStepGateWaitingTemplate, { names: unassignedNames.join(', ') })
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
  const t = pickBundle(locale)
  return hasSelection ? t.singleDateGateSelected : t.singleDateGateEmpty
}

/** landr-80ubl.2: MultiDayStep's gate line beside Continue. */
export function multiDayGate(selectedCount: number, locale?: string): string {
  const t = pickBundle(locale)
  if (selectedCount === 0) return t.multiDayGateNone
  return selectedCount === 1 ? t.multiDayGateOne : fmt(t.multiDayGateOther, { n: selectedCount })
}

/** landr-80ubl.2: FixedDateWindowPicker's gate line beside Continue. */
export function fixedDateWindowGate(hasSelection: boolean, locale?: string): string {
  const t = pickBundle(locale)
  return hasSelection ? t.fixedDateWindowGateSelected : t.fixedDateWindowGateEmpty
}

/** landr-80ubl.2: AvailabilityPicker's gate line beside Continue. */
export function availabilityGate(
  hasDate: boolean,
  hasTime: boolean,
  locale?: string,
): string {
  const t = pickBundle(locale)
  if (hasTime) return t.availabilityGateTimeSelected
  if (hasDate) return t.availabilityGateChooseTime
  return t.singleDateGateEmpty
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
  return fmt(pickBundle(locale).accommodationTooLateTemplate, { date: checkinDateLabel })
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
export type ForceReason =
  | 'capacity'
  | 'lead_time'
  | 'accommodation_lead_time'
  // landr-8ht3m.4: the picked day is outside the product's schedule (no
  // availability at all for it), e.g. a Thursday on a Fri-Sun product.
  | 'off_schedule'

/**
 * landr-8ht3m.4: the ONE confirm a staff operator answers before booking a day
 * the schedule does not offer (or a full / closed one). Shared by every day
 * picker so the wording never drifts.
 */
export const OUTSIDE_SCHEDULE_CONFIRM = 'Outside your schedule — book anyway?'

/** Legend for the dotted-underline days an operator can force-book (staff mode only). */
export const OVERRIDE_DAY_LEGEND = 'Not regularly bookable — you can still book (override)'

const FORCE_REASON_CLAUSE: Record<ForceReason, string> = {
  capacity: 'past capacity',
  lead_time: 'inside the lead-time window',
  accommodation_lead_time: "with the hotel stay past the hotel's own lead time",
  off_schedule: 'outside the schedule',
}

const FORCE_REASON_CONSEQUENCE: Record<ForceReason, string> = {
  capacity: 'Capacity will be exceeded',
  lead_time: 'the customer will not have the normal preparation time',
  accommodation_lead_time: "the hotel will not have its normal preparation time",
  off_schedule: 'nothing is scheduled on that day',
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

/** AccommodationStep's room-vs-occupant capacity mismatch warning. */
export function occupancyOverbookWarning(occupants: number, beds: number, locale?: string): string {
  const t = pickBundle(locale)
  return fmt(t.occupancyOverbookTemplate, {
    occupants,
    beds,
    occupantWord: plural(occupants, t.occupantSingular, t.occupantPlural),
    bedWord: plural(beds, t.bedSingular, t.bedPlural),
  })
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
  return fmt(t.multiDayDiffSummaryTemplate, {
    added,
    removed,
    addedWord: plural(added, t.daySingular, t.dayPlural),
    removedWord: plural(removed, t.daySingular, t.dayPlural),
    original: originalLabel ?? t.multiDayDiffOriginalFallback,
  })
}

/** MultiDayPicker's "Reset to <original>'s dates" button label. */
export function multiDayResetToDatesLabel(originalLabel: string | null | undefined, locale?: string): string {
  const t = pickBundle(locale)
  return originalLabel
    ? fmt(t.multiDayResetToDatesTemplate, { name: originalLabel })
    : t.multiDayResetToOriginalDates
}

/** MultiDayPicker's "N of <host>'s days are no longer available" reset-drop notice. */
export function multiDayResetDroppedNotice(
  count: number,
  originalLabel: string | null | undefined,
  locale?: string,
): string {
  const t = pickBundle(locale)
  return fmt(plural(count, t.multiDayResetDroppedOne, t.multiDayResetDroppedOther), {
    n: count,
    name: originalLabel ?? t.multiDayResetDroppedHostFallback,
  })
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
export function otherParticipantsHeading(n: number, locale?: string, stay = false): string {
  return tr(stay ? 'stayOtherGuestsTotalTemplate' : 'otherParticipantsTotalTemplate', locale).replace('{n}', String(n))
}

/** landr-jiagg.2 DetailsStep max notice when the booker does not take part:
 *  "Maximum of {n} participants reached" ("1 participant" singular). */
export function maxParticipantsReachedMessage(n: number, locale?: string, stay = false): string {
  return n === 1
    ? tr(stay ? 'stayMaxGuestsReachedOne' : 'maxParticipantsReachedOne', locale)
    : tr(stay ? 'stayMaxGuestsReachedTemplate' : 'maxParticipantsReachedTemplate', locale).replace('{n}', String(n))
}

/** landr-jiagg.2 DetailsStep (booker not taking part): "Participants ({n} total)". */
export function participantsTotalHeading(n: number, locale?: string, stay = false): string {
  return tr(stay ? 'stayGuestsTotalTemplate' : 'participantsTotalTemplate', locale).replace('{n}', String(n))
}

/** Product switch note: "{name} takes up to {n} people, so the group was reduced to {n}." */
export function alternativePartyClampedMessage(name: string, n: number, locale?: string): string {
  return tr('alternativePartyClampedTemplate', locale)
    .replaceAll('{name}', name)
    .replaceAll('{n}', String(n))
}

/** DetailsStep: "Add anyone else taking part. You can add up to {n} more." */
export function addAnyoneElseUpTo(n: number, locale?: string): string {
  return tr('addAnyoneElseUpToTemplate', locale).replace('{n}', String(n))
}

/** DetailsStep per-row heading: "Participant {n}". */
export function participantOrdinalLabel(n: number, locale?: string, stay = false): string {
  return tr(stay ? 'companionOrdinalTemplate' : 'participantOrdinalTemplate', locale).replace('{n}', String(n))
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
  const t = pickBundle(locale)
  return fmt(plural(count, t.additionalAccommodationRequiredOne, t.additionalAccommodationRequiredOther), { names })
}

/**
 * landr-wp8e9.2: invite mode — the room the invitee shares with the inviter has
 * fewer free beds than the invitee has unplaced companions. `freeBeds` is the
 * inviter room's remaining capacity (0 = full). No swap wording by design.
 */
export function hostRoomFullMessage(freeBeds: number, unplaced: number, locale?: string): string {
  const t = pickBundle(locale)
  if (freeBeds <= 0) return unplaced === 1 ? t.hostRoomFullOne : t.hostRoomFullMany
  return fmt(plural(freeBeds, t.hostRoomFewBedsOne, t.hostRoomFewBedsOther), { n: freeBeds })
}

/**
 * landr-wp8e9.2: invite-mode accommodation copy that names the REAL room the
 * inviter booked for the invitee (never "double"). `host` empty falls back to a
 * generic "the person who invited you"; `roomName` null drops the room clause.
 */
export function inviteRoomBookedNotice(host: string, roomName: string | null, locale?: string): string {
  const t = pickBundle(locale)
  const who = host.trim() || t.inviteRoomBookedWhoFallback
  const room = roomName?.trim() ? `: ${roomName.trim()}` : ''
  return fmt(t.inviteRoomBookedTemplate, { who, room })
}

/** landr-wp8e9.2: invite-mode radio label ("My room is booked by {host}") - no "double". */
export function inviteRoomLabel(host: string, locale?: string): string {
  const t = pickBundle(locale)
  return fmt(t.inviteRoomLabelTemplate, { who: host.trim() || t.inviteRoomLabelWhoFallback })
}

/** landr-wp8e9.2: invite-mode radio hint (replaces the hardcoded "double room" English). */
export function inviteRoomHint(locale?: string): string {
  return pickBundle(locale).inviteRoomHintText
}

/** landr-qw2v8.2: "{name}: own accommodation — no room booked" (host review + confirmation). */
export function ownAccommodationNoRoomLabel(name: string, locale?: string): string {
  return `${name}: ${tr('ownAccommodationNoRoomBooked', locale)}`
}

/** landr-wp8e9.2: replaces the "Optional — …" rooms hint when the host room cannot take the companions. */
export function hostRoomFullRequiredHint(locale?: string): string {
  return pickBundle(locale).hostRoomFullRequiredHintText
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

/** Standalone stays: "Sat 1 Jun → Tue 4 Jun, 3 nights". */
export function staySpanLabel(from: string, to: string, nights: number, locale?: string): string {
  const t = pickBundle(locale)
  return fmt(t.staySpanTemplate, {
    from,
    to,
    nights,
    nightWord: plural(nights, t.nightSingular, t.nightPlural),
  })
}

/** Standalone stays: "3 nights × €90.00". */
export function stayNightsTimesRate(nights: number, rate: string, locale?: string): string {
  const t = pickBundle(locale)
  return fmt(t.stayNightsTimesRateTemplate, {
    nights,
    rate,
    nightWord: plural(nights, t.nightSingular, t.nightPlural),
  })
}

/** Standalone stays: "Minimum stay: 2 nights". */
export function stayMinNightsLabel(count: number, locale?: string): string {
  const t = pickBundle(locale)
  return fmt(t.stayMinNightsTemplate, {
    count,
    nightWord: plural(count, t.nightSingular, t.nightPlural),
  })
}

/** The price-unit suffix an add-on's price is shown with ("each", "/ night", …). */
export function addonUnitSuffix(priceUnit: string | null | undefined, locale?: string): string {
  const t = pickBundle(locale)
  switch (priceUnit) {
    case 'night':
      return t.perNightSuffix
    case 'guest':
      return t.perGuestSuffix
    case 'guest_night':
      return t.perGuestNightSuffix
    case 'stay':
      return t.perStaySuffix
    default:
      return t.eachSuffix
  }
}

/** An add-on line priced by unit: "6 × €12.00 / guest / night". */
export function addonUnitsTimesRate(
  units: number,
  rate: string,
  priceUnit: string | null | undefined,
  locale?: string,
): string {
  return fmt(pickBundle(locale).addonUnitsTimesRateTemplate, {
    units,
    rate,
    suffix: addonUnitSuffix(priceUnit, locale),
  })
}

/** Customer text for one broken stay rule (the API's violation codes). */
export function stayViolationMessage(code: string, date: string | undefined, locale?: string): string {
  const t = pickBundle(locale)
  switch (code) {
    case 'invalid_range':
      return t.stayErrInvalidRange
    case 'not_contiguous':
      return t.stayErrNotContiguous
    case 'check_in_past':
      return t.stayErrCheckInPast
    case 'below_min_nights':
      return t.stayErrBelowMin
    case 'above_max_nights':
      return t.stayErrAboveMax
    case 'too_many_guests':
      return t.stayErrTooManyGuests
    case 'blocked_night':
      return fmt(t.stayErrBlockedTemplate, { date: date ?? '' })
    case 'night_unavailable':
      return fmt(t.stayErrTakenTemplate, { date: date ?? '' })
    default:
      return t.stayErrInvalidRange
  }
}

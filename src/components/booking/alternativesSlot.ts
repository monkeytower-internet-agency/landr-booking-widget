/**
 * DOM id of the desktop slot under the Booking overview card (PriceSidebar).
 * When it is mounted the "Also available" panel renders there on md+ and as a
 * strip inside the step below md; without it (a picker used on its own) the
 * strip is the only copy.
 */
export const ALTERNATIVES_SLOT_ID = 'landr-alternatives-slot'

/**
 * landr-d9qs8: DOM id of the desktop slot for the "Back to <product>" button
 * after an alternative switch: under the total, where the row was tapped.
 */
export const ALTERNATIVE_BACK_SLOT_ID = 'landr-alternative-back-slot'

/**
 * Desktop slot for the cross-sell hint block, directly under the grand total
 * card (PriceSidebar). Below md, or without the rail, the block renders inline
 * at the end of the review step.
 */
export const CROSS_SELL_HINTS_SLOT_ID = 'landr-cross-sell-hints-slot'

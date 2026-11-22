import type { Location } from '@/api/types'
import { pickLocalized } from '@/lib/locale'

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query='

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Fixed 6 decimals, trailing zeros trimmed (mirrors the API's meeting-point rules). */
function formatCoord(n: number): string {
  const t = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return t === '' || t === '-0' ? '0' : t
}

export interface PlaceDetails {
  description: string
  address: string
  phone: string
  mapsUrl: string
}

/**
 * Details shown under a pickup option. Maps link: the operator's valid
 * http(s) `maps_link`, else coordinates, else the address (same order as the
 * API's meeting_point block). Every value is "" when unknown.
 */
export function placeDetails(loc: Location, locale: string): PlaceDetails {
  const description = pickLocalized(
    loc.description ?? '',
    loc.description_localized,
    locale,
  ).trim()
  const address = (loc.address ?? '').trim()
  const phone = (loc.phone ?? '').trim()
  let mapsUrl = ''
  const link = (loc.maps_link ?? '').trim()
  if (link && isHttpUrl(link)) {
    mapsUrl = link
  } else if (
    loc.geo &&
    Number.isFinite(loc.geo.lat) &&
    Number.isFinite(loc.geo.lng)
  ) {
    mapsUrl = `${MAPS_SEARCH_BASE}${formatCoord(loc.geo.lat)},${formatCoord(loc.geo.lng)}`
  } else if (address) {
    mapsUrl = `${MAPS_SEARCH_BASE}${encodeURIComponent(address).replace(/%20/g, '+')}`
  }
  return { description, address, phone, mapsUrl }
}

export function hasPlaceDetails(d: PlaceDetails): boolean {
  return Boolean(d.description || d.address || d.phone || d.mapsUrl)
}

/** tel: href with everything but digits and a leading + stripped. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  return `tel:${cleaned}`
}

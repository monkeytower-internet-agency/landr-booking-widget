/**
 * landr-aoak.2 [S3]: StaffModeProvider + useStaffMode hook.
 *
 * App wires this at the root, seeding the initial session from the URL
 * (`staffSessionFromLocation()`). The provider also LISTENS for the
 * `landr:staff-init` postMessage from the embedding dashboard parent — verified
 * against the origin allowlist — so the dashboard (landr-aoak.3) can hand the
 * widget a freshly-minted token without putting a security credential in the
 * URL. The rest of the widget consumes `useStaffMode()` and gates every
 * operator-only affordance behind `.active`.
 *
 * The pure logic (parsing, origin checks, the StaffSession type) PLUS the
 * context object and useStaffMode hook live in the sibling `staffMode.ts`; this
 * file holds ONLY the StaffModeProvider component so the
 * react-refresh/only-export-components lint gate stays happy (same split as
 * variant.tsx / variant.ts).
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  isAllowedStaffOrigin,
  isStaffInitMessage,
  staffInitFromMessage,
  StaffModeContext,
  staffSessionFromLocation,
  type StaffSession,
} from './staffMode'

/**
 * Provider. Seeds from the URL at mount, then upgrades to a postMessage-init
 * session if the embedding dashboard sends one from an allow-listed origin.
 * A URL session already present wins and is never downgraded by a message.
 */
export function StaffModeProvider({
  value,
  children,
}: {
  value?: StaffSession
  children: ReactNode
}) {
  const [session, setSession] = useState<StaffSession>(
    () => value ?? staffSessionFromLocation(),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    function onMessage(event: MessageEvent) {
      // SECURITY: only an allow-listed origin (the dashboard host) may hand
      // the widget a staff session. Anything else is silently ignored.
      if (!isAllowedStaffOrigin(event.origin)) return
      if (!isStaffInitMessage(event.data)) return
      setSession((prev) => {
        // A URL-seeded session wins — don't let a later message clobber it.
        if (prev.active) return prev
        return staffInitFromMessage(event.data)
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <StaffModeContext.Provider value={session}>
      {children}
    </StaffModeContext.Provider>
  )
}

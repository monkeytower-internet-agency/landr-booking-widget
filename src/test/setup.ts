import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

import { setAddressForm } from '@/lib/addressForm'
import { loadAllUiCatalogs } from '@/lib/strings'

vi.stubEnv('VITE_USE_MOCKS', '1')
vi.stubEnv('VITE_API_BASE_URL', 'http://stub.invalid')

// landr-8r6oc.18: the non-English catalogs are lazy chunks in the app; tests
// render in every language synchronously, so load them all up front. The
// lazy-load behaviour itself is covered in lib/strings.lazy.test.ts.
await loadAllUiCatalogs()

// landr-wm0jv: the product default is informal (du / sen); the existing suites
// assert the formal (Sie / siz) copy, so they run formal unless a test picks
// a form itself. addressForm.test.ts covers the default and both switches.
beforeEach(() => {
  setAddressForm('formal')
})

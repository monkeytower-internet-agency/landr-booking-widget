import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

import { loadAllUiCatalogs } from '@/lib/strings'

vi.stubEnv('VITE_USE_MOCKS', '1')
vi.stubEnv('VITE_API_BASE_URL', 'http://stub.invalid')

// landr-8r6oc.18: the non-English catalogs are lazy chunks in the app; tests
// render in every language synchronously, so load them all up front. The
// lazy-load behaviour itself is covered in lib/strings.lazy.test.ts.
await loadAllUiCatalogs()

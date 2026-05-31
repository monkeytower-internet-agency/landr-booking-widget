import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.stubEnv('VITE_USE_MOCKS', '1')
vi.stubEnv('VITE_API_BASE_URL', 'http://stub.invalid')
vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.stub.invalid')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

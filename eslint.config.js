import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // landr-t0do: playwright config/specs are node-run, not part of the app
  // build (tsconfig.app.json only includes src/) — skip the react-specific
  // rules here rather than pull in eslint-plugin-playwright for 3 files.
  globalIgnores(['dist', 'src/components/ui/**', 'e2e/**', 'playwright.config.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])

import path from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createDevVersionHandler } from './src/lib/devVersionMiddleware'

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')) as {
  version: string
}

// landr-70jcy.3: build identity, baked in as __BUILD_ID__ and emitted as /version.json.
const git = (args: string, cwd?: string): string | null => {
  try {
    return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}
const buildId = process.env.GITHUB_SHA ?? git('rev-parse HEAD') ?? String(Date.now())
const buildTime = new Date().toISOString()

function emitVersionFile(): Plugin {
  return {
    name: 'landr-emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId, version, builtAt: buildTime }),
      })
    },
    // Dev server: stamp the checkout's live HEAD into index.html (define is frozen at start).
    transformIndexHtml(_html, ctx) {
      if (!ctx.server) return
      const root = ctx.server.config.root
      const live = { buildId: git('rev-parse HEAD', root) ?? buildId, builtAt: git('log -1 --format=%cI', root) ?? buildTime }
      return [{ tag: 'script', injectTo: 'head-prepend', children: `window.__LANDR_BUILD__=${JSON.stringify(live)}` }]
    },
    configureServer(server) {
      const root = server.config.root
      server.middlewares.use(
        createDevVersionHandler({ getHead: () => git('rev-parse HEAD', root), version, builtAt: buildTime }),
      )
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), tailwindcss(), emitVersionFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

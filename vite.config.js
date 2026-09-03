import base44 from "@base44/vite-plugin"
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    legacy({
      targets: ['iOS >= 12', 'Safari >= 12'],
      renderLegacyChunks: true,
      // Safari on iOS 12 supports ES modules, so Vite classifies it as a
      // "modern" browser. The Base44 SDK still relies on runtime APIs that
      // are newer than iOS 12, so the modern path must receive polyfills too.
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        legacy: resolve(process.cwd(), 'legacy.html'),
        legacyXr: resolve(process.cwd(), 'legacy-xr.html'),
      },
    },
  },
});

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
      output: {
        // Global-readiness fix: split the single bundle so first paint doesn't
        // carry mapbox-gl and every page. Function form keeps the base44
        // plugin's virtual modules on the default path. Route-level splitting
        // happens via React.lazy in src/App.jsx (Home + AiGps stay eager).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("mapbox-gl")) return "vendor-mapbox";
          if (id.includes("framer-motion") || id.includes("lucide-react")) return "vendor-ui";
          return "vendor";
        },
      },
    },
  },
});

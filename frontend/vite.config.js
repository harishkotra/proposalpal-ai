import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add the nodePolyfills plugin here
    nodePolyfills({
      // We still need to explicitly polyfill `global`
      globals: {
        global: true,
        Buffer: true,
        process: true,
      },
      // You can add protocol imports if needed, but for now this is fine
      protocolImports: true,
    }),
  ],
  // We can remove the manual 'define' for process.env, 
  // but keeping 'global' can be a good fallback.
  define: {
    'global': 'window',
  },
})
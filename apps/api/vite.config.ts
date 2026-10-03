import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({
      experimental: {
        newConfig: true,
      },
    }),
  ],
  server: {
    port: 8080,
  },
})

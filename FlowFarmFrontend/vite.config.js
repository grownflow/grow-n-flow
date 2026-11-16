import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployment-specific settings come from the environment so this file never
// needs a hostname committed to it. See HOSTING.md for details.
//
//   DEV_ALLOWED_HOSTS  comma-separated extra hostnames the dev server accepts
//                      (e.g. the public domain when vite runs behind a proxy)
//   HMR_HOST           public hostname browsers use for hot-reload websockets
//   HMR_CLIENT_PORT    public port for hot reload (e.g. 443 behind a TLS proxy)
//   HMR_PROTOCOL       'ws' or 'wss'
//   API_PROXY_TARGET   where vite forwards /api (default http://localhost:4000;
//                      docker-compose sets http://backend:4000)
const env = process.env
const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])

const hmr = {}
if (env.HMR_HOST) hmr.host = env.HMR_HOST
if (env.HMR_CLIENT_PORT) hmr.clientPort = Number(env.HMR_CLIENT_PORT)
if (env.HMR_PROTOCOL) hmr.protocol = env.HMR_PROTOCOL

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', ...csv(env.DEV_ALLOWED_HOSTS)],
    ...(Object.keys(hmr).length ? { hmr } : {}),
    // The frontend calls the API with relative /api URLs. In dev, vite forwards
    // them to the backend; in production a reverse proxy does the same job.
    proxy: {
      '/api': {
        target: env.API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
})

import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // An explicit IPv4 address: on this machine "localhost" resolves to IPv6 ::1, which browsers can't reach
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true },
})

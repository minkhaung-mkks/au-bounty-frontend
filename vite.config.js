import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // The SPA is mounted under /aubounty/ on the shared course domain (and in
  // dev too, so the URLs the dev server serves are the ones Nginx serves).
  base: '/aubounty/',
  plugins: [react()],
  server: {
    proxy: {
      // The API keeps its deployed prefix in development too, so the URLs the
      // frontend calls are the URLs Nginx will serve.
      '/aubounty/api': 'http://localhost:4000',
      // The realtime layer shares the API server and its deployed prefix.
      '/aubounty/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API keeps its deployed prefix in development too, so the URLs the
      // frontend calls are the URLs Nginx will serve.
      '/aubounty/api': 'http://localhost:4000',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // expose on LAN
    proxy: {
      // Any request to /socket.io is forwarded to the game server.
      // This means clients ONLY need the Vite port (5173) - no more port 4000.
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,          // enable WebSocket proxying
        changeOrigin: true,
      },
    },
  },
})

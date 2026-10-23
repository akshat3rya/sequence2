import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the client (5173) proxies socket traffic to the game server (3001).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});

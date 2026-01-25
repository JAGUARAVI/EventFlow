import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: {
    https: true,
    port: 5174,
    host: '0.0.0.0'
  },
  plugins: [react(), tailwindcss(), mkcert()],
})

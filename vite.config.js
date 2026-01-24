import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: {
    https: true,
  },
  plugins: [react(), tailwindcss(), mkcert()],
})

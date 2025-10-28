import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server:{
    host: true,
    allowedOrigins: ['http://localhost:5173', 'http://172.31.186.176:5173', 'http://172.31.186.107:5173', 'http://10.8.12.212:5173']
  }
})
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy API calls to backend in dev
      "/auth": "http://localhost:8000",
      "/admin": "http://localhost:8000",
      "/vault": "http://localhost:8000",
    },
  },
});

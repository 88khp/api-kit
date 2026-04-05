import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // When Vite follows imports into ../../src/ (the library source), it must
    // resolve "axios" from this package's node_modules, not the repo root.
    dedupe: ["axios", "react", "react-dom"],
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend so we avoid CORS issues during dev
    proxy: {
      "/auth": "http://localhost:4000",
      "/api": "http://localhost:4000",
    },
  },
});

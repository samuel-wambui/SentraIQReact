import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const backendTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? "http://localhost:8080";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    global: "globalThis",
  },
  server: {
    host: "localhost",
    port: 8084,
    strictPort: true,
    allowedHosts: ["bdcc-2c0f-fe38-241f-cc43-d690-61cd-c045-dbb5.ngrok-free.app"],
    proxy: {
      "/api": backendTarget,
      "/oauth2": backendTarget,
      "/userinfo": backendTarget,
      "/login": backendTarget,
      "/.well-known": backendTarget,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

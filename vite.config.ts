import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    global: "globalThis",
  },
  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    allowedHosts: ["bdcc-2c0f-fe38-241f-cc43-d690-61cd-c045-dbb5.ngrok-free.app"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

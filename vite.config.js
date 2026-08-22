import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const buildTime = process.env.BUILD_TIME || new Date().toISOString();
const base = process.env.VITE_BASE_PATH || "./";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});

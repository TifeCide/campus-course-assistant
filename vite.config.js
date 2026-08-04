import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildTime = process.env.BUILD_TIME || new Date().toISOString();

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Чистый конфиг Vite без зависимостей Figma Make
export default defineConfig({
  base: "./",
  plugins: [react()],
});

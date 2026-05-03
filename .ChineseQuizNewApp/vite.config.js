import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Website/ChineseQuizNew/",
  build: {
    outDir: "../ChineseQuizNew",
    emptyOutDir: true,
  },
  plugins: [react()],
});

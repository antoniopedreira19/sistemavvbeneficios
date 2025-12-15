import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // CORREÇÃO DEFINITIVA: Apontando para o caminho absoluto no node_modules
      "pdfmake/build/pdfmake": path.resolve(__dirname, "node_modules/pdfmake/build/pdfmake.js"),
      "pdfmake/build/vfs_fonts": path.resolve(__dirname, "node_modules/pdfmake/build/vfs_fonts.js"),
    },
    dedupe: ["react", "react-dom"],
  },
}));

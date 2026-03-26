import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Target modern browsers — avoids bloating the bundle with legacy polyfills
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // React is stable and rarely changes — long-term browser cache hit
          'vendor-react': ['react', 'react-dom'],
          // Plotly is ~3 MB; isolating it means the rest of the app can load
          // and be interactive before Plotly is ever downloaded
          plotly: ['plotly.js-dist-min', 'react-plotly.js'],
        },
      },
    },
  },
});

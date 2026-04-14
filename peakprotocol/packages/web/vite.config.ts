import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  plugins: [
    UnoCSS(),
    solidPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
    }),
    ...(mode === "analyze"
      ? [visualizer({ open: true, gzipSize: true, brotliSize: true })]
      : []),
  ],
  optimizeDeps: {
    include: [
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "@solidjs/router",
      "idb",
    ],
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-solid": ["solid-js", "solid-js/web", "solid-js/store", "@solidjs/router"],
          "vendor-uplot": ["uplot"],
          "vendor-idb": ["idb"],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
}));

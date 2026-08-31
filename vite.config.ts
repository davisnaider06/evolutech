import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        navigateFallback: "/index.html",
        // O service worker continua gerado pelo Workbox (generateSW), que e o
        // que mantem o precache do app funcionando. O generateSW nao aceita
        // handler de `push`, entao o nosso entra por importScripts: um arquivo
        // escrito a mao, sem build, carregado dentro do SW gerado.
        //
        // A alternativa seria migrar para injectManifest e reescrever o SW
        // inteiro. Nao compensa o risco para dois listeners.
        importScripts: ["/push-sw.js"],
        // Ja e carregado via importScripts; precachear de novo so duplicaria.
        globIgnores: ["**/push-sw.js"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "Evolutech Digital",
        short_name: "Evolutech",
        description: "Plataforma SaaS whitelabel da Evolutech",
        start_url: "/",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#2563eb",
        lang: "pt-BR",
        icons: [
          {
            src: "/favicon.ico",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

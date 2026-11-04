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
      // "prompt": a versao nova espera a pessoa tocar em Atualizar (ver main.tsx).
      registerType: "prompt",
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
        // Os pedacos pesados que so o dono usa (Excel, graficos, painel admin
        // legado) ficam fora do precache: sem isto o celular do cliente baixava
        // 2,6 MB em segundo plano so por abrir o link de agendamento. Eles vem
        // da rede quando a tela abre e ficam no cache de runtime abaixo.
        globIgnores: ["**/push-sw.js", "**/xlsx-*.js", "**/PieChart-*.js", "**/client-*.js"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        runtimeCaching: [
          {
            // Arquivos com hash no nome nunca mudam: o que veio uma vez serve.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "assets-sob-demanda",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "iBarber",
        short_name: "iBarber",
        description: "Sistema para barbearias: agenda, caixa, comissões e avaliações",
        // "/" e a landing; o app instalado abre direto no redirecionamento por perfil.
        start_url: "/app",
        display: "standalone",
        background_color: "#fafafa",
        theme_color: "#a3822a",
        lang: "pt-BR",
        // 192 e 512 sao o minimo para o Chrome oferecer "Instalar app"; o
        // maskable preenche o formato do icone no Android sem borda branca.
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
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

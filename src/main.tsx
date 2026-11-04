import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD) {
  // Versao nova so entra quando a pessoa tocar em "Atualizar". Antes ela
  // assumia sozinha (autoUpdate) no meio do uso, sem ninguem saber, e uma tela
  // aberta continuava com o codigo velho falando com a API nova.
  const atualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("Nova versão do app disponível", {
        description: "Toque em Atualizar quando terminar o que está fazendo.",
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => void atualizar(true) },
      });
    },
  });
}

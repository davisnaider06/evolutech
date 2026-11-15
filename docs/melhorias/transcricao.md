# Transcrição: melhorias_vibe_coding.mp4

- **Arquivo:** `docs/melhorias_vibe_coding.mp4`, 78,2 s, vertical 720×1280, áudio em português.
- **Áudio:** extraído com ffmpeg (mono, 16 kHz) e transcrito com faster-whisper 1.2.1, modelo `small`, CPU int8. O idioma detectado foi pt, com probabilidade 0,996.
- **Tela:** 39 frames, um a cada 2 s, montados em mosaicos. A melhoria 25 caiu numa transição; um frame avulso em 58,2 s confirmou número e categoria.
- **Correções:** quando o whisper errou uma palavra, a correção vem do texto que aparece na tela do vídeo. As correções estão marcadas com `[tela: ...]`.

## Transcrição bruta, com timestamps

```
[00.00-03.90] Claude, eu não quero que o meu app [tela: "vibe coding"; whisper: "divide coding"] fique lento e perca usuário.
[03.90-06.74] Então, por favor, coloca skeleton de carregamento.
[06.74-09.30] Serve as imagens em WebP ou AVIF.
[09.30-11.38] Evita chamadas duplicadas na API.
[11.38-13.86] Coloca [tela: "debounce"; whisper: "de bounce"] na busca e no autocompletar.
[13.86-15.64] Pagina os resultados da API.
[15.64-17.94] Serve os arquivos estáticos por uma CDN.
[17.94-19.86] Manda as tarefas lentas para uma fila.
[19.86-21.70] Corrige as consultas [tela: "N mais um"; whisper: "N··"].
[21.70-23.90] Ativa a compressão Brotli ou Gzip.
[23.90-26.54] Faz cache no Redis dos dados mais consultados.
[26.54-28.66] Remove as dependências que você não usa.
[28.66-30.74] Coloca timeout nas APIs externas.
[30.74-33.22] Transmite a resposta da IA [tela: "token por token"; whisper: "Tolkien por Tolkien"].
[33.22-35.38] Atualiza a tela sem esperar o servidor.
[35.38-37.82] Usa lazy loading nas imagens fora da tela.
[37.82-40.38] Dispara em paralelo as requisições independentes.
[40.38-42.62] Cria índices para as consultas mais comuns.
[42.62-45.22] Rastreia as requisições lentas com OpenTelemetry.
[45.22-47.42] Coloca o servidor perto do banco de dados.
[47.42-49.30] Renderiza no servidor ou no build.
[49.30-52.06] Carrega os scripts de terceiros depois da página.
[52.06-53.86] Divide o JavaScript por página.
[53.86-55.54] Virtualiza as listas longas.
[55.54-57.50] Pede só as colunas que você precisa.
[57.50-58.94] Usa um pool de conexões.
[58.94-60.82] Evita re-render desnecessário.
[60.82-62.86] Faz cache dos estáticos no navegador.
[62.86-65.18] Distribui o tráfego entre várias instâncias.
[65.18-67.54] Hospeda suas fontes e limita os pesos.
[67.54-69.90] Monitora a velocidade dos usuários reais.
[69.90-71.94] E testa no celular e [tela: "em rede lenta"; whisper: "enredilenta"].
[71.94-76.38] Comenta [tela: "GOAT"; whisper: "Gold"] que eu te mando o kit completo de performance, com o checklist e os prompts.
```

O final é chamada para ação do autor (@gustagoat.ai) e não é uma melhoria.

## As 31 melhorias

O número e a categoria são os que aparecem na tela. O timestamp é o trecho do áudio.

| # | Melhoria | Timestamp | Categoria na tela |
|---|---|---|---|
| 1 | Skeleton de carregamento | 03,9–06,7 s | não verificado (o frame não mostra a etiqueta) |
| 2 | Servir imagens em WebP ou AVIF | 06,7–09,3 s | REDE |
| 3 | Evitar chamadas duplicadas na API | 09,3–11,4 s | API |
| 4 | Debounce na busca e no autocompletar | 11,4–13,9 s | FRONTEND |
| 5 | Paginar os resultados da API | 13,9–15,6 s | API |
| 6 | Servir arquivos estáticos por CDN | 15,6–17,9 s | REDE |
| 7 | Mandar tarefas lentas para uma fila | 17,9–19,9 s | BACKEND |
| 8 | Corrigir consultas N+1 | 19,9–21,7 s | BANCO DE DADOS |
| 9 | Compressão Brotli ou Gzip | 21,7–23,9 s | REDE |
| 10 | Cache no Redis dos dados mais consultados | 23,9–26,5 s | BACKEND |
| 11 | Remover dependências não usadas | 26,5–28,7 s | FRONTEND |
| 12 | Timeout nas APIs externas | 28,7–30,7 s | API |
| 13 | Streaming da resposta da IA, token por token | 30,7–33,2 s | API |
| 14 | Atualizar a tela sem esperar o servidor (UI otimista) | 33,2–35,4 s | FRONTEND |
| 15 | Lazy loading nas imagens fora da tela | 35,4–37,8 s | FRONTEND |
| 16 | Requisições independentes em paralelo | 37,8–40,4 s | API |
| 17 | Índices para as consultas mais comuns | 40,4–42,6 s | BANCO DE DADOS |
| 18 | Rastrear requisições lentas com OpenTelemetry | 42,6–45,2 s | MEDIÇÃO |
| 19 | Servidor perto do banco de dados | 45,2–47,4 s | BACKEND |
| 20 | Renderizar no servidor ou no build (SSR/SSG) | 47,4–49,3 s | BACKEND |
| 21 | Scripts de terceiros depois da página | 49,3–52,1 s | FRONTEND |
| 22 | Dividir o JavaScript por página | 52,1–53,9 s | FRONTEND |
| 23 | Virtualizar listas longas | 53,9–55,5 s | FRONTEND |
| 24 | Pedir só as colunas necessárias | 55,5–57,5 s | BANCO DE DADOS |
| 25 | Pool de conexões | 57,5–58,9 s | BANCO DE DADOS |
| 26 | Evitar re-render desnecessário | 58,9–60,8 s | FRONTEND |
| 27 | Cache dos estáticos no navegador | 60,8–62,9 s | REDE |
| 28 | Distribuir o tráfego entre várias instâncias | 62,9–65,2 s | BACKEND |
| 29 | Hospedar as fontes e limitar os pesos | 65,2–67,5 s | FRONTEND |
| 30 | Monitorar a velocidade dos usuários reais (RUM) | 67,5–69,9 s | MEDIÇÃO |
| 31 | Testar no celular e em rede lenta | 69,9–71,9 s | MEDIÇÃO |

Os 31 itens saíram claros e não há item faltando ou ambíguo. Os textos de apoio que aparecem na tela foram usados para entender cada melhoria. Exemplos: "1 requisição compartilhada" (3), "1 consulta por item" (8) e "Mesma região · rede privada" (19).

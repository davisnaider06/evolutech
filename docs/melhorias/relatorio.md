# Relatório: aplicação das melhorias do vídeo

**Branch:** `dev`, sem push. São 18 commits de melhoria, de `72346a4` a `e049c2e`, depois do commit de documentação `89bf87c`.

**Documentos de apoio:**
- [transcricao.md](transcricao.md)
- [mapeamento.md](mapeamento.md)
- [roadmap.md](roadmap.md)
- [teste-celular.md](teste-celular.md)

## Resultado real de build e testes (15/11/2026, depois do último commit)

| Verificação | Resultado |
|---|---|
| `npm run build` (front) | passou. JS inicial: 388,30 kB, gzip 119,06 kB |
| `npm run lint` (front) | 0 erros, 962 warnings. Antes eram 968; são quase todos `no-explicit-any` antigos |
| `npm run build` (backend, `tsc`) | passou |
| `npm test` (backend) | não existe teste. O script é `echo "Error: no test specified"` |
| Testes do front | não existe script de teste |
| Teste manual no navegador | **não verificado.** A extensão do Chrome desconectou nesta sessão. O que foi testado está descrito em cada item abaixo |

**Peso do JS inicial**, que todo visitante baixa, inclusive o cliente do link de agendamento:

| Momento | Minificado | Gzip |
|---|---|---|
| Início desta fase | 528,96 kB | 165,05 kB |
| Fim desta fase | 388,30 kB | 119,06 kB |
| Diferença | −26,6% | −27,9% |

## Banco de dados

- As mudanças foram feitas só no banco de dev (`ep-wandering-art`, branch do Neon, via `.env.dev`). Antes de cada operação conferi o host que o Prisma ou o `pg` imprimia.
- Nenhuma escrita nem migration em produção.
- O `.env` e o `.env.prod` foram só lidos para comparar hosts, sem exibir senha.

## Aplicado

| # | Melhoria | Commit | Como foi verificado |
|---|---|---|---|
| 12 | Timeout nas APIs externas: gateway de pagamento e Stripe com prazo total de 15 s e erro 504 "a cobrança pode ter sido criada, confira antes de repetir"; Z-API 15 s; Resend 20 s; web-push 10 s | `72346a4` | Mecanismo testado contra um IP inalcançável. O `req.setTimeout` original levava 5 s com prazo de 2 s (só conta depois de conectar), por isso troquei por um prazo total, que rejeitou em 2,0 s. O caminho de sucesso contra `api.stripe.com` limpa o timer. `tsc` ok |
| 7 (parte 1) | Webhook de pagamento responde sem esperar o e-mail de assinatura ativada. O salvamento do cartão continua aguardado | `e0c94f5` | `tsc` ok. Webhook real não testado: não há gateway configurado no dev |
| 4 | Debounce de 300 ms na busca (`SearchFilters`) e descarte de resposta fora de ordem em Clientes, Agendamentos, Pedidos e Produtos | `e643a57` | Build e lint. Comportamento no navegador **não verificado** |
| 5 | `SeletorDeCliente` com busca no servidor (20 por vez) no lugar de "carregar todos" (cortado em 200) em Agenda, PDV, Assinaturas (2), Fidelidade, Relatórios e Financeiro. Produtos avisa quando passa do limite. Cursos pede 200 de forma explícita. Contrato da API inalterado | `75b6a9b` | Build e lint. O backend já buscava por nome, e-mail, telefone e documento. O dev tem só 23 clientes, então o corte em 200 não pôde ser reproduzido. Navegador **não verificado** |
| 17 | Índices `orders(empresa_id, created_at)`, `orders(empresa_id, status, created_at)`, `payment_transactions(order_id)` e `audit_logs(empresa_id, created_at)` | `0576741` | Migration aplicada só no dev. `migrate status` ok. `migrate diff` não acusa os índices novos. `EXPLAIN` (com seqscan desligado, porque as tabelas do dev estão vazias) mostra Index Scan nas três consultas |
| 11 | Removidos: React Query (montado sem uso, ia no JS inicial), zod, @hookform/resolvers, qrcode (front e back), react-hook-form, embla, vaul, input-otp, react-resizable-panels, 10 pacotes Radix, 2 `@types` de backend e 17 componentes `ui/` órfãos | `1d012ba` | Grep confirmou zero uso. Build de front e back ok. JS inicial de 528,96 para 502,24 kB |
| 22 | Transição de tela em CSS. O framer-motion saiu do chunk inicial e ficou só no chunk da Landing | `9175e20` | Sourcemap confirma. JS inicial de 502,24 para 387,15 kB |
| 27 | `Cache-Control: public, max-age=31536000, immutable` só em `/assets/*` (`vercel.json`) | `211f270` | Antes, medido na URL real: `max-age=0, must-revalidate`. Os 168 arquivos de `dist/assets` têm hash. Efeito real só depois do deploy |
| 2 (parte 1) | Foto de capa em AVIF (51 kB) e WebP (84 kB) com fallback JPEG (173 kB), via `<picture>`. Preload global passa a ser do AVIF. O service worker agora inclui `.avif` | `c7373df` | Comparação visual lado a lado sem diferença perceptível. O Lighthouse local mostra a capa em 50 kB com prioridade alta |
| 2 (parte 2) | Upload redimensiona (logo 512 px, foto 800 px, capas 1600 px) e converte para WebP no navegador, com canvas. Mantém o original para favicon, GIF ou quando não compensa | `b61b6be` | Build e lint. Upload real **não verificado** (sem navegador) |
| 15 | `loading="lazy"` nas imagens de lista: capas de curso e logos nas listas de empresas e de temas | `cd4811c` | Build e lint |
| 3 | `useCompanyModules` usa `requisitar`, e o `/auth/me` da abertura passa a ser uma requisição só | `568d256` | Build. Contagem de requisições no navegador **não verificada** |
| 18 | Log `[lenta]` para requisições acima de `SLOW_REQUEST_MS` (padrão 1500 ms), só com o caminho, sem a query string | `46bbf45` | Backend local contra o dev: as linhas saem certas e nenhum valor secreto da query aparece no log |
| 30 | RUM: o front mede LCP, CLS, INP (aproximado), FCP e TTFB e envia por `sendBeacon`. Endpoint novo `POST /api/public/vitals` grava uma linha `[vitals]` no log | `2b2b1e3` | Backend local: válido dá 204; lixo, sem métrica ou valor fora da faixa dá 400; acima de 2 kB dá 413; tentativa de injetar linha falsa no log foi limpa |
| 31 | Checklist de teste em celular e rede lenta, com linha de base do Lighthouse | `87b46e4` | Lighthouse 12.2.1 mobile em produção: `/login` nota 95, LCP 2,4 s, 454 KiB; `/` nota 95, LCP 2,4 s |
| 26 | `useMemo` no valor do `AuthContext`; `login`, `logout` e `hasPermission` estáveis | `6cb3254` | Build e lint sem `exhaustive-deps`. Ganho **não medido** no Profiler |
| 14 | Kanban de "Minhas tarefas" otimista, com a mesma regra de índice do `moveMyTask` do servidor; volta ao estado anterior se o servidor recusar | `58322bb` | Regra conferida contra o backend. Navegador **não verificado** |
| 1 | `EsqueletoLista` no lugar de "Carregando..." em 14 telas (27 pontos) | `e049c2e` | Build e lint. Estados de vazio e erro não foram tocados |

## Já existia (sem mudança)

| # | O que foi conferido |
|---|---|
| 6 | Front na CDN da Vercel e API atrás da Cloudflare (`CF-RAY ...-GRU`) |
| 9 | Brotli **verificado** na API (`Content-Encoding: br`) e no front (Vercel) |
| 16 | Agenda e dashboard já rodam consultas em paralelo. São 49 `Promise.all` no backend |
| 21 | Não há scripts de terceiros. O Google Fonts saiu no `914cf4b` |
| 24 | Caminhos críticos (mídia, agenda) já usam `select` enxuto |
| 25 | Pooler do Neon testado com 200 consultas concorrentes, sem `pgbouncer=true`: 0 erros de prepared statement |
| 29 | Outfit self-hosted com 4 pesos (`914cf4b`) |

## Não se aplica (motivo no mapeamento)

8 (os loops com consulta são de n pequeno, dentro de transação), 10 (Redis), 13 (não há IA), 20 (SSR), 23 (virtualização) e 28 (várias instâncias).

## Pendente: depende de você

1. **Aplicar o índice da melhoria 17 em produção.** Exporte a URL da produção, confira o host e rode `node prisma/apply-migrations.js` dentro de `backend-evolutech`. A migration é idempotente e as tabelas são pequenas.
2. **Melhoria 19, servidor perto do banco.** Medido: 63 ms por consulta, estável, entre o Render e o banco. Na mesma região seria menos de 5 ms. Não consegui ver a região do serviço (o conector do Render desconectou). Passos:
   1. No painel do Render, veja a região do `evolutech-r1pw`.
   2. Se for diferente da do banco de produção, recrie o serviço na mesma região do banco ou mova o banco.
   3. O `latency_ms` do `/api/health` deve cair para menos de 10 ms.
   4. Também medido: cold start de 33 s. Isso é o plano free do Render dormindo, e removê-lo é decisão de custo.
3. **Deploy e conferência.** Depois do merge e do deploy:
   - Rodar o Lighthouse de novo e preencher a tabela de [teste-celular.md](teste-celular.md).
   - Conferir `curl -I` em um arquivo de `/assets/` (deve vir com `immutable`).
   - Filtrar `[vitals]` e `[lenta]` nos logs do Render.
4. **Teste manual no navegador.** Os itens marcados "não verificado" acima: busca com debounce, seletores de cliente com mais de 200 clientes, upload de imagem, kanban e skeletons.

## Pulado (decisão de arquitetura, conforme a regra do pedido)

- **7 (parte 2), fila de verdade:** outbox no Postgres, ou Redis com BullMQ. Hoje os avisos de agenda saem sem `await` e se perdem se o processo reiniciar no meio.
- **28:** várias instâncias. Pré-requisito: tirar os jobs (`setInterval`) do processo web, ou a régua de mensalidades rodaria em dobro.
- **20:** pré-renderizar a landing. Exigiria ferramenta nova.

## Achados fora do escopo, para registro

- **Drift entre banco e `schema.prisma`, que já existia:** a tabela `employee_module_permissions` e os índices `customer_subscriptions_company_overdue_idx` e `customer_subscriptions_grace_until_idx` existem no banco, mas não no schema. Um `prisma migrate dev` tentaria apagá-los. Use sempre o `apply-migrations.js`.
- **`.env` e `.env.prod` apontam para endpoints Neon diferentes.** Vale confirmar qual deles o Render usa de fato.
- **A tela de Aparência (logo) barra arquivos acima de 2 MB antes do upload.** Com a otimização no navegador, esse limite poderia ser removido.
- **Os avatares do Radix (`AvatarImage`) pré-carregam a foto via JavaScript,** então `loading="lazy"` não tem efeito neles.
- **O Caixa usa a lista de clientes só como sugestão de texto (`datalist`)** e continua limitado a 200 sugestões. O filtro aceita qualquer nome digitado.

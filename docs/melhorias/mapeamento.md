# Mapeamento das 31 melhorias no Evolutech/iBarber

Levantamento feito em 15/11/2026, na branch `dev`, só com leitura de código.

**Medições:**
- GETs simples em `https://evolutech-r1pw.onrender.com/api/health`.
- Build local com sourcemap, gerado fora do `dist`.

**O que não foi feito:** nenhuma consulta a banco de dados, nenhuma escrita e nenhuma alteração de código.

**Legenda:**
- **APLICAR:** a melhoria se aplica e ainda não existe (ou existe só em parte).
- **JÁ EXISTE:** já está feita no projeto.
- **NÃO SE APLICA:** não faz sentido neste projeto hoje.
- **Não verificado:** não deu para confirmar com o que estava disponível.

Os itens marcados "requer aprovação" mexem em pagamento, infraestrutura ou contrato de API.

## Bloqueios encontrados antes de qualquer aplicação

1. **Não existe banco de dev separado.** O `backend-evolutech/.env.dev` tem a mesma `DATABASE_URL` do `.env` (hash idêntico): endpoint Neon `ep-bitter-lab-b4v4w6sc`, us-east-2. Só o `.env.prod` aponta para outro endpoint (`ep-nameless-bird-aivtbm6o`, us-east-1). Pela regra "migration só no banco de dev", o item 17 (índices) e qualquer teste com dados estão bloqueados até existir um banco de dev de verdade, por exemplo um branch do Neon. Também é preciso confirmar qual dos dois endpoints é a produção que o Render usa.
2. **Não há testes automatizados.** O `npm test` do backend é `echo "Error: no test specified" && exit 1`, e o front não tem script de teste. Por isso, "rodar os testes existentes" vira: build, lint e verificação manual descrita em cada item.
3. **A URL pública do front não está no repositório** (`vercel.json` só tem rewrite; `CORS_ORIGIN="*"`). Os itens 9 e 27 ficam "não verificado" do lado do front.
4. **A região do serviço no Render não está no repositório.** O item 19 tem uma medição forte, mas a causa fica "não verificado" até alguém olhar o painel do Render.

## Medições feitas

| O quê | Resultado |
|---|---|
| `/api/health`, 1ª chamada | 33,2 s (o serviço estava dormindo) |
| `/api/health`, chamadas seguintes | 0,48–0,77 s |
| `latency_ms` do `SELECT 1`, 6 amostras | 125, 63, 63, 63, 63, 63 ms |
| Compressão da API | `Content-Encoding: br`, servido por Cloudflare na frente do Render |
| JS inicial (`index-*.js`) | 528 kB minificado, 165 kB gzip |
| Maiores pesos no JS inicial (fonte, antes do minify) | framer-motion 395 kB · @remix-run/router 193 kB · react-dom 131 kB · tailwind-merge 72 kB · @tanstack/query-core 54 kB |

---

## 1. Skeleton de carregamento: APLICAR (parcial)

- **O que é:** mostrar o formato do conteúdo enquanto os dados chegam, em vez de spinner ou texto.
- **Problema que resolve:** a tela "pula" quando os dados chegam e parece mais lenta do que é.
- **O que já existe:** `.esqueleto-vidro` em [index.css](../../src/index.css), `EsqueletoDaTela` em [ConteudoDaRota.tsx](../../src/components/layouts/ConteudoDaRota.tsx), skeleton no dashboard (`CardMetrica`, gráfico) e no menu. São 12 arquivos usando skeleton.
- **Onde falta:** 16 telas em `src/pages` ainda mostram "Carregando..." em texto. Para listar: `grep -rlE "Carregando\.\.\." src/pages`.
- **Como implementar:**
  1. Criar um bloco de skeleton por formato (linha de tabela, card) reaproveitando `.esqueleto-vidro`.
  2. Trocar o texto pelo bloco, tela por tela.
  3. Manter o `role="status"` e o `aria-label`.
- **O que melhora:** a carga percebida e o layout estável (CLS).
- **Risco:** baixo, só apresentação. É preciso não esconder os estados de erro e de vazio.
- **Como testar:** DevTools em "Slow 4G" e abrir cada tela. O skeleton deve aparecer no lugar exato do conteúdo, e erro e vazio devem continuar aparecendo.

## 2. Imagens em WebP ou AVIF: APLICAR

- **O que é:** formatos modernos que pesam 25–50% menos que JPEG/PNG com a mesma qualidade.
- **Problema que resolve:**
  - `public/imagens/barbearia-capa.jpg` tem 173 kB e recebe `<link rel="preload">` em todas as rotas ([index.html:22](../../index.html)), inclusive no painel, que não mostra essa foto.
  - Os uploads (logo, foto do barbeiro, capa de curso) vão crus para o banco, com até 3 MB cada ([uploadImagem.ts](../../src/lib/uploadImagem.ts), `LIMITE_PADRAO`), e são servidos assim para o cliente no celular.
- **Onde entra:**
  - `public/imagens/`
  - `index.html`
  - `src/components/telas/TelaComFoto.tsx` (`FOTO_PADRAO`)
  - `src/lib/uploadImagem.ts`
  - O backend já aceita `image/webp` ([media.service.ts:29](../../backend-evolutech/src/services/media.service.ts)).
- **Como implementar:**
  1. Gerar `barbearia-capa.avif` e `.webp` com ffmpeg (ferramenta de build, sem dependência no projeto).
  2. Usar `<picture>` com fallback para JPEG.
  3. Tirar o preload global do `index.html` e deixar só nas telas que mostram a foto.
  4. No upload: redimensionar no navegador com `canvas` (lado máximo de ~1200 px) e exportar com `canvas.toBlob('image/webp', 0.82)` antes de converter para data URL. Sem biblioteca.
- **O que melhora:** o LCP das telas com foto, os dados móveis do cliente e o tamanho do banco.
- **Risco:**
  - Baixo para o arquivo estático.
  - Médio no upload: navegadores antigos sem `toBlob` em WebP. Nesse caso o arquivo deve seguir original.
  - Imagens que já estão no banco não mudam.
- **Como testar:**
  - Comparar o tamanho no Network antes e depois.
  - Enviar logo PNG com transparência e conferir que a transparência se mantém.
  - Enviar foto de 3 MB e conferir que chega com menos de 300 kB.
  - Abrir no Safari iOS.

## 3. Evitar chamadas duplicadas na API: JÁ EXISTE, com um ponto a aplicar

- **O que é:** duas partes da tela pedindo o mesmo dado viram uma requisição só.
- **O que já existe:**
  - [rede.ts](../../src/lib/rede.ts) `requisitar()`: GETs em andamento são compartilhados, com cache de 20 s. Qualquer escrita limpa o cache.
  - Os 4 services do front usam `requisitar`.
  - [useCompanyModules.ts](../../src/hooks/useCompanyModules.ts) tem cache próprio de 60 s.
- **Onde falta:**
  - O `useCompanyModules` chama `/auth/me` com `fetch` direto, e o `AuthContext` chama o mesmo `/auth/me` via `requisitar`. São duas requisições iguais a cada abertura do app.
  - Há outros `fetch` diretos em `Configuracoes.tsx` (3), `Login.tsx` e `uploadImagem.ts`. Esses são escritas, então não entram.
- **Como implementar:** trocar o `fetch` do `useCompanyModules` por `requisitar`, com a mesma URL e o mesmo header. A deduplicação passa a valer.
- **O que melhora:** uma ida e volta a menos na abertura. Cada `/auth/me` leva ~0,5 s medido no health, mais as consultas da rota.
- **Risco:** baixo. Atenção ao cache de 60 s de módulos, que precisa continuar valendo.
- **Como testar:** Network, logar e recarregar. Deve aparecer um `/auth/me` só.

## 4. Debounce na busca: APLICAR

- **O que é:** esperar o usuário parar de digitar (~300 ms) antes de buscar.
- **Problema que resolve:** hoje cada tecla dispara uma requisição. A busca chama `setFilters` direto ([SearchFilters.tsx:48](../../src/components/crud/SearchFilters.tsx)) e o `useEffect` de [Clientes.tsx:247](../../src/pages/empresa/Clientes.tsx) busca a cada mudança. Pior: sem cancelar a anterior, uma resposta lenta de "jo" pode chegar depois da de "joão" e mostrar a lista errada. Isso acontece em Clientes, Agendamentos, Pedidos e Produtos (as 4 telas que usam `SearchFilters`).
- **Onde entra:** `src/components/crud/SearchFilters.tsx` e as 4 telas. Opcional: um hook novo `src/hooks/useValorAtrasado.ts`.
- **Como implementar:**
  1. Hook de debounce com `setTimeout`, sem biblioteca.
  2. O campo mostra o valor digitado na hora, e o filtro só muda depois de 300 ms parado.
  3. Nas telas, descartar resposta velha com um contador de requisição ou `AbortController`. O `requisitar` já respeita `signal`.
  4. Quando a busca muda, voltar para a página 1.
- **O que melhora:** menos carga no backend e no Neon, e a lista certa sempre.
- **Risco:** baixo.
- **Como testar:** em Slow 3G, digitar "joão silva" rápido. Deve sair uma requisição só, e o resultado tem que corresponder ao texto final.

## 5. Paginar os resultados da API: APLICAR (correção)

- **O que é:** devolver os dados em páginas, com total.
- **O que já existe:**
  - O CRUD genérico pagina, com teto de 200 ([company.service.ts:591](../../backend-evolutech/src/services/company.service.ts), `MAX_PAGE_SIZE`).
  - Uso, cobranças e pedidos do PDV paginam com teto de 100.
- **Problema encontrado:** 11 chamadas no front pedem `pageSize: 200` e 3 pedem `pageSize: 500` para "carregar tudo" e montar seletores. O backend corta em 200 sem avisar. Com mais de 200 clientes ativos, o cliente 201 em diante simplesmente não aparece no seletor de:
  - Assinaturas
  - Fidelidade
  - Relatórios
  - Financeiro

  Produtos e Cursos pedem 500 e recebem 200. Isso afeta dinheiro: não dá para criar mensalidade para quem não aparece.
- **Onde entra:**
  - `src/pages/empresa/{Assinaturas,Fidelidade,Relatorios,Agendamentos,Caixa,Pdv,ServicosAgendamento,Produtos,Cursos}.tsx`
  - `src/pages/Financeiro.tsx`
  - `src/components/ui/searchable-select.tsx`
- **Como implementar:**
  1. Seletor de cliente com busca no servidor (`search` já existe no CRUD), debounce do item 4 e 20 resultados.
  2. Para serviços, profissionais e produtos (catálogos curtos), manter a lista, mas mostrar aviso quando `total > data.length` em vez de cortar em silêncio.
  3. O backend não muda.
- **O que melhora:** correção de dados, além de respostas menores.
- **Risco:** médio, porque mexe em formulários de assinatura e financeiro. A troca é só do componente de seleção; o payload enviado continua igual.
- **Como testar:** num banco de dev com mais de 250 clientes (bloqueado, ver Bloqueios), conferir que o cliente nº 250 é encontrado nos 4 seletores e que a assinatura criada para ele grava o `customerId` certo.

## 6. Arquivos estáticos por CDN: JÁ EXISTE

- **O que já existe:** o front é servido pela Vercel, que tem CDN global. A API passa pela Cloudflare (`Server: cloudflare`, `CF-RAY ...-GRU`, ponto de presença em São Paulo).
- **Não verificado:** se as imagens de `/api/public/media/:id` ficam em cache na borda da Cloudflare. A rota manda `Cache-Control: public, max-age=31536000, immutable` ([media.controller.ts:39](../../backend-evolutech/src/controllers/media.controller.ts)), mas a Cloudflare, por padrão, só cacheia URLs com extensão de arquivo estático. Para conferir, olhe `cf-cache-status` numa imagem real.
- **Ação:** nenhuma agora.

## 7. Tarefas lentas para uma fila: APLICAR em parte, e requer aprovação

- **O que é:** responder ao usuário na hora e processar o trabalho pesado em segundo plano, com nova tentativa.
- **O que já existe:**
  - Os avisos de agendamento já saem sem travar a resposta (`void appointmentNotificationService.avisar...` em `company.service.ts` e `customer-portal.service.ts`).
  - Os lembretes usam a tabela `AppointmentNotification` como registro (idempotente).
- **Problemas:**
  - Os avisos com `void` se perdem se o processo reiniciar no meio do envio. É comum no Render free, que dorme.
  - Os jobs rodam com `setInterval` dentro do processo web ([server.ts](../../backend-evolutech/src/server.ts)).
  - No pagamento, `avisarAssinaturaAtivada` aguarda o e-mail ([payment.service.ts](../../backend-evolutech/src/services/payment.service.ts), ~linha 277). Se ele roda dentro do webhook, um provedor de e-mail lento atrasa a resposta ao gateway, e o gateway pode reenviar o webhook.
- **Proposta, em duas partes:**
  1. **Pequena (requer aprovação, é fluxo de pagamento):** não aguardar o e-mail dentro do webhook. Disparar depois do commit, como já é feito na agenda.
  2. **Fila de verdade (decisão de arquitetura):** BullMQ exige Redis, que é infraestrutura nova. A alternativa sem biblioteca é uma tabela "outbox" no Postgres, que o job existente lê e reenvia. Precisa de migration, então está bloqueada pelo banco de dev.
- **Risco:**
  - Parte 1: baixo, desde que o e-mail continue saindo.
  - Parte 2: médio.
- **Como testar:** num webhook simulado no dev, medir a resposta com o provedor de e-mail lento. Deve responder em menos de 1 s, e o e-mail sai depois.

## 8. Corrigir consultas N+1: NÃO SE APLICA (nos pontos encontrados)

- **Busca feita:** `await prisma/tx.*` dentro de `for`/`.map(async)`. Apareceram 6 casos:
  - `admin.service.ts` 144, 197, 1119
  - `tenant.service.ts` 123
  - `company.service.ts` 5041, 6952

  São upserts de módulos de uma empresa e baixa de estoque por item de venda, dentro de transação, com poucos itens (n pequeno). Não são listagens.
- **O que já está bom:** a agenda (`getAgendaBoard`) já busca agendamentos, serviços e bloqueios em paralelo, com `include` do cliente numa consulta só.
- **Não verificado:** o `company.service.ts` tem 10.568 linhas, e a busca por padrão pode não pegar N+1 escondido em função auxiliar. Para pegar com certeza, rodar o dev com `PRISMA_LOG_QUERIES=true` e contar as consultas por rota.

## 9. Compressão Brotli ou Gzip: JÁ EXISTE

- **API:** verificado. `Content-Encoding: br` na resposta, aplicado pela Cloudflare/Render. Não precisa de `compression` no Express.
- **Front:** não verificado (URL desconhecida). A Vercel comprime por padrão.

## 10. Cache no Redis: NÃO SE APLICA agora

- **Motivo:** é uma instância só, não há Redis na infraestrutura, e o gargalo medido é a distância até o banco (item 19), não o volume de consultas.
- **O que já existe:** cache de leitura no front (item 3).
- **Se precisar no futuro:** cache em memória do processo para dados públicos e estáveis (`getPublicBookingOptions`, `getPublicBookingCompany`), com TTL curto. Funciona sem dependência enquanto houver uma instância só.

## 11. Remover dependências não usadas: APLICAR

- **Front, sem import em `src/`** (verificado por grep):
  - `@tanstack/react-query`: só o `QueryClientProvider` está montado, sem nenhum `useQuery`. Mesmo assim, 54 kB vão no JS inicial.
  - `zod`, `@hookform/resolvers`, `qrcode`.
- **Front, usados só por componentes `ui/` que ninguém importa:** `react-hook-form` (form), `embla-carousel-react` (carousel), `vaul` (drawer), `input-otp`, `react-resizable-panels`, e os pacotes Radix de accordion, aspect-ratio, collapsible, context-menu, hover-card, menubar, navigation-menu, radio-group, slider e toggle-group. Os componentes `ui/` órfãos são: accordion, aspect-ratio, breadcrumb, carousel, collapsible, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, radio-group, resizable, sidebar, slider, toggle-group.
- **DevDependencies do front:** `@types/bcryptjs` e `@types/jsonwebtoken` são tipos de backend.
- **Backend:** `qrcode` não tem uso.
- **Fica de fora (decisão sua):**
  - `@supabase/supabase-js` ainda é usado por 8 telas legadas (admin, chatbots, logs, métricas).
  - Há dois sistemas de toast: o Radix, usado em 4 arquivos, e o Sonner, em 46. Unificar é possível, mas é outra tarefa.
- **Como implementar:**
  1. Remover o `QueryClientProvider` do `App.tsx`.
  2. `npm uninstall` dos pacotes.
  3. Apagar os `ui/` órfãos.
  4. Build e lint.
- **O que melhora:** −54 kB de fonte no JS inicial (react-query), install mais rápido e menos superfície de vulnerabilidade.
- **Risco:** baixo. O build acusa qualquer import que ficar quebrado.
- **Como testar:** build, lint e navegar pelas telas principais.

## 12. Timeout nas APIs externas: APLICAR, requer aprovação (toca o pagamento)

- **Problema:** chamada externa sem prazo prende a requisição do usuário, e prende também o job, até a conexão cair, o que pode levar minutos.
- **Sem timeout hoje:**
  - `requestStripe` e `requestJson` em [payment.service.ts:19-110](../../backend-evolutech/src/services/payment.service.ts) (`https.request` sem `timeout`).
  - Envio de WhatsApp (Z-API) em [company.service.ts:1543](../../backend-evolutech/src/services/company.service.ts) (`fetch` sem `signal`).
  - Resend em [email.util.ts:175](../../backend-evolutech/src/utils/email.util.ts).
  - `webpush.sendNotification` em [push.service.ts:171](../../backend-evolutech/src/services/push.service.ts) (sem a opção `timeout`).
- **Já têm timeout:**
  - Gmail OAuth e envio: 15 s e 20 s.
  - SMTP: `connectionTimeout`, `greetingTimeout` e `socketTimeout`.
  - Front: o `requisitar` tem `tempoLimiteMs`.
- **Como implementar:**
  - `https.request`: `req.setTimeout(15000, () => req.destroy(new PaymentServiceError('Gateway não respondeu', 504)))`.
  - `fetch`: `signal: AbortSignal.timeout(15000)`.
  - web-push: opção `{ timeout: 10000 }`.
- **Cuidado no pagamento:** um timeout na criação de cobrança não significa que a cobrança não foi criada no gateway. A resposta ao usuário deve ser "não confirmado, confira antes de tentar de novo", e não "falhou". Por isso precisa de aprovação.
- **Risco:** baixo no WhatsApp, e-mail e push. Médio no pagamento.
- **Como testar:** apontar para um host que não responde (por exemplo, um IP fora de rota) no dev. A requisição deve falhar em ~15 s com 504, em vez de ficar pendurada.

## 13. Streaming da resposta da IA: NÃO SE APLICA

- **Motivo:** não há integração com LLM no backend (grep por openai, anthropic e gemini: nada). As telas de chatbot são legadas, via Supabase.

## 14. UI otimista: APLICAR, só onde é seguro

- **O que é:** atualizar a tela antes do servidor confirmar e desfazer se der erro.
- **Onde é seguro:** o kanban de "Minhas tarefas" ([EmpresaApp.tsx:93](../../src/pages/empresa/EmpresaApp.tsx), `moveTask` espera `moveMyTask` antes de mover o card).
- **Onde NÃO aplicar:** agenda (marcar, concluir, cancelar), caixa, PDV e cobranças. Para o dono, a tela mostrar "concluído" sem o servidor confirmar é pior do que esperar meio segundo.
- **Como implementar:**
  1. Mover o card no estado local primeiro.
  2. Chamar a API.
  3. Se der erro, voltar para a posição anterior e mostrar toast.
- **Risco:** baixo, desde que fique restrito a tarefas.
- **Como testar:** em Slow 3G, arrastar a tarefa. O card deve mover na hora. Com o backend desligado, o card volta e o erro aparece.

## 15. Lazy loading nas imagens fora da tela: APLICAR

- **Situação:** há 19 `<img>` no front e só 1 com `loading="lazy"`.
- **Onde entra:** fotos de barbeiro nos passos do agendamento e no portal do cliente (`EscolhaProfissional`, `CustomerDashboard`), logos e capas de curso. As imagens do topo da tela (logo do cabeçalho, capa do login) ficam sem lazy.
- **Como implementar:** `loading="lazy" decoding="async"`, com `width` e `height` para não deslocar o layout.
- **Risco:** baixo.
- **Como testar:** Network com Img filtrado. As fotos de baixo só devem baixar quando chegam perto da tela.

## 16. Requisições independentes em paralelo: JÁ EXISTE nos caminhos críticos

- **O que já existe:**
  - 49 `Promise.all` no backend e 23 no front.
  - A agenda e o dashboard já paralelizam, com comentário explicando ("await em fila custava uma ida e volta ao banco").
- **Não verificado:** a busca por padrão aponta 82 trechos com `await companyService` seguidos em páginas, mas boa parte depende do resultado anterior. A auditoria precisa ser tela por tela.
- **Prioridade:** baixa. Com 63 ms por consulta (item 19), cada consulta sequencial custa caro, mas só vale mexer onde o Network mostrar cascata.

## 17. Índices para as consultas mais comuns: APLICAR, bloqueado (precisa de banco de dev)

- **Tabelas sem índice nenhum** (o Postgres não cria índice automático em chave estrangeira):
  - `Order` (`orders`): é filtrada por `companyId` e período no faturamento do mês do dashboard, nos relatórios e no financeiro.
  - `AuditLog` (`audit_logs`): é filtrada por `companyId` e data nos logs.
  - `PaymentTransaction.orderId`: tem índice por `companyId,status,createdAt` e `externalPaymentId,provider`, mas não por `orderId`, que é como a transação é achada a partir do pedido.
- **Como implementar:**
  1. Adicionar no `schema.prisma`:
     - `@@index([companyId, createdAt])` e `@@index([companyId, status, createdAt])` em `Order`.
     - `@@index([orderId])` em `PaymentTransaction`.
     - `@@index([companyId, createdAt])` em `AuditLog`.
  2. Gerar a migration com `CREATE INDEX CONCURRENTLY` para não travar a tabela na produção.
  3. Aplicar primeiro no banco de dev e medir com `EXPLAIN ANALYZE`.
- **Risco:** baixo no código. O cuidado é operacional: criar índice em produção trava escrita se não for `CONCURRENTLY`.
- **Como testar:** `EXPLAIN ANALYZE` da consulta do faturamento do mês antes e depois, no dev. Deve trocar Seq Scan por Index Scan.

## 18. Rastrear requisições lentas (OpenTelemetry): APLICAR a versão leve

- **Situação:** há log de requisição opcional (`REQUEST_LOG_ENABLED`) em [server.ts](../../backend-evolutech/src/server.ts), mas ele loga tudo ou nada e não marca o que é lento.
- **Proposta:** OpenTelemetry exige SDK, instrumentações e um coletor ou serviço para ver os traces. São várias dependências novas e um serviço pago ou para hospedar. Sem isso definido, o ganho é zero. A versão leve, sem biblioteca:
  - Logar sempre as requisições acima de um limite (`SLOW_REQUEST_MS`, padrão 1500) com método, rota, status e tempo.
  - Com `PRISMA_LOG_QUERIES`, já dá para ver as consultas de uma rota.
- **Se você quiser OTel de verdade:** escolher antes onde ver os traces (Grafana Cloud, Honeycomb). É decisão sua.
- **Risco:** baixo.
- **Como testar:** com `SLOW_REQUEST_MS=1` no dev, toda requisição aparece no log com o tempo.

## 19. Servidor perto do banco: APLICAR, é infraestrutura e requer aprovação

- **Medição:** o `SELECT 1` leva 63 ms de forma estável, do servidor ao banco e de volta. Na mesma região, seria abaixo de 5 ms. Cada rota faz várias consultas, então cada consulta em sequência soma 63 ms.
- **Não verificado:** a região do serviço no Render. O banco do `.env.prod` está em us-east-1 (Virginia). Se o Render estiver em Oregon (o padrão), isso explicaria a latência.
- **Como implementar:**
  1. Ver a região no painel do Render.
  2. Recriar o serviço na região do banco (us-east / Virginia), ou criar o banco na região do Render.
  3. O código não muda.
- **Também medido:** a primeira chamada levou 33 s, porque o plano do Render dorme sem tráfego. O `keepalive.yml` pinga a cada 10 minutos, mas mesmo assim pegou o serviço dormindo. O plano pago remove isso. É decisão de custo.
- **O que melhora:** todas as rotas.
- **Risco:** baixo no código. Na operação, a troca de serviço exige mudar a URL da API no front, ou manter um domínio próprio.
- **Como testar:** o `latency_ms` do `/api/health` tem que cair para menos de 10 ms.

## 20. Renderizar no servidor ou no build: NÃO SE APLICA (por enquanto)

- **Motivo:** o painel é logado e não ganha nada com SSR. Só a landing (`/`) e o link público de agendamento ganhariam, em SEO e no primeiro carregamento. Isso exige uma ferramenta de pré-renderização (dependência nova) ou mudar de framework. Fica registrado como possibilidade para a landing.

## 21. Scripts de terceiros depois da página: JÁ EXISTE / NÃO SE APLICA

- **Situação:** não há analytics, pixel nem chat de terceiros no `index.html` ou no código (grep: gtag, fbq, hotjar e clarity, nada). O Google Fonts foi removido no commit `914cf4b`.

## 22. Dividir o JavaScript por página: JÁ EXISTE, com um ponto a aplicar

- **O que já existe:** todas as telas usam `lazyTela()` ([lib/telas.ts](../../src/lib/telas.ts)) e são pré-carregadas no ócio.
- **Problema:** o `framer-motion` (o maior pacote do JS inicial, 395 kB de fonte) entra no chunk inicial. O motivo é que [ConteudoDaRota.tsx](../../src/components/layouts/ConteudoDaRota.tsx) usa a biblioteca, e os dois layouts são importados direto no `App.tsx`. O cliente que só abre `/agendar/:slug` baixa a animação de troca de tela do painel. O mesmo vale para o `@tanstack/query-core` (item 11).
- **Como implementar** (duas opções):
  - (a) Carregar `EmpresaLayout` e `AdminEvolutechLayout` com `lazyTela`.
  - (b) Trocar a transição do `ConteudoDaRota` por CSS (`animate-fade-in` já existe). Isso respeita o `prefers-reduced-motion` global.
  - A (b) remove a dependência do caminho inicial sem mudar o carregamento. A Landing continua usando framer-motion no chunk dela.
- **O que melhora:** o JS inicial do cliente.
- **Risco:** baixo.
- **Como testar:** comparar o tamanho do `index-*.js` no build antes e depois. Abrir `/agendar/:slug` com cache limpo e conferir no Network que nenhum chunk com framer-motion baixa.

## 23. Virtualizar listas longas: NÃO SE APLICA

- **Motivo:** as listas da tela são paginadas no servidor (10–50 por página), e os seletores trazem no máximo 200 itens. Virtualização só compensa a partir de milhares de linhas na tela. Também exigiria biblioteca.

## 24. Pedir só as colunas necessárias: JÁ EXISTE nos caminhos críticos

- **O que já existe:**
  - Mídia: `select` só do que é preciso, sem trazer o `bytea` à toa.
  - A agenda usa `select`/`include` enxuto.
  - 37 dos 132 `findMany` usam `select`.
- **Ponto opcional:** o CRUD genérico (`listTableData`) devolve as linhas inteiras. Não há coluna pesada nessas tabelas, então o ganho é pequeno.
- **Prioridade:** baixa.

## 25. Pool de conexões: JÁ EXISTE, com um ponto a verificar

- **O que já existe:** a `DATABASE_URL` usa o endpoint `-pooler` do Neon (PgBouncer) e o Prisma mantém o pool dele. O `DIRECT_URL` serve para as migrations.
- **Não verificado:** o `.env.example` traz `pgbouncer=true`, mas o `.env` real não. Com PgBouncer em modo transação, o Prisma 5.10 pode precisar desse parâmetro por causa dos prepared statements. O PgBouncer do Neon, versão 1.22+, suporta prepared statements, então hoje pode estar tudo certo. Conferir nos logs de produção se há erro `prepared statement "s0" already exists`. Também não há `connection_limit` definido.
- **Ação:** só verificar. Não mudar sem evidência.

## 26. Evitar re-render desnecessário: APLICAR pontual (prioridade baixa)

- **Situação:** o `value` do [AuthContext.tsx:269](../../src/contexts/AuthContext.tsx) é um objeto novo a cada render, o que re-renderiza todos os consumidores.
- **Não verificado:** não há medição no React Profiler mostrando custo real.
- **Como implementar:** `useMemo` no `value`. Medir antes com o Profiler.
- **Risco:** baixo.

## 27. Cache dos estáticos no navegador: APLICAR

- **Situação:** os arquivos de `/assets/*` têm hash no nome e nunca mudam, mas o `vercel.json` não define `Cache-Control`. A documentação da Vercel indica que o navegador recebe `max-age=0, must-revalidate` por padrão, e revalida a cada visita. Não verificado na URL real.
- **O que existe:** quem instalou o PWA já tem cache pelo service worker (`CacheFirst` em `/assets/`). Quem abre pelo navegador, como o cliente no link de agendamento, não tem.
- **Como implementar:** adicionar ao `vercel.json` `headers` para `/assets/(.*)` com `Cache-Control: public, max-age=31536000, immutable`. O `index.html` e o `sw.js` ficam sem cache longo.
- **Risco:** baixo. Errar o padrão e cachear o `index.html` seria grave, por isso o padrão fica restrito a `/assets/`.
- **Como testar:** depois do deploy, `curl -I <front>/assets/index-*.js` deve mostrar o header, e `curl -I <front>/` não.

## 28. Distribuir o tráfego entre várias instâncias: NÃO SE APLICA agora

- **Motivo:** o volume atual cabe numa instância.
- **Impedimento técnico:** os jobs rodam com `setInterval` dentro do processo web ([server.ts](../../backend-evolutech/src/server.ts)). Com duas instâncias, cobranças e lembretes rodariam em dobro. O lembrete é idempotente pela tabela, mas a régua de mensalidades precisaria ser revisada. Pré-requisito: tirar os jobs do processo web ou pôr um lock no banco.

## 29. Hospedar as fontes e limitar os pesos: JÁ EXISTE

- **O que já existe:** Outfit self-hosted via `@fontsource`, com 4 pesos (400, 500, 600, 700), no commit `914cf4b` desta mesma branch. Sem CDN externo.
- **Ponto opcional:** conferir se o peso 500 é usado. Se não for, cai um arquivo de 14 kB.

## 30. Monitorar a velocidade dos usuários reais (RUM): APLICAR, requer aprovação (endpoint novo)

- **Situação:** não existe medição de usuários reais.
- **Como implementar:**
  1. No front, `PerformanceObserver` para LCP, CLS e INP (sem biblioteca; `web-vitals` seria +2 kB).
  2. Enviar com `navigator.sendBeacon` para um endpoint novo `POST /api/public/vitals`.
  3. No backend, gravar em log (ou numa tabela nova, que precisa de migration).
- **Decisão sua:** é um endpoint novo, ou seja, mudança de contrato de API, e precisa de definição sobre onde guardar os dados.
- **Risco:** baixo. Precisa de rate limit, que já existe em `/api`.

## 31. Testar no celular e em rede lenta: APLICAR (processo)

- **Proposta:** um checklist em `docs/melhorias/teste-celular.md` com:
  - Chrome DevTools: dispositivo Moto G Power, "Slow 4G", CPU 4x mais lenta.
  - Lighthouse mobile nas rotas `/agendar/:slug`, `/login` e `/empresa/dashboard`.
  - Metas: LCP abaixo de 2,5 s e INP abaixo de 200 ms.
  - Teste num aparelho Android de entrada real.
- **Não verificado:** não rodei Lighthouse, porque falta a URL do front e o login.

---

## Resumo da classificação

| Classificação | Itens |
|---|---|
| APLICAR | 1 (parcial), 2, 3 (pontual), 4, 5, 7 (parte), 11, 12, 14 (só tarefas), 15, 17, 18 (versão leve), 19, 22 (pontual), 26, 27, 30, 31 |
| JÁ EXISTE | 6, 9, 16, 21, 24, 25 (verificar), 29 |
| NÃO SE APLICA | 8, 10, 13, 20, 23, 28 |

**Exigem aprovação ou decisão antes de aplicar:**
- 7 e 12: pagamento.
- 17: banco de dev.
- 19: infraestrutura.
- 30: endpoint novo.
- 7 parte 2: fila e arquitetura.

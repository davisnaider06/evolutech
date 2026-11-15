# Roadmap: melhorias classificadas como APLICAR

Ordem dos lotes:
1. Primeiro o que protege dinheiro, agenda e segurança.
2. Depois, impacto medido.
3. Por último, conforto.

Cada lote é pequeno e fecha com build e lint. Os testes automatizados não existem; a verificação é manual, como descrito no [mapeamento](mapeamento.md). Cada melhoria vira um commit.

Legenda de status:
- **pronto:** posso aplicar.
- **aprovação:** você precisa autorizar (pagamento, infraestrutura ou contrato de API).
- **bloqueado:** depende de um banco de dev separado.

## Lote 1: dinheiro e agenda, risco baixo

| Ordem | Melhoria | Por que vem primeiro | Status |
|---|---|---|---|
| 1.1 | **12** Timeout no WhatsApp, Resend e web-push | Chamada pendurada segura job de lembrete e de cobrança | pronto |
| 1.2 | **12** Timeout no Stripe e no gateway, com mensagem "não confirmado" | Cobrança pendurada sem resposta | aprovação (pagamento) |
| 1.3 | **7.1** Webhook de pagamento não aguarda o e-mail | Webhook lento leva o gateway a reenviar | aprovação (pagamento) |
| 1.4 | **5** Seletores de cliente com busca no servidor, sem corte silencioso em 200 | Cliente nº 201 some de Assinaturas, Fidelidade, Relatórios e Financeiro | pronto (teste com +200 clientes bloqueado) |
| 1.5 | **4** Debounce e descarte de resposta velha nas buscas | Resposta fora de ordem mostra a lista errada na Agenda e em Clientes | pronto |

**Dependência:** o 1.4 reaproveita o debounce do 1.5. A ordem real de aplicação é 1.5 → 1.4.

## Lote 2: banco (bloqueado até existir banco de dev)

| Ordem | Melhoria | Status |
|---|---|---|
| 2.1 | **17** Índices em `orders`, `payment_transactions.orderId` e `audit_logs`, com `CREATE INDEX CONCURRENTLY` | bloqueado |
| 2.2 | **25** Conferir `pgbouncer=true` e `connection_limit` nos logs, sem mudar nada antes de ter evidência | só verificação |

## Lote 3: infraestrutura (decisão sua, sem código)

| Ordem | Melhoria | Status |
|---|---|---|
| 3.1 | **19** Servidor e banco na mesma região (63 ms por consulta medidos) | aprovação (infraestrutura) |
| 3.2 | **19** Cold start de 33 s no Render (plano pago ou outra hospedagem) | aprovação (custo) |

O lote 3 é o de maior ganho por rota, mas depende só de você no painel do Render e do Neon.

## Lote 4: peso do app (front)

| Ordem | Melhoria | Status |
|---|---|---|
| 4.1 | **11** Remover `@tanstack/react-query`, `zod`, `@hookform/resolvers` e `qrcode` (front e back), além dos `ui/` órfãos e das dependências deles | pronto |
| 4.2 | **22** Transição de tela em CSS, tirando o framer-motion do JS inicial | pronto |
| 4.3 | **27** `Cache-Control: immutable` para `/assets/*` no `vercel.json` | pronto |
| 4.4 | **2** Capa em AVIF/WebP e preload só onde a foto aparece | pronto |
| 4.5 | **2** Upload redimensionado e convertido para WebP no navegador | pronto |
| 4.6 | **15** `loading="lazy"` nas imagens fora da tela | pronto |
| 4.7 | **3** `/auth/me` sem requisição duplicada na abertura | pronto |

## Lote 5: medição

| Ordem | Melhoria | Status |
|---|---|---|
| 5.1 | **18** Log de requisição lenta (`SLOW_REQUEST_MS`), sem biblioteca | pronto |
| 5.2 | **31** Checklist de teste em celular e rede lenta | pronto |
| 5.3 | **30** RUM (Web Vitals) com endpoint novo | aprovação (contrato de API) |

## Lote 6: conforto, prioridade baixa

| Ordem | Melhoria | Status |
|---|---|---|
| 6.1 | **1** Skeleton nas 16 telas que ainda mostram "Carregando..." | pronto |
| 6.2 | **14** Kanban de tarefas otimista (só tarefas) | pronto |
| 6.3 | **26** `useMemo` no value do AuthContext, medindo antes no Profiler | pronto |

## Fora do roadmap (decisão de arquitetura)

- **7.2:** fila de verdade, com outbox no Postgres ou Redis + BullMQ.
- **28:** várias instâncias. Pré-requisito: tirar os jobs do processo web.
- **20:** pré-renderização da landing.

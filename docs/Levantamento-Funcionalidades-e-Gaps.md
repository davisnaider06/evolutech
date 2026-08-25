# Evolutech Digital Core — Levantamento Completo de Funcionalidades

Versao: 1.0
Data: 25/08/2026
Base analisada: `backend-evolutech` (Express + Prisma + PostgreSQL/Neon) e `src` (React + Vite + shadcn/ui)

---

## Indice

1. Arquitetura e papeis
2. Catalogo de modulos comercializaveis
3. Funcionalidades por area (levantamento completo)
4. Modelo de dados (resumo)
5. O sistema aplicado a barbearias
6. Levantamento de Requisitos (Booksy / App Barber) — analise de aderencia
7. Mapeamento de implementacao dos gaps

---

## 1) Arquitetura e papeis

**Stack**
- Backend: Node + Express + TypeScript, Prisma ORM, PostgreSQL (Neon), JWT, bcrypt.
- Frontend: React 18 + Vite + TypeScript, TailwindCSS + shadcn/ui, React Router, TanStack Query, Recharts, framer-motion.
- Integracoes: Z-API (WhatsApp), gateways de pagamento (catalogo proprio), XLSX para exportacoes, PWA.

**Modelo multi-tenant**
Uma unica base atende varias empresas. Todo dado operacional carrega `empresa_id` e o acesso e filtrado por ele em todas as queries de servico.

**Papeis (enum `Role`)**

| Papel | Escopo | Onde entra |
| --- | --- | --- |
| `SUPER_ADMIN_EVOLUTECH` | Toda a plataforma | `/admin-evolutech` |
| `ADMIN_EVOLUTECH` | Suporte a tickets | `/admin-evolutech/suporte` |
| `DONO_EMPRESA` | Uma empresa | `/empresa/*` |
| `FUNCIONARIO_EMPRESA` | Uma empresa, escopo reduzido por permissao | `/empresa/*` |
| Cliente final (`CustomerAccount`) | Portal proprio, token separado | `/cliente/*` |

Autenticacao de usuario interno e de cliente final sao independentes: middlewares `authenticateToken` e `authenticateCustomerToken`, com tokens distintos.

**Controle de acesso em tres camadas**
1. `requireRoles` nas rotas administrativas.
2. `ensureModuleAccess` / `ensureAnyModuleAccess` — a empresa precisa ter o modulo contratado e ativo.
3. `allowedRoles` no modulo + permissoes individuais por funcionario (`/empresa/permissoes`).

---

## 2) Catalogo de modulos comercializaveis

Definido em `prisma/seed.ts`. Modulos `isCore` sao gratuitos e obrigatorios; os demais sao vendidos por assinatura mensal.

| Codigo | Nome | Core | Preco/mes |
| --- | --- | --- | --- |
| `dashboard` | Dashboard | sim | — |
| `clientes` | Clientes | sim | — |
| `agendamentos` | Agendamentos | sim | — |
| `permissions` | Permissoes de Equipe | sim | — |
| `support` | Suporte | sim | — |
| `vendas` | Vendas | nao | R$ 49,90 |
| `pdv` | PDV | nao | R$ 79,90 |
| `produtos` | Produtos / Estoque | nao | R$ 39,90 |
| `financeiro` | Financeiro | nao | R$ 59,90 |
| `relatorios` | Relatorios | nao | R$ 29,90 |
| `fidelidade` | Fidelidade | nao | R$ 29,90 |
| `assinaturas` | Assinaturas | nao | R$ 49,90 |
| `comissoes_dono` | Comissoes (visao dono) | nao | R$ 29,90 |
| `commissions_staff` | Comissoes (visao funcionario) | nao | — |
| `collections` | Cobranca e Inadimplencia (PRO) | nao | R$ 59,90 |
| `customer_portal` | Portal do Cliente | nao | R$ 39,90 |
| `courses` | Cursos | nao | R$ 79,90 |

**Sistemas Base** agrupam modulos em um pacote vendavel. Hoje existe o sistema base **Barbearia**, com os 17 modulos vinculados e 6 marcados como obrigatorios (`dashboard`, `clientes`, `agendamentos`, `customer_portal`, `permissions`, `support`).

---

## 3) Funcionalidades por area (levantamento completo)

### 3.1 Painel Super Admin (`/admin-evolutech`)

| Tela | Funcionalidade |
| --- | --- |
| Dashboard Admin | Metricas globais da plataforma, atividades recentes |
| Empresas | CRUD de tenants, vinculo com Sistema Base, ativacao/suspensao, exclusao |
| Sistemas Base | CRUD de pacotes e composicao de modulos por pacote |
| Modulos | CRUD do catalogo, preco mensal, flag PRO, `allowedRoles` |
| Usuarios / Gerenciar Usuarios | Criacao de usuarios, troca de papel, ativar/desativar |
| Gateways de Pagamento | Catalogo global de gateways e credenciais |
| WhatsApp Automacao | Configuracao da automacao de mensagens |
| Chatbots | Gestao de chatbots publicos (`/chat/:slug`) |
| Suporte | Fila de tickets de todas as empresas, resposta e mudanca de status |
| Evolucoes | Registro de evolucoes/releases |
| Treinamentos | Materiais de treinamento |
| Logs | Auditoria (`AuditLog`) |
| Temas Global / Tema por tenant | Whitelabel: cores, logo, identidade |
| Metricas Globais | Indicadores consolidados |
| Financeiro Admin | Receita da plataforma |
| System Verification | Checagem de saude do sistema |

### 3.2 Painel da Empresa (`/empresa`)

**Operacao**
- **Dashboard** (`/empresa/dashboard`) — metricas do negocio via `dashboard/metrics`.
- **App / Kanban** (`/empresa/app`) — tarefas pessoais com colunas e movimentacao (`tasks/my`).
- **Clientes** (`/empresa/clientes`) — CRUD, busca por nome/email/telefone/documento, historico de atendimento (`customers/:id/history`), lancamentos manuais de historico, follow-ups de retorno.
- **Agendamentos** (`/empresa/agendamentos`) — agenda, CRUD de servicos (`appointment_services`) com duracao, preco e dias recomendados de retorno; grade de disponibilidade por profissional e dia da semana.
- **Produtos** (`/empresa/produtos`) — CRUD, SKU, preco, quantidade em estoque, importacao via CSV/XLSX (`products/import`).
- **PDV** (`/empresa/pdv`) — carrinho, preview de total, preview de fidelidade, checkout, confirmacao manual de PIX, listagem de pedidos.
- **Pedidos** (`/empresa/pedidos`) — historico de vendas.
- **Caixa** (`/empresa/caixa`) — entradas e saidas (`cash_transactions`), visao consolidada.

**Financeiro**
- **Financeiro** (`/empresa/financeiro`) — visao geral de receita/despesa.
- **Cobrancas** (`/empresa/cobrancas`) — `BillingCharge`, lembretes automaticos (`BillingReminder`), regua de cobranca com execucao agendada, reprocessamento, metricas de inadimplencia, exportacao XLSX dos logs.
- **Comissoes** (`/empresa/comissoes`) — perfil de comissao por profissional (% servico, % produto, fixo mensal), ajustes manuais com motivo, apuracao mensal, pagamentos (`CommissionPayout`), exportacao XLSX.
- **Gateways** (`/empresa/gateways`) — conexao dos gateways da propria empresa, ativacao, remocao.
- **Relatorios** (`/empresa/relatorios`) — visao consolidada, vendas por cliente.

**Recorrencia e retencao**
- **Assinaturas** (`/empresa/assinaturas`) — planos (`SubscriptionPlan`) com intervalo, preco, servicos inclusos ou ilimitado; assinaturas de clientes com vigencia, saldo de servicos, renovacao automatica; consumo (`SubscriptionUsage`) abatido no PDV.
- **Fidelidade** (`/empresa/fidelidade`) — pontos por servico, cashback percentual, 10o servico gratis, valor do ponto; saldo por cliente e extrato de transacoes.
- **Cursos** (`/empresa/cursos`) — catalogo, venda e liberacao de acesso.

**Gestao**
- **Equipe** (`/empresa/equipe`) — CRUD de membros, convites por link (`/aceitar-convite`).
- **Permissoes** (`/empresa/permissoes`) — permissao por modulo por funcionario, com diagnostico.
- **Temas / Personalizacao** (`/empresa/temas`) — identidade visual da empresa.
- **Suporte** (`/empresa/suporte`) — abertura e acompanhamento de chamados.
- **Treinamentos** (`/empresa/treinamentos`).

### 3.3 Portal do Cliente Final (`/cliente`)

- Cadastro e login proprios por empresa (`/cliente/:slug/cadastro`), sem confirmacao de e-mail.
- Dashboard com agendamentos, plano e fidelidade.
- Agendamento: lista servicos com preco, lista profissionais, consulta slots livres, cria e cancela agendamento.
- Assinaturas: ve planos disponiveis e assina.
- Fidelidade: consulta saldo e extrato.
- Cursos: catalogo, compra e acesso.

### 3.4 Canais publicos (sem login)

- **Agendamento publico** (`/agendar/:slug`) — servicos, profissionais, slots e criacao de agendamento sem conta.
- **Chatbot publico** (`/chat/:slug`).
- **Landing de vendas** (`/vendas`).

### 3.5 Integracoes

- **WhatsApp (Z-API)** — `POST /company/whatsapp/send`, com `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN`. Hoje consumido pela regua de cobranca.
- **Gateways de pagamento** — catalogo em `paymentGatewayCatalog.ts`, transacoes em `PaymentTransaction`, webhooks em `payment-webhook.routes.ts`, link de pagamento e confirmacao de PIX.
- **XLSX** — exportacao de comissoes e de logs de cobranca; importacao de produtos.

---

## 4) Modelo de dados (resumo)

37 models. Agrupados:

- **Plataforma**: `User`, `UserRole`, `Company`, `CompanyTheme`, `Modulo`, `SistemaBase`, `SistemaBaseModulo`, `CompanyModule`, `AuditLog`, `SupportTicket`.
- **Operacao**: `Customer`, `CustomerAccount`, `Product`, `Order`, `CashTransaction`, `Task`.
- **Agenda**: `Appointment`, `AppointmentService`, `AppointmentAvailability`, `CustomerServiceHistoryEntry`.
- **Pagamentos**: `PaymentGateway`, `PaymentTransaction`, `BillingCharge`, `BillingReminder`, `CollectionAutomationRun`.
- **Comissoes**: `CommissionProfile`, `CommissionAdjustment`, `CommissionPayout`.
- **Fidelidade**: `CompanyLoyaltySettings`, `CustomerLoyaltyProfile`, `CustomerLoyaltyTransaction`.
- **Recorrencia**: `SubscriptionPlan`, `CustomerSubscription`, `SubscriptionUsage`.
- **Cursos**: `Course`, `CourseAccess`.

---

## 5) O sistema aplicado a barbearias

Esta secao traduz o produto generico para a operacao real de uma barbearia.

### 5.1 Por que o encaixe e natural

A barbearia tem quatro caracteristicas que o sistema ja atende de forma nativa:

1. **Servico com hora marcada e duracao fixa.** `AppointmentService.durationMinutes` ja nasce com padrao de 30 minutos, exatamente a grade de corte.
2. **Profissional como unidade de producao.** Cada barbeiro tem agenda propria (`AppointmentAvailability` por dia da semana) e comissao propria (`CommissionProfile`).
3. **Receita recorrente.** O "cliente mensalista" e um `CustomerSubscription` com plano de N cortes ou ilimitado, consumido automaticamente no PDV.
4. **Venda de balcao junto do servico.** Pomada, cera, minoxidil — `Product` + `PDV` no mesmo fechamento do corte.

### 5.2 Traducao de conceitos

| Conceito da barbearia | Objeto no sistema |
| --- | --- |
| Corte, barba, sobrancelha, combo | `AppointmentService` (nome, duracao, preco, retorno recomendado) |
| Barbeiro | `User` com papel `FUNCIONARIO_EMPRESA` (ou `DONO_EMPRESA`) |
| Horario de trabalho do barbeiro | `AppointmentAvailability` (dia da semana, inicio, fim) |
| Cadeira ocupada | `Appointment` (cliente, servico, barbeiro, horario, status) |
| Cliente mensalista | `CustomerSubscription` sobre um `SubscriptionPlan` |
| Cartao fidelidade (10o corte gratis) | `CompanyLoyaltySettings.tenthServiceFree` |
| Comanda / fechamento | `Order` gerado pelo PDV |
| Caixa do dia | `CashTransaction` |
| Comissao do barbeiro | `CommissionProfile` + `CommissionAdjustment` + `CommissionPayout` |
| Produtos de balcao | `Product` com `stockQuantity` |
| Ficha do cliente (o que ele cortou, com quem) | `CustomerServiceHistoryEntry` |
| "Sumiu, precisa chamar" | Follow-up por `returnDueAt` |

### 5.3 Jornadas

**Cliente final**
1. Acessa `/cliente/:slug/cadastro`, cria conta com nome, e-mail, telefone e senha. Nao ha confirmacao de e-mail — o acesso e imediato.
2. Ve a lista de servicos com preco.
3. Escolhe o barbeiro, o dia e um horario livre da grade.
4. Confirma. O agendamento aparece em destaque no dashboard dele.
5. Pode cancelar pelo proprio portal.
6. Consulta saldo de fidelidade e o plano mensal ativo.

Quem nao quer criar conta usa `/agendar/:slug`, que faz o mesmo fluxo sem login.

**Barbeiro**
1. Entra em `/empresa/dashboard` e ve seus numeros.
2. Consulta a agenda do dia em `/empresa/agendamentos`.
3. Acompanha a propria comissao em `/empresa/comissoes` (o backend forca o filtro para o proprio `userId` quando o papel e `FUNCIONARIO_EMPRESA`).
4. Fecha a comanda no PDV, somando corte e produto.

**Dono**
1. Cadastra servicos, precos e duracoes.
2. Cadastra barbeiros, define a grade de horario de cada um e o percentual de comissao.
3. Cria os planos de mensalidade.
4. Acompanha caixa, relatorios e inadimplencia.
5. Fecha a comissao do mes e registra o pagamento.

### 5.4 Configuracao recomendada para uma barbearia

| Item | Recomendacao |
| --- | --- |
| Sistema Base | Barbearia |
| Modulos obrigatorios | dashboard, clientes, agendamentos, customer_portal, permissions, support |
| Modulos recomendados | pdv, produtos, financeiro, relatorios, fidelidade, assinaturas, comissoes_dono, commissions_staff |
| Modulos opcionais | collections (barbearias com muita mensalidade), courses (barbearia que da curso) |
| Duracao padrao de servico | 30 minutos |
| Fidelidade | `tenthServiceFree = true`, 1 ponto por servico |
| Comissao padrao | 40% servico, 10% produto |

---

## 6) Levantamento de Requisitos (Booksy / App Barber) — analise de aderencia

Analise item a item do `Levantamento_de_Requisitos.pdf` contra o codigo atual.

Legenda: **OK** = pronto · **PARCIAL** = existe base, falta comportamento · **FALTA** = nao existe.

### 6.1 Funcionalidades de Clientes

| # | Requisito | Situacao | Evidencia / lacuna |
| --- | --- | --- | --- |
| 1 | Marcar corte conforme agenda disponivel | **OK** | `GET /customer/appointments/slots` + `POST /customer/appointments`, com validacao de janela e conflito |
| 2 | Visualizar servicos com precos | **OK** | `AppointmentService.price` exposto em `booking-options` |
| 3 | Pode ou nao escolher o barbeiro | **FALTA** | `professional_id` e **obrigatorio** em `listAvailableSlots` e em `createMyAppointment`. Nao existe opcao "qualquer barbeiro" |
| 4 | Interface limpa com destaque nos agendamentos | **OK** | `CustomerDashboard.tsx` ja destaca os proximos agendamentos |
| 5 | Lembretes no WhatsApp | **PARCIAL** | O canal Z-API existe e funciona, mas so a regua de **cobranca** dispara. Nao ha lembrete de **agendamento** |
| 6 | Cadastro sem e-mail confirmado | **OK** | `customer-auth.service.ts` cria a conta e libera o acesso na hora, sem token de verificacao |
| 7 | Agendar com 30 minutos de tolerancia | **FALTA** | Nao ha nenhuma nocao de tolerancia no codigo. A unica validacao e `scheduledAt >= agora` |

### 6.2 Funcionalidades do Dono

| # | Requisito | Situacao | Evidencia / lacuna |
| --- | --- | --- | --- |
| 8 | Visualizar desempenho de funcionarios | **PARCIAL** | `commissions/overview` da faturamento e comissao por profissional. Falta um painel de desempenho com atendimentos, ticket medio, taxa de retorno e ranking |
| 9 | Visualizar clientes e ha quanto tempo estao desativados | **PRONTO (25/08)** | `lastVisitAt` + `deactivatedAt`; colunas "Ultima visita" e "desativado ha X dias"; filtro de 30/60/90/180 dias |
| 10a | Saber qual cliente e mensal | **OK** | `GET /company/subscriptions/customers` |
| 10b | Definir qual cliente e mensal | **OK** | `POST/PUT /company/subscriptions/customers` |
| 11a | Historico de pagamentos com aumentar/diminuir comissao **por dia** | **PRONTO (25/08)** | `CommissionAdjustment.refDate`; extrato diario na tela e `adjustments_by_day` no overview |
| 11b | Exportar documento para o contador | **PARCIAL** | Existe `commissions/export` (XLSX de comissoes). Nao existe um fechamento contabil com receita, despesa, impostos e por forma de pagamento |
| 12 | Financeiro com informacoes completas | **OK** | `financeiro/overview`, `cash/overview`, `reports/overview`, `collections/metrics` |

### 6.3 Funcionalidades do Barbeiro

| # | Requisito | Situacao | Evidencia / lacuna |
| --- | --- | --- | --- |
| 13 | Bloquear horario com intervalo de tempo (almoco etc.) | **PRONTO (25/08)** | Model `AppointmentBlock`, pontual ou recorrente; abatido nos 4 pontos de calculo de horario |
| 14 | Dashboard completo das proprias informacoes | **PARCIAL** | O dashboard da empresa nao e recortado por profissional. So comissoes respeita o escopo do funcionario |
| 15 | Seus proprios clientes, com agendamento e mensalistas | **PRONTO (25/08)** | `Customer.preferredProfessionalId` + `scope=mine` em clientes e mensalidades |

### 6.4 Estoque e caracteristicas gerais

| # | Requisito | Situacao | Evidencia / lacuna |
| --- | --- | --- | --- |
| 16 | Estoque da barbearia | **OK** | `Product.stockQuantity`, CRUD, importacao em massa, baixa no PDV |
| 17 | Design de agenda | **PRONTO (25/08)** | `AgendaBoard`: timeline com uma coluna por barbeiro, blocos proporcionais a duracao, cores por status e ocupacao do dia |
| 18 | Cada agendamento dura 30 minutos | **OK** | `durationMinutes` com padrao 30 |
| 19 | Um cliente pode ter varios agendamentos ativos | **OK** | Nao ha nenhuma restricao de agendamento unico por cliente |
| 20 | Cliente mensal vinculado a um barbeiro | **PRONTO (25/08)** | `CustomerSubscription.professionalId`, herdado do barbeiro do cliente |

### 6.5 Resumo

| Situacao | Qtd | Itens |
| --- | --- | --- |
**Situacao original (25/08, manha):**

| Situacao | Qtd | Itens |
| --- | --- | --- |
| **OK** | 10 | 1, 2, 4, 6, 10a, 10b, 12, 16, 18, 19 |
| **PARCIAL** | 7 | 5, 8, 11a, 11b, 13, 14, 17 |
| **FALTA** | 5 | 3, 7, 9, 15, 20 |

**Situacao apos a entrega de 25/08:**

| Situacao | Qtd | Itens |
| --- | --- | --- |
| **OK** | 16 | 1, 2, 4, 6, 9, 10a, 10b, 11a, 12, 13, 15, 16, 17, 18, 19, 20 |
| **PARCIAL** | 3 | 5, 8, 11b |
| **FALTA** | 3 | 3, 7, 14 |

Total de 22 requisitos. Aderencia: passou de **45% para 73% pronto**.
Contando o parcial como meio ponto, a cobertura foi de **61% para 80%**.

Continuam em aberto: lembrete de agendamento no WhatsApp (5), painel de desempenho
da equipe (8), fechamento contabil (11b), opcao "qualquer barbeiro" (3), tolerancia
de 30 minutos (7) e dashboard recortado por barbeiro (14).

---

## 7) Mapeamento de implementacao dos gaps

Ordenado por relacao valor/esforco. Estimativas para um desenvolvedor.

### Lote A — Banco de dados (fazer primeiro, uma unica migracao)

Uma migracao Prisma resolve a base de 4 gaps de uma vez:

```prisma
// 1) Mensalista vinculado a um barbeiro (gap 20)
model CustomerSubscription {
  professionalId   String?  @map("professional_id")
  professional     User?    @relation("SubscriptionProfessional", fields: [professionalId], references: [id])
  // @@index([companyId, professionalId, status])
}

// 2) Barbeiro preferencial do cliente (gap 15) e inatividade (gap 9)
model Customer {
  preferredProfessionalId String?   @map("preferred_professional_id")
  lastVisitAt             DateTime? @map("last_visit_at")
  deactivatedAt           DateTime? @map("deactivated_at")
}

// 3) Ajuste de comissao por dia (gap 11a)
model CommissionAdjustment {
  refDate DateTime? @map("ref_date") @db.Date  // dia especifico; monthRef continua para o mensal
}

// 4) Bloqueio pontual de agenda (gap 13)
model AppointmentBlock {
  id             String   @id @default(uuid())
  companyId      String   @map("empresa_id")
  professionalId String   @map("professional_id")
  startAt        DateTime @map("start_at")
  endAt          DateTime @map("end_at")
  reason         String?
  isRecurring    Boolean  @default(false) @map("is_recurring")
  weekday        Int?
  createdAt      DateTime @default(now()) @map("created_at")
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, professionalId, startAt])
  @@map("appointment_blocks")
}

// 5) Tolerancia e lembretes por empresa (gaps 5 e 7)
model Company {
  bookingToleranceMinutes Int     @default(30) @map("booking_tolerance_minutes")
  reminderEnabled         Boolean @default(true) @map("reminder_enabled")
  reminderHoursBefore     Int     @default(24) @map("reminder_hours_before")
}
```

Esforco: **~45 min** (schema + migracao + `prisma generate`).

### Lote B — Gaps de alto impacto e baixo esforco

| # | Gap | O que fazer | Arquivos | Esforco |
| --- | --- | --- | --- | --- |
| 3 | "Qualquer barbeiro" | Tornar `professional_id` opcional. Quando vazio: fazer a uniao dos slots de todos os profissionais ativos e, na criacao, atribuir o de menor carga no dia | `customer-portal.service.ts` (`listAvailableSlots`, `createMyAppointment`), `company.service.ts` (`listPublicAvailableSlots`, `createPublicAppointment`), telas de agendamento | 2 h |
| 7 | Tolerancia de 30 min | Trocar `scheduledAt < Date.now()` por `scheduledAt < Date.now() - tolerancia`. Usar `Company.bookingToleranceMinutes` | `customer-portal.service.ts:456`, `company.service.ts` (agendamento publico) | 20 min |
| 20 | Mensalista com barbeiro | Persistir e exibir `professionalId` na assinatura; validar que o agendamento do mensalista respeita o barbeiro do plano | `company.service.ts` (`upsertCustomerSubscription`), `Assinaturas.tsx` | 1 h |
| 13 | Bloqueio de agenda | CRUD de `AppointmentBlock` + subtrair os blocos do calculo de slots em **todos** os 3 pontos de geracao de slots | `company.routes.ts`, `company.service.ts`, `customer-portal.service.ts`, `Agendamentos.tsx` | 2,5 h |
| 15 | "Meus clientes" | Filtro por `preferredProfessionalId` ou por historico de atendimento; escopo automatico quando o papel for `FUNCIONARIO_EMPRESA` | `company.service.ts` (`list` de customers), `Clientes.tsx` | 1,5 h |
| 9 | Clientes inativos | Preencher `lastVisitAt` no fechamento do PDV/agendamento; endpoint `customers/inactive` com `diasSemVir`; coluna e filtro na tela | `company.service.ts`, `Clientes.tsx` | 1,5 h |

### Lote C — Gaps de maior esforco

| # | Gap | O que fazer | Esforco |
| --- | --- | --- | --- |
| 5 | Lembrete de agendamento no WhatsApp | Job agendado que varre agendamentos dentro da janela `reminderHoursBefore`, monta a mensagem e chama `sendWhatsApp`; tabela de controle para nao duplicar envio (espelhar o padrao de `BillingReminder`) | 3 h |
| 11a | Ajuste de comissao por dia | Aceitar `refDate` na criacao do ajuste, agregar por dia na apuracao e abrir o detalhamento diario na tela | 2 h |
| 8 | Painel de desempenho | Endpoint `team/performance`: atendimentos, faturamento, ticket medio, taxa de retorno, ocupacao da agenda, ranking | 3 h |
| 14 | Dashboard do barbeiro | Recorte de `dashboard/metrics` por `professionalId` quando o papel for funcionario | 2 h |
| 11b | Fechamento para o contador | Relatorio XLSX com receita por forma de pagamento, despesas, comissoes pagas e resumo do periodo | 2,5 h |
| 17 | Agenda em grade (timeline) | Componente de calendario semanal, colunas por barbeiro, blocos proporcionais a duracao, arrastar para remarcar | 6 h |

### Esforco total

| Lote | Esforco |
| --- | --- |
| A — Banco | ~0,75 h |
| B — Alto impacto | ~8,5 h |
| C — Maior esforco | ~18,5 h |
| **Total** | **~28 h** |

### Ordem de execucao sugerida

1. **Lote A** — a migracao destrava tudo que vem depois.
2. **Gaps 7 e 3** — sao o que mais muda a experiencia do cliente final, e o 7 custa 20 minutos.
3. **Gaps 13 e 20** — sao os dois pedidos mais explicitos do documento.
4. **Gaps 15 e 9** — dao ao dono e ao barbeiro a visao de carteira.
5. **Lote C** — entra em sprint proprio.

### Observacao sobre prazo

Os ~28 h estimados nao cabem em uma manha. Para uma entrega curta, o corte natural e **Lote A + gaps 7 e 3** (~3 h), que ja entrega os dois itens de cliente final mais visiveis em uma demonstracao.

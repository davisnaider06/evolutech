# Checklist E2E - Portal Cliente

## 1) Registro e Login
- [ ] Acessar `/cliente/cadastro` com `company_slug` valido e criar conta nova.
- [ ] Confirmar redirecionamento para `/cliente/dashboard` com token salvo em `localStorage` (`evolutech_customer_token`).
- [ ] Realizar logout e confirmar retorno para `/cliente/login`.
- [ ] Efetuar login em `/cliente/login` com credenciais validas.
- [ ] Validar erro de credenciais invalidas com mensagem amigavel.
- [ ] Validar bloqueio para empresa sem modulo `customer_portal` ativo (erro 403).

## 2) Dashboard e Abas
- [ ] Validar carregamento dos cards de resumo no dashboard.
- [ ] Validar renderizacao das abas: `Agendamentos`, `Assinaturas`, `Fidelidade`, `Cursos`.
- [ ] Garantir que os dados exibidos pertencem somente ao `companyId` do token.

## 3) Agendamentos
- [ ] Validar listagem de agendamentos do proprio cliente.
- [ ] Cancelar agendamento com status `pendente` ou `confirmado`.
- [ ] Confirmar atualizacao imediata do status para `cancelado`.
- [ ] Tentar cancelar agendamento `concluido`/`cancelado` e validar bloqueio.
- [ ] Confirmar que cliente nao consegue cancelar agendamento de outro cliente.

## 4) Assinaturas
- [ ] Validar listagem de assinaturas com plano, status, datas e valor.
- [ ] Validar estado vazio sem erro quando nao houver assinaturas.

## 5) Fidelidade
- [ ] Validar exibicao de saldo de pontos e cashback.
- [ ] Validar historico de transacoes (ordem decrescente de data).
- [ ] Validar estado vazio quando perfil/transacoes inexistentes.

## 6) Cursos
- [ ] Validar listagem de acessos de cursos do cliente autenticado.
- [ ] Validar exibicao de status, datas e valor pago.
- [ ] Validar estado vazio quando nao houver acessos.

## 7) Regras de Seguranca e Regressao
- [ ] Validar acesso direto a `/cliente/dashboard` sem token -> redireciona para `/cliente/login`.
- [ ] Validar que token de usuario corporativo nao acessa endpoints `/api/customer/*`.
- [ ] Validar que fluxo corporativo (`/login`, `/empresa/*`, `/admin-evolutech/*`) continua inalterado.
- [ ] Validar que selecao de modulos em `admin-evolutech/sistemas-base` exibe `customer_portal` e `courses`.

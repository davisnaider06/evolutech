# Checklist Manual - Sprint 1 Collections

## Preparacao

1. Garantir que a empresa de teste tenha os modulos `billing` ou `collections` ativos.
2. Garantir que exista um gateway ativo na empresa para criacao de cobrancas.
3. Garantir que exista ao menos um funcionario para validar o fluxo de permissoes.

## Permissoes da Equipe

1. Fazer login como `DONO_EMPRESA`.
2. Acessar `/empresa/permissoes`.
3. Desabilitar um modulo operacional para um funcionario.
4. Fazer login como esse funcionario.
5. Tentar abrir a rota do modulo bloqueado.
6. Validar:
   - frontend bloqueia via `ModuleGuard`
   - backend retorna `403` se a rota for chamada diretamente

## Collections - Criacao de cobranca

1. Fazer login como `DONO_EMPRESA`.
2. Acessar `/empresa/cobrancas`.
3. Criar uma cobranca com:
   - titulo
   - nome do cliente
   - telefone
   - valor
   - vencimento no passado
   - metodo `pix`
4. Validar:
   - cobranca aparece em "Recebiveis"
   - QR Code ou link e retornado pelo gateway
   - status inicial fica `pending` e depois entra no ciclo de `overdue`

## Collections - Overdue automatico

1. Rodar um `GET /api/company/collections/receivables`.
2. Validar que cobrancas vencidas com status `pending` passaram a `overdue`.
3. Conferir se os cards de metricas refletem `pending`, `paid` e `overdue`.

## Collections - Dry run

1. No painel `/empresa/cobrancas`, clicar em `Rodar simulacao (dry run)`.
2. Validar:
   - resumo com quantidade de cobrancas analisadas
   - quantidade prevista de lembretes
   - preview da simulacao exibindo etapa, vencimento e telefone
   - itens com lembrete ja existente aparecem como `Ja existe`

## Collections - Envio real

1. Clicar em `Rodar automacao com envio`.
2. Validar:
   - cliente com telefone valido gera reminder `sent`
   - cliente sem telefone gera reminder `failed`
   - lista de lembretes atualiza corretamente

## Collections - Historico por cobranca

1. Na lista de recebiveis, clicar em `Historico` em uma cobranca.
2. Validar:
   - filtro de `billing_charge_id` e aplicado
   - lista de lembretes mostra somente aquela cobranca

## Collections - Reprocessamento

1. Identificar um lembrete com status `failed`.
2. Clicar em `Reprocessar`.
3. Validar:
   - backend tenta novo envio
   - status vai para `sent` quando o envio funciona
   - ou permanece `failed` com nova mensagem de erro

## Collections - Processamento agendado

1. Garantir que exista lembrete `scheduled` com data/hora atual ou passada.
2. Chamar `POST /api/company/collections/automation/process-due`.
3. Validar:
   - lembretes vencidos sao processados
   - falhas entram em retry com `next_retry_at`
   - `attempt_count` aumenta a cada nova tentativa

## Collections - Logs de execucao

1. Rodar simulacao, automacao real e processamento de agendados.
2. Chamar `GET /api/company/collections/executions`.
3. Validar:
   - cada execucao gera log por empresa
   - log mostra origem (`manual`, `manual-reprocess`, `manual-process-due`, `job`, `job-cycle`)
   - contadores de criados, enviados, falhos e retried batem com a operacao

## Collections - Job automatico em producao

1. Configurar no backend:
   - `COLLECTIONS_AUTOMATION_JOB_ENABLED=true`
   - `COLLECTIONS_AUTOMATION_JOB_MS=300000`
   - `COLLECTIONS_AUTOMATION_JOB_STARTUP_DELAY_MS=15000`
   - `COLLECTIONS_RETRY_DELAYS_MINUTES=5,30,120`
2. Reiniciar o backend.
3. Validar:
   - uma execucao `job` ou `job-cycle` aparece em `Logs de execucao`
   - o job nao dispara ciclos sobrepostos
   - lembretes `failed` ganham novo `next_retry_at`
   - lembretes `scheduled` vencidos sao enviados sem acao manual

## Collections - Baixa manual

1. Em uma cobranca ainda nao paga, clicar em `Marcar como pago`.
2. Validar:
   - status da cobranca vira `paid`
   - reminders `scheduled`, `processing` e `failed` ligados a ela viram `canceled`
   - metricas atualizam

## Regressao

1. Validar que PDV continua funcionando.
2. Validar que portal do cliente continua acessivel.
3. Validar que agendamento interno e publico continuam operacionais.
4. Validar que equipe, comissoes, fidelidade e assinaturas continuam abrindo normalmente.

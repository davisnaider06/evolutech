# Teste em celular e rede lenta (melhoria 31)

Este checklist vale para cada deploy que mexe em tela, e uma vez por mês nos demais casos. A meta é medir o que o cliente da barbearia sente no celular de entrada, no 4G da rua, e não o que aparece no computador do escritório.

## Metas (Core Web Vitals, celular)

| Métrica | Bom | Ruim |
|---|---|---|
| LCP (maior elemento visível) | até 2,5 s | acima de 4 s |
| INP (resposta ao toque) | até 200 ms | acima de 500 ms |
| CLS (tela "pulando") | até 0,1 | acima de 0,25 |

## 1. Lighthouse mobile (5 min)

Rode nas rotas críticas: `/login`, `/agendar/<slug-real>` e `/empresa/dashboard` (esta precisa de login no Chrome normal):

```bash
npx -y lighthouse@12.2.1 https://evolutech-three.vercel.app/login \
  --form-factor=mobile --throttling-method=simulate --only-categories=performance \
  --chrome-flags="--headless=new" --view
```

- Compare sempre no mesmo servidor (a Vercel). Um build local servido por `vite preview` usa HTTP/1.1, e a simulação do Lighthouse penaliza isso. Por isso a nota local não é comparável com a de produção.

## 2. DevTools com aparelho e rede lentos (10 min)

1. Abra o Chrome DevTools, ative o modo dispositivo e escolha "Moto G Power".
2. Na aba Network, selecione "Slow 4G". Na aba Performance, configure CPU com "4x slowdown".
3. Marque "Disable cache" e recarregue.
4. Siga o roteiro abaixo, observando o que trava ou pula.

**Roteiro do cliente:**
- Abra o link de agendamento.
- Escolha o serviço, o barbeiro e o horário.
- Confirme.
- Esperado: skeleton no lugar do conteúdo e nenhum botão "morto" sem retorno.

**Roteiro do dono:**
- Painel, depois Agenda, depois busque um cliente digitando rápido.
- Esperado: uma requisição só por busca (melhoria 4) e lista certa no fim.

**Roteiro do caixa:**
- PDV: escolha um cliente pela busca (melhoria 5) e finalize uma venda de teste. Só no ambiente de dev.

## 3. Aparelho real (uma vez por release grande)

- Um Android de entrada (2 a 3 GB de RAM) no 4G, fora do Wi-Fi.
- Instalar o PWA e abrir sem rede: a tela de login e a foto de capa precisam aparecer a partir do cache.

## 4. Velocidade dos usuários reais (melhoria 30)

Depois do deploy, o backend registra uma linha por visita no log do Render:

```
[vitals] LCP=2310ms CLS=0.021 INP=180ms TTFB=612ms FCP=900ms caminho=/agendar/barbearia-x conexao=4g
```

No painel do Render, filtre os logs por `[vitals]`. Se muitas linhas passarem das metas, isso indica um problema real em campo, mesmo que o Lighthouse esteja verde.

## Linha de base registrada (15/11/2026)

Lighthouse 12.2.1, mobile, simulado, produção antes das melhorias:

| Rota | Nota | LCP | FCP | TBT | CLS | Peso total |
|---|---|---|---|---|---|---|
| `/login` | 95 | 2,4 s | 2,3 s | 40 ms | 0 | 454 KiB |
| `/` (landing) | 95 | 2,4 s | 2,2 s | 0 ms | 0,011 | 459 KiB |

Requisições de `/login`, produção atual comparada com o build novo (bytes transferidos):

| Recurso | Produção atual | Build novo |
|---|---|---|
| Foto de capa | 169 kB JPEG (prioridade baixa) | 50 kB AVIF (prioridade alta, preload) |
| JS inicial | 166 kB | 117 kB |

A nota do build novo só vale medida na Vercel, depois do deploy. Repetir a tabela acima nesse momento.

**Não verificado:**
- `/agendar/<slug>`: não havia um slug conhecido no momento do teste.
- `/empresa/dashboard`: precisa de login.
- Teste em aparelho real.

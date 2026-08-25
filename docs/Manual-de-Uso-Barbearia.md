# Manual de Uso — Evolutech para Barbearias

Versao: 1.0
Data: 25/08/2026

Este manual ensina a operar o sistema no dia a dia. A linguagem e direta e
segue a ordem em que as coisas acontecem numa barbearia de verdade.

---

## Indice

1. Quem e quem no sistema
2. Como as pecas se ligam
3. Primeira configuracao (dono)
4. O dia a dia do barbeiro
5. O dia a dia do dono
6. O que o cliente faz sozinho
7. Perguntas frequentes

---

## 1) Quem e quem no sistema

Sao tres papeis. Cada um enxerga o que precisa e nada alem disso.

| Papel | Quem e | Onde entra | O que enxerga |
| --- | --- | --- | --- |
| **Dono** | Dono da barbearia | `/login` | A barbearia inteira: todos os barbeiros, todos os clientes, todo o dinheiro |
| **Barbeiro** | Funcionario | `/login` | A propria agenda, a propria carteira de clientes, a propria comissao |
| **Cliente** | Quem vem cortar | `/cliente/SUA-BARBEARIA/login` | Os proprios agendamentos, o proprio plano, os proprios pontos |

O login do cliente e **separado** do login da equipe. Sao dois sistemas de senha
diferentes. Um cliente nunca ve o painel da barbearia, e um barbeiro nunca precisa
criar conta de cliente.

---

## 2) Como as pecas se ligam

Esta e a parte que faz o sistema fazer sentido. Sao tres ligacoes, e todas
seguem a mesma logica: **muitos de um lado, um do outro.**

### Ligacao 1 — Cliente pertence a um barbeiro

```
  Joao (cliente)    ─┐
  Pedro (cliente)   ─┼──>  Carlos (barbeiro)
  Marcos (cliente)  ─┘
```

Cada cliente tem **um** barbeiro de referencia. Um barbeiro tem **varios** clientes.
E o campo **Barbeiro responsavel** na ficha do cliente.

Isso e o que faz o menu "Meus clientes" funcionar. Nao impede nada: o Joao pode
cortar com outro barbeiro num dia de aperto, e continua sendo cliente do Carlos.

O sistema preenche isso sozinho em dois momentos:
- quando um barbeiro cadastra um cliente novo, o cliente ja nasce dele;
- quando um agendamento e marcado como **concluido** e o cliente ainda nao tinha
  barbeiro, ele adota quem atendeu.

O dono pode trocar a qualquer momento na ficha do cliente.

### Ligacao 2 — Mensalidade pertence a um barbeiro

```
  Plano do Joao   ─┐
  Plano do Pedro  ─┼──>  Carlos (barbeiro)
  Plano do Marcos ─┘
```

Cada mensalidade tem **um** barbeiro. E o campo **Barbeiro** na tela de Assinaturas.

Ao escolher o cliente, o sistema ja preenche com o barbeiro dele. Voce so mexe
se quiser mudar. Isso responde a pergunta que todo dono faz: *"quantos mensalistas
o Carlos tem?"*

### Ligacao 3 — Bloqueio pertence a um barbeiro

```
  Almoco de terca  ─┐
  Folga do dia 30  ─┼──>  Carlos (barbeiro)
  Medico as 15h    ─┘
```

Cada bloqueio de horario e de **um** barbeiro. Bloquear a agenda do Carlos nao
mexe na agenda de ninguem mais.

### O que acontece se um barbeiro sair da barbearia

Nada se perde. Os clientes dele continuam cadastrados, so ficam **sem barbeiro**
(aparecem como "Sem barbeiro" na lista). As mensalidades continuam ativas, so
ficam sem dono. Voce reatribui para outro barbeiro quando quiser.

Isso e proposital: cliente e dinheiro nunca somem junto com um funcionario.

---

## 3) Primeira configuracao (dono)

Faca uma vez, na ordem.

### Passo 1 — Cadastre os servicos

Menu **Agendamentos** > card "Servicos para Agendamento Publico".

Para cada servico informe:
- **Nome**: como o cliente vai ver ("Corte masculino", "Barba", "Corte + Barba")
- **Duracao**: em minutos. Corte costuma ser 30. Combo, 60.
- **Preco**

A duracao e o que monta a grade de horarios. Se o corte dura 30 minutos, o
cliente ve horarios de 30 em 30.

### Passo 2 — Cadastre os barbeiros

Menu **Equipe** > "Novo membro".

Cada barbeiro recebe um convite por link e cria a propria senha.

### Passo 3 — Defina o horario de cada barbeiro

Menu **Agendamentos** > card de disponibilidade > escolha o barbeiro.

Marque os dias que ele trabalha e o horario de entrada e saida.

> **Sobre o almoco:** nao coloque o almoco aqui. Ponha o expediente cheio
> (08:00 as 18:00) e bloqueie o almoco no Passo 6. E mais facil de mudar depois.

### Passo 4 — Defina a comissao de cada barbeiro

Menu **Comissoes** > escolha o profissional.

- **% sobre servicos**: quanto ele ganha do corte. Padrao 40%.
- **% sobre produtos**: quanto ele ganha da pomada que vender. Padrao 10%.
- **Fixo mensal**: se houver um valor fixo alem da comissao.

### Passo 5 — Crie os planos de mensalidade

Menu **Assinaturas** > "Novo plano".

- **Nome**: "Plano Mensal 2 Cortes", "Plano Ilimitado"
- **Intervalo**: mensal, trimestral ou anual
- **Preco**
- **Servicos inclusos** ou marque **Ilimitado**

Quando o mensalista fecha a comanda no PDV, o sistema abate o corte do plano
automaticamente.

### Passo 6 — Bloqueie o almoco

Menu **Agendamentos** > aba **Agenda do dia** > icone de proibido no topo da
coluna do barbeiro.

- Das **12:00** ate **13:00**
- Motivo: **Almoco**
- Ligue **"Repetir toda [dia da semana]"**

Repita para cada dia da semana e para cada barbeiro. Feito uma vez, vale por
12 meses.

---

## 4) O dia a dia do barbeiro

### Ver a agenda do dia

Menu **Agendamentos**. Abre direto na **Agenda do dia**: uma coluna por barbeiro,
com os atendimentos posicionados na hora certa.

As cores dizem o que e:
- **amarelo** — pendente, cliente ainda nao confirmou
- **verde** — confirmado
- **azul** — concluido, ja atendido
- **listrado vermelho** — bloqueado, ninguem marca ali

O topo da coluna mostra quantos atendimentos tem no dia e quanto por cento da
agenda esta ocupada.

### Bloquear um horario

Clique no icone de proibido no topo da sua coluna. Informe das/ate e o motivo.

Assim que salvar, aquele horario **some** da agenda: nem o cliente pelo portal,
nem quem usa o link publico consegue marcar ali.

Use para medico, folga, atraso, ou qualquer imprevisto.

### Marcar o atendimento como concluido

Clique no atendimento na grade, mude o status para **Concluido** e salve.

Isso faz tres coisas de uma vez:
1. entra na sua comissao do mes;
2. atualiza a "ultima visita" do cliente;
3. se o cliente ainda nao tinha barbeiro, ele passa a ser seu.

> Marcar como concluido nao e burocracia: e o que alimenta a comissao e o
> controle de cliente sumido. Sem isso, os dois ficam errados.

### Ver seus clientes

Menu **Clientes**. Ja abre com **"Somente meus clientes"** ligado.

Voce ve a sua carteira, com quantos dias faz que cada um nao aparece.
Desligue a chave para ver a barbearia inteira.

### Ver sua comissao

Menu **Comissoes**. Voce ve so a sua, com o detalhamento de quanto veio de
servico, quanto de produto, e todos os ajustes que o dono lancou — com dia e
motivo de cada um.

---

## 5) O dia a dia do dono

### Ver a barbearia inteira

Menu **Agendamentos** > **Agenda do dia**. Todas as colunas lado a lado.
Numa olhada voce ve quem esta cheio e quem esta parado.

### Achar cliente sumido

Menu **Clientes** > card de carteira > **Clientes sumidos**.

Escolha a faixa: 30, 60, 90 ou 180 dias. A lista mostra so quem nao aparece
ha esse tempo.

Na coluna **Ultima visita** as cores avisam:
- normal, ate 60 dias
- **laranja**, de 60 a 90 dias — hora de chamar
- **vermelho**, mais de 90 dias — cliente perdido, campanha de recuperacao

Combine com o filtro **Barbeiro** para cobrar cada um pela propria carteira:
*"Carlos, voce tem 8 clientes sem vir ha mais de 60 dias."*

### Ver ha quanto tempo um cliente esta desativado

Na coluna **Status**, o cliente inativo mostra "desativado ha X dias" embaixo
da tarja. A contagem comeca no dia em que voce desligou a chave "Cliente ativo".

### Saber e definir quem e mensalista

Menu **Assinaturas** > card "Assinaturas de clientes". Cada linha mostra o
cliente, o plano, a vigencia, quantos cortes restam e **de qual barbeiro** e.

Para tornar alguem mensalista, use o card "Vincular assinatura ao cliente".
O barbeiro vem preenchido pela ficha do cliente; troque se precisar.

### Ajustar comissao de um dia especifico

Menu **Comissoes** > escolha o profissional > card "Ajuste de comissao".

- **Dia**: a data do ajuste. Ex: 12/08.
- **Valor**: positivo para bonus (`50`), negativo para desconto (`-30`).
- **Motivo**: sempre escreva. E o que evita discussao no fim do mes.

Deixe o campo **Dia** vazio para um ajuste do mes inteiro.

Todo lancamento aparece no card **"Historico de ajustes do mes"**, com dia,
valor, motivo e quem lancou. O barbeiro ve o mesmo historico na tela dele —
por isso o motivo importa.

### Fechar o mes

Menu **Comissoes**:
1. confira a tabela por profissional;
2. lance os ajustes que faltarem;
3. registre o pagamento em "Pagamentos";
4. exporte o Excel para o contador.

---

## 6) O que o cliente faz sozinho

O cliente acessa `/cliente/SUA-BARBEARIA/login`.

- **Cria conta** com nome, e-mail, telefone e senha. Nao precisa confirmar
  e-mail: entra na hora.
- **Marca corte**: escolhe o servico (ve o preco), o barbeiro, o dia e um
  horario livre. So aparecem horarios realmente livres — o sistema ja
  descontou o que esta agendado e o que esta bloqueado.
- **Cancela** pelo proprio portal.
- **Ve o plano** e quantos cortes ainda tem.
- **Ve os pontos** de fidelidade.

Quem nao quer criar conta usa o link publico `/agendar/SUA-BARBEARIA`. Mesmo
fluxo, sem senha. Copie esse link em **Agendamentos** e cole na bio do
Instagram e no WhatsApp.

---

## 7) Perguntas frequentes

**O cliente pode ter mais de um agendamento marcado?**
Pode, quantos quiser. Nao ha limite.

**Bloquear a agenda derruba agendamento que ja existe?**
Nao. O bloqueio impede agendamentos **novos** naquele periodo. Se ja havia
alguem marcado, ele continua ali e voce trata com o cliente.

**O barbeiro pode apagar bloqueio de outro barbeiro?**
Nao. Cada um mexe so na propria agenda. O dono mexe em todas.

**Mudar o barbeiro de um cliente muda a mensalidade dele?**
Nao. Sao duas ligacoes independentes. Trocar o barbeiro do cliente vale para
os proximos cadastros; a mensalidade em vigor continua com o barbeiro que
estava. Se quiser mover as duas, troque nos dois lugares.

**Cliente sem barbeiro atrapalha alguma coisa?**
Nao. Ele aparece como "Sem barbeiro" e some do "Meus clientes" de todo mundo.
Continua agendando e comprando normalmente.

**Por que o cliente aparece como "Nunca veio" se ja cortou aqui?**
A "ultima visita" so conta a partir de agendamento marcado como **concluido**
ou venda fechada no PDV. Atendimento que ficou como "pendente" nao conta.

**Apagar um ajuste de comissao mexe no que ja foi pago?**
Mexe no calculo do mes. Se o pagamento ja foi registrado, confira o valor
pago depois de apagar.

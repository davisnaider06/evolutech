# Dashboard da Empresa — reprodução mobile-first

## Objetivo

Reconstruir `/empresa/dashboard` a partir da referência aprovada, em vez de apenas adaptar o painel existente. A tela deve reproduzir sua hierarquia, escala, espaçamento, cartões compactos, barras arredondadas e dock inferior. As cores de destaque continuam a vir dos tokens de aparência da empresa.

## Tela do dashboard

O painel ocupa uma coluna central compacta em celular e um conteúdo com largura controlada no desktop. O topo contém marca/nome da empresa, sino, avatar e um toggle explícito de modo claro/escuro. Abaixo ficam a saudação, um seletor de período (`Hoje`, `Semana`, `Mês`) e uma grade fixa de quatro métricas.

Cada métrica tem ícone Lucide no canto superior esquerdo, selo de tendência no direito, legenda curta, valor de alto contraste e descrição complementar. A ordem é Agendamentos hoje, Faturamento do mês, Clientes ativos e Equipe (ou Próximos horários para funcionário).

O gráfico principal vem imediatamente depois: título, selo de período, e barras verticais altas com raios máximos, eixos discretos, grade horizontal suave e tooltip. Ele exibe atividade real dos agendamentos retornados pelo dashboard; se não houver dados, apresenta estado vazio sem fabricar números.

Pendências, primeiros passos, atendimentos sem baixa, link de agenda, atividade recente e atalhos existentes continuam disponíveis abaixo da área principal, sem substituir dados ou permissões atuais.

## Modo claro e escuro

O toggle alterna uma classe no documento e persiste a escolha em `localStorage`. Claro usa fundo neutro e cartões brancos; escuro usa fundo grafite e cartões escuros. A cor primária configurada pela empresa permanece o destaque em ambos os modos. O controle tem rótulo acessível e ícones de sol/lua.

## Navegação

Em `lg` ou maior, a barra lateral atual é a navegação primária. Em telas menores, ela só abre pela gaveta; a navegação persistente é um dock inferior fixo, preto, com cantos amplamente arredondados e cinco itens nesta ordem:

1. Menu — abre a gaveta lateral existente.
2. Agendamentos — abre a agenda.
3. Início — fica no centro, é o dashboard e recebe destaque visual de item ativo.
4. Financeiro — abre a página financeira ou Caixa quando Financeiro não estiver habilitado.
5. Equipe — abre equipe ou Clientes quando o módulo/e a permissão de equipe não estiverem disponíveis.

Cada item usa ícone Lucide, legenda e área de toque de no mínimo 44 px. O conteúdo da página tem recuo inferior suficiente para nunca ficar sob o dock.

## Componentes e dados

- `EmpresaDashboard` busca métricas, normaliza pontos de gráfico e compõe o conteúdo.
- `DashboardMetricCard` é puramente visual e recebe título, valor, detalhe, ícone e tendência.
- `DashboardActivityChart` recebe pontos normalizados, carregamento e estado vazio; não consulta a API.
- `EmpresaLayout` decide a navegação desktop/mobile e contém o toggle de tema.

O endpoint continua `GET /company/dashboard/metrics`. Falhas preservam o último conteúdo útil e informam o usuário pelo mecanismo de aviso existente; carregamento usa esqueletos.

## Verificação

Validar build e lint. Testar a 375 px e 768 px: grade 2×2, valores monetários, seletor de período, modo claro/escuro, os cinco atalhos e a abertura da gaveta. Testar desktop para confirmar que não há dock e que a barra lateral continua funcional.

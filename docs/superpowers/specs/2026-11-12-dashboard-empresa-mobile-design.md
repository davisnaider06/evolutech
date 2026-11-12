# Dashboard da Empresa — design mobile-first

## Objetivo

Refatorar `/empresa/dashboard` para usar a composição da referência aprovada: painel claro e compacto, cartões de métricas, gráfico de barras arredondadas e navegação inferior fixa no celular. A identidade visual da empresa continua sendo a origem de cores; não serão introduzidas cores de marca externas.

## Estrutura

O conteúdo do painel terá, nesta ordem:

1. Cabeçalho com saudação, nome da empresa e ações de notificação/perfil já disponíveis no layout.
2. Seletor de período com opções de hoje, semana e mês. Nesta primeira entrega ele controla a apresentação do gráfico quando houver série correspondente; as métricas atuais permanecem alimentadas pelo endpoint de dashboard.
3. Grade de quatro cartões: agendamentos de hoje, faturamento do mês, clientes ativos e equipe. O cartão de equipe é exclusivo para dono, como hoje.
4. Cartão principal de gráfico, “Movimento do dia”, com barras verticais de cantos totalmente arredondados, eixo discreto, tooltip acessível e alternativa vazia para dias sem dados.
5. Blocos preservados de pendências, primeiros passos, atendimentos sem baixa, link de agendamento, atividade recente e atalhos diários. Eles serão reorganizados para não competir com as métricas no topo.

## Dados e estados

O dashboard continuará a consumir `GET /company/dashboard/metrics`. A resposta atual fornece os totais e os itens recentes; o gráfico será derivado dos horários dos agendamentos recentes enquanto uma série agregada não estiver disponível. Essa limitação será explícita na interface como “atividade recente”, sem sugerir um total histórico inexistente.

No carregamento, cartões e gráfico exibem esqueletos. Em falha, o conteúdo útil já carregado continua visível e o aviso existente é mantido. Ausência de dados renderiza uma mensagem curta no gráfico, em vez de barras artificiais.

## Responsividade e navegação

Em telas `lg` ou maiores, a barra lateral atual permanece a navegação principal. Em telas menores, a navegação torna-se um dock fixo inferior preto/denso, com cantos arredondados, ícones Lucide e quatro entradas: Painel, Agenda, Caixa e Menu. O conteúdo receberá espaço inferior suficiente para não ficar encoberto pelo dock. A entrada ativa usa a cor primária da empresa e possui nome legível.

Os cartões usam duas colunas a partir de telas pequenas; em telefones estreitos, podem cair para uma coluna sem cortar valores monetários. O gráfico ocupa toda a largura disponível, com barras e rótulos reduzidos proporcionalmente.

## Componentes e limites

- `EmpresaDashboard` coordena dados, filtro de período e composição da página.
- `DashboardMetricCard` recebe título, valor, ícone, tendência e variação sem conhecer a API.
- `DashboardActivityChart` recebe pontos normalizados, estado de carregamento e estado vazio; não faz requisições.
- `EmpresaLayout` contém exclusivamente a variação desktop/mobile da navegação.

Os componentes visuais usam as variáveis CSS existentes (`--primary`, `--card`, `--muted` e tokens de tema), permitindo a personalização já oferecida em Aparência.

## Qualidade e verificação

Executar verificação de tipos/build e lint após a alteração. Validar manualmente os pontos de quebra mobile e desktop, navegação pelo dock, valores longos de faturamento, carregamento, vazio e erro de rede.

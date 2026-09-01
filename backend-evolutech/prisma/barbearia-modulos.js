/**
 * A definicao do sistema base "Barbearia" — fonte unica.
 *
 * Duas coisas leem este arquivo e precisam concordar: o seed, que monta o
 * catalogo numa instalacao nova, e o sistema-base-barbearia.js, que aplica a
 * definicao numa barbearia que ja existe. Antes a lista morava so no seed, com
 * um conjunto que nao cobria a operacao (faltavam caixa, comandas e estoque),
 * e barbearia nova nascia sem esses menus.
 *
 * Mexer aqui muda o padrao de toda barbearia nova. Para a barbearia que ja
 * roda, o efeito so vale depois de rodar o script.
 *
 * `codigo` casa com o moduleCode do menu (src/components/layouts/EmpresaLayout.tsx)
 * atraves do MODULE_ALIASES em src/hooks/useCompanyModules.ts. Codigo que nao
 * tem alias la nao acende menu nenhum aqui.
 */

const AMBOS = ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
const SO_DONO = ['DONO_EMPRESA'];

/**
 * Os modulos da barbearia, na ordem em que aparecem no menu.
 *
 * `codigo` casa com o moduleCode do EmpresaLayout atraves do MODULE_ALIASES
 * do front (useCompanyModules.ts): 'clientes' atende 'customers', e assim por
 * diante. Mexer num codigo daqui sem olhar la esconde o menu.
 *
 * `roles` restringe quem enxerga. Dinheiro da casa (financeiro, comissao do
 * dono, cobranca, mensalidade) fica so com o dono; o resto o barbeiro usa.
 */
const MODULOS = [
  { codigo: 'dashboard',         nome: 'Dashboard',            descricao: 'Visao geral do dia e indicadores',            icone: 'LayoutDashboard', preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'clientes',          nome: 'Clientes',             descricao: 'Cadastro, historico e retorno de clientes',    icone: 'Users',           preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'agendamentos',      nome: 'Agendamentos',         descricao: 'Agenda por barbeiro, servicos e horarios',     icone: 'Calendar',        preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'pdv',               nome: 'PDV',                  descricao: 'Fechamento de atendimento no balcao',          icone: 'ReceiptText',     preco: 79.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'caixa',             nome: 'Caixa',                descricao: 'Abertura, fechamento e movimento do caixa',    icone: 'Wallet',          preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'pedidos',           nome: 'Comandas',             descricao: 'Comandas abertas e historico de vendas',       icone: 'ShoppingCart',    preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'produtos',          nome: 'Produtos',             descricao: 'Pomada, shampoo e o que mais se vende',        icone: 'Package',         preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'estoque',           nome: 'Estoque',              descricao: 'Entrada, saida e saldo dos produtos',          icone: 'Warehouse',       preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'assinaturas',       nome: 'Assinaturas',          descricao: 'Mensalistas, pacotes e cobranca do plano',     icone: 'Repeat',          preco: 49.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'fidelidade',        nome: 'Fidelidade',           descricao: 'Pontos e recompensa para cliente frequente',   icone: 'Gift',            preco: 29.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'comissoes_dono',    nome: 'Comissoes',            descricao: 'Comissao da equipe, fechamento pelo dono',     icone: 'Wallet',          preco: 29.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'commissions_staff', nome: 'Minhas Comissoes',     descricao: 'O barbeiro consulta o que ele mesmo ganhou',   icone: 'Wallet',          preco: 0,    core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'financeiro',        nome: 'Financeiro',           descricao: 'Entradas, saidas e resultado do mes',          icone: 'CreditCard',      preco: 59.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'collections',       nome: 'Cobrancas',            descricao: 'Vencimentos e recuperacao de inadimplente',    icone: 'ReceiptText',     preco: 59.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'relatorios',        nome: 'Relatorios',           descricao: 'Faturamento, ocupacao e desempenho',           icone: 'BarChart3',       preco: 29.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'customer_portal',   nome: 'Portal do Cliente',    descricao: 'Cliente agenda e acompanha pelo proprio app',  icone: 'Smartphone',      preco: 39.9, core: false, roles: AMBOS,   obrigatorio: true },
  { codigo: 'permissions',       nome: 'Permissoes de Equipe', descricao: 'O que cada barbeiro pode ver e fazer',         icone: 'Settings',        preco: 0,    core: true,  roles: SO_DONO, obrigatorio: true },
  { codigo: 'support',           nome: 'Suporte',              descricao: 'Abertura de chamado com a Evolutech',          icone: 'HeadphonesIcon',  preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
];


module.exports = { MODULOS_BARBEARIA: MODULOS, AMBOS, SO_DONO };

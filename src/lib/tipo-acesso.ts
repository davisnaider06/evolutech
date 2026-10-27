/**
 * De que lado do sistema este aparelho entra quando o app abre sem sessao: o
 * portal do cliente ou o painel da equipe.
 *
 * O site do iBarber e para o dono da barbearia, entao sem nada guardado o app
 * abre no login da equipe. O cliente nunca passa por ele: chega pelo link da
 * barbearia (/agendar/<slug>), que o dono divulga no Instagram e no WhatsApp.
 *
 * Havia uma tela "Sou cliente / Sou da equipe" antes do login. Ela mandava o
 * "Sou cliente" para a ultima barbearia aberta no aparelho — o dono que tinha
 * testado o link de outra barbearia caia na agenda dela. A tela saiu; o lado
 * e gravado sozinho no login de cada um e na primeira visita ao link.
 */

export type TipoAcesso = 'cliente' | 'equipe';

// Chave nova de proposito: a antiga guardava o "Sou cliente" da tela que saiu,
// e era ela que mandava o dono para a agenda de outra barbearia.
const TIPO_ACESSO_KEY = 'ibarber_lado_do_aparelho';

const valido = (valor: string | null): valor is TipoAcesso =>
  valor === 'cliente' || valor === 'equipe';

export const tipoAcessoLembrado = (): TipoAcesso | null => {
  try {
    const valor = localStorage.getItem(TIPO_ACESSO_KEY);
    return valido(valor) ? valor : null;
  } catch (_error) {
    // Modo privado: a escolha aparece de novo, nada alem disso.
    return null;
  }
};

export const lembrarTipoAcesso = (tipo: TipoAcesso) => {
  try {
    localStorage.setItem(TIPO_ACESSO_KEY, tipo);
  } catch (_error) {
    // Sem storage a tela de escolha volta na proxima abertura — aceitavel.
  }
};

/**
 * De que lado do sistema esta pessoa entra: o portal do cliente ou o painel da
 * equipe.
 *
 * O app abre sempre em "/" e, sem sessao, caia direto no login da equipe. O
 * cliente da barbearia nao entendia que precisava do link "Portal do Cliente"
 * e ficava tentando a propria senha no formulario do dono. Agora "/" manda
 * para a tela de escolha (/entrar) e so pula essa tela quando a escolha ja
 * esta guardada neste aparelho.
 *
 * A escolha vale por aparelho e sobrevive ao "sair" de proposito: quem escolheu
 * errado troca pelo link "nao e voce?" nas duas telas de login.
 */

export type TipoAcesso = 'cliente' | 'equipe';

const TIPO_ACESSO_KEY = 'evolutech_tipo_acesso';

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

export const esquecerTipoAcesso = () => {
  try {
    localStorage.removeItem(TIPO_ACESSO_KEY);
  } catch (_error) {
    // Idem: nada a fazer, a escolha ja nao existia.
  }
};

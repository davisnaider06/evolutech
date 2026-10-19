/**
 * Horario escolhido no link publico antes de o cliente entrar.
 *
 * O cliente monta o agendamento inteiro (servico, barbeiro, dia e hora) sem
 * conta, e so no "Confirmar" pedimos login ou cadastro. A escolha fica aqui
 * enquanto ele passa por essas telas, e o portal marca o horario assim que
 * abrir logado na mesma barbearia.
 */

const CHAVE = 'evolutech_agendamento_pendente';
// Horario guardado por mais tempo que isso provavelmente ja foi para outro.
const VALIDADE_MS = 2 * 60 * 60 * 1000;

export interface AgendamentoPendente {
  slug: string;
  service_id: string;
  professional_id: string;
  date: string;
  scheduled_at: string;
  service_name?: string;
  professional_name?: string;
  salvo_em: number;
}

export const guardarAgendamentoPendente = (dados: Omit<AgendamentoPendente, 'salvo_em'>) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...dados, salvo_em: Date.now() }));
  } catch (_error) {
    // Modo privado: o cliente escolhe o horario de novo dentro do portal.
  }
};

export const lerAgendamentoPendente = (slug?: string | null): AgendamentoPendente | null => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as AgendamentoPendente;
    if (!dados?.scheduled_at || Date.now() - Number(dados.salvo_em || 0) > VALIDADE_MS) {
      localStorage.removeItem(CHAVE);
      return null;
    }
    // Sempre por barbearia: ids de servico de uma empresa nao valem em outra.
    if (!slug || dados.slug !== String(slug).trim().toLowerCase()) return null;
    return dados;
  } catch (_error) {
    return null;
  }
};

export const esquecerAgendamentoPendente = () => {
  try {
    localStorage.removeItem(CHAVE);
  } catch (_error) {
    // Nada a fazer.
  }
};

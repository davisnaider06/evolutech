/**
 * Envio de e-mail para o cliente final da barbearia.
 *
 * Usa o Resend, o mesmo provedor que o modulo de suporte ja usava. Todo envio
 * e best-effort: se a chave nao estiver configurada, ou o provedor recusar,
 * o erro e registrado e a operacao que chamou segue adiante. Cobranca e
 * assinatura nunca podem quebrar porque um e-mail falhou.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[<>&"]/g, (char) => {
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&amp;';
  });

const money = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dia = (value: Date | string) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

export interface EmailResult {
  sent: boolean;
  skipped?: string;
  error?: string;
}

/** Moldura visual comum a todos os e-mails, para manter identidade unica. */
function montarLayout(params: {
  companyName: string;
  title: string;
  body: string;
  callout?: { text: string; tone: 'info' | 'warn' | 'danger' };
}) {
  const tones = {
    info: { bg: '#EFF6FF', border: '#2563EB', ink: '#1E3A8A' },
    warn: { bg: '#FEF3C7', border: '#D97706', ink: '#78350F' },
    danger: { bg: '#FEE2E2', border: '#DC2626', ink: '#7F1D1D' },
  };
  const callout = params.callout
    ? `<div style="background:${tones[params.callout.tone].bg};border-left:4px solid ${
        tones[params.callout.tone].border
      };color:${tones[params.callout.tone].ink};padding:14px 16px;border-radius:0 6px 6px 0;margin:18px 0;font-size:15px;">
         ${params.callout.text}
       </div>`
    : '';

  return `
  <div style="background:#F4F4F5;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:10px;overflow:hidden;border:1px solid #E4E4E7;">
      <div style="background:#0F172A;padding:20px 24px;">
        <span style="color:#FFFFFF;font-size:17px;font-weight:600;">${escapeHtml(params.companyName)}</span>
      </div>
      <div style="padding:24px;color:#27272A;line-height:1.6;font-size:15px;">
        <h1 style="margin:0 0 14px;font-size:20px;color:#18181B;">${escapeHtml(params.title)}</h1>
        ${params.body}
        ${callout}
      </div>
      <div style="padding:16px 24px;background:#FAFAFA;border-top:1px solid #E4E4E7;color:#71717A;font-size:12px;">
        Este e um aviso automatico de ${escapeHtml(params.companyName)}. Em caso de duvida, fale direto com a barbearia.
      </div>
    </div>
  </div>`;
}

export class NotificationService {
  private get apiKey() {
    return String(process.env.RESEND_API_KEY || '').trim();
  }

  private get fromEmail() {
    return String(process.env.SUPPORT_FROM_EMAIL || 'Evolutech <onboarding@resend.dev>').trim();
  }

  private async enviar(params: {
    to: string;
    subject: string;
    html: string;
    contexto: string;
  }): Promise<EmailResult> {
    const destino = String(params.to || '').trim();
    if (!this.apiKey) {
      console.info(`[email] ${params.contexto}: ignorado, RESEND_API_KEY nao configurada`);
      return { sent: false, skipped: 'sem RESEND_API_KEY' };
    }
    if (!destino || !destino.includes('@')) {
      console.info(`[email] ${params.contexto}: ignorado, cliente sem e-mail valido`);
      return { sent: false, skipped: 'cliente sem e-mail' };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [destino],
          subject: params.subject,
          html: params.html,
        }),
      });

      if (!response.ok) {
        const detalhe = await response.text().catch(() => '');
        console.error(`[email] ${params.contexto}: provedor recusou (${response.status}) ${detalhe.slice(0, 200)}`);
        return { sent: false, error: `HTTP ${response.status}` };
      }
      console.info(`[email] ${params.contexto}: enviado para ${destino}`);
      return { sent: true };
    } catch (error: any) {
      console.error(`[email] ${params.contexto}: falhou -`, error?.message);
      return { sent: false, error: String(error?.message || 'erro desconhecido') };
    }
  }

  /** Pagamento confirmado: a mensalidade esta valendo. */
  async assinaturaAtivada(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    endAt: Date;
    isUnlimited: boolean;
    remainingServices: number | null;
  }) {
    const saldo = params.isUnlimited
      ? 'Servicos ilimitados durante a vigencia.'
      : `Voce tem <strong>${params.remainingServices ?? 0} servicos</strong> para usar.`;

    return this.enviar({
      to: params.to,
      contexto: 'assinatura ativada',
      subject: `Seu plano ${params.planName} esta ativo`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Pagamento confirmado',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Recebemos seu pagamento e o plano <strong>${escapeHtml(params.planName)}</strong> ja esta ativo.</p>
          <p>${saldo}</p>
          <p>Valido ate <strong>${dia(params.endAt)}</strong>.</p>`,
        callout: {
          tone: 'info',
          text: `Valor pago: <strong>${money(params.amount)}</strong>`,
        },
      }),
    });
  }

  /** Faltam dois dias para vencer e o cliente paga por PIX. */
  async avisoVencimentoPix(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    endAt: Date;
  }) {
    return this.enviar({
      to: params.to,
      contexto: 'aviso de vencimento (pix)',
      subject: `Seu plano ${params.planName} vence em 2 dias`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Hora de renovar seu plano',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Seu plano <strong>${escapeHtml(params.planName)}</strong> vence em
             <strong>${dia(params.endAt)}</strong>.</p>
          <p>Para continuar aproveitando, faca o pagamento pelo portal ate a data de vencimento.
             O PIX fica disponivel na aba <strong>Assinaturas</strong>.</p>`,
        callout: {
          tone: 'warn',
          text: `Valor: <strong>${money(params.amount)}</strong>. Se o pagamento nao for feito ate ${dia(
            params.endAt
          )}, o plano sera cancelado automaticamente.`,
        },
      }),
    });
  }

  /** Faltam dois dias para vencer e a cobranca sai no cartao. */
  async avisoVencimentoCartao(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    endAt: Date;
  }) {
    return this.enviar({
      to: params.to,
      contexto: 'aviso de vencimento (cartao)',
      subject: `Renovacao do plano ${params.planName} em 2 dias`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Sua renovacao esta chegando',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Seu plano <strong>${escapeHtml(params.planName)}</strong> se renova em
             <strong>${dia(params.endAt)}</strong>, e a cobranca sai automaticamente no
             seu cartao cadastrado.</p>
          <p>Nao precisa fazer nada. Se quiser cancelar, avise a barbearia antes dessa data.</p>`,
        callout: {
          tone: 'info',
          text: `Valor da renovacao: <strong>${money(params.amount)}</strong>`,
        },
      }),
    });
  }

  /**
   * A cobranca no cartao falhou, mas o cliente ainda tem prazo.
   * E o e-mail que recupera a maior parte das falhas: quase sempre e limite
   * estourado no dia ou cartao vencido, e o cliente resolve em minutos.
   */
  async falhaNaCobranca(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    tentativa: number;
    totalTentativas: number;
    proximaTentativa: Date;
    prazoFinal: Date;
  }) {
    return this.enviar({
      to: params.to,
      contexto: 'falha na cobranca',
      subject: `Nao conseguimos cobrar seu plano ${params.planName}`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Problema com o pagamento',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Tentamos cobrar <strong>${money(params.amount)}</strong> no seu cartao,
             mas o pagamento nao foi autorizado.</p>
          <p>Costuma ser limite disponivel no dia ou cartao vencido.
             <strong>Seu plano continua ativo</strong> — vamos tentar de novo em
             <strong>${dia(params.proximaTentativa)}</strong>.</p>
          <p>Se quiser trocar o cartao, fale com a barbearia ou refaca a assinatura pelo portal.</p>`,
        callout: {
          tone: 'warn',
          text: `Tentativa ${params.tentativa} de ${params.totalTentativas}. Se ate
                 <strong>${dia(params.prazoFinal)}</strong> o pagamento nao for concluido,
                 o plano sera cancelado.`,
        },
      }),
    });
  }

  /** Venceu sem pagamento: plano cancelado. */
  async assinaturaCancelada(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    motivo: 'sem_pagamento' | 'falha_cartao';
  }) {
    const explicacao =
      params.motivo === 'falha_cartao'
        ? 'Tentamos cobrar no seu cartao, mas o pagamento nao foi autorizado.'
        : 'Nao identificamos o pagamento ate a data de vencimento.';

    return this.enviar({
      to: params.to,
      contexto: 'assinatura cancelada',
      subject: `Seu plano ${params.planName} foi cancelado`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Plano cancelado',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>${explicacao}</p>
          <p>Por isso, seu plano <strong>${escapeHtml(params.planName)}</strong> foi cancelado.</p>
          <p>Voce continua podendo agendar normalmente pagando por atendimento,
             e pode assinar de novo quando quiser pelo portal.</p>`,
        callout: {
          tone: 'danger',
          text: 'Quer voltar a ter o plano? Entre no portal e assine novamente.',
        },
      }),
    });
  }

  /**
   * Faltam dois dias e a mensalidade e acertada na propria barbearia.
   *
   * Sem gateway nao ha link de pagamento nem cancelamento automatico, entao o
   * texto nao promete nem ameaca nenhum dos dois: avisa a data e o valor, e
   * manda acertar no balcao. Quem decide se recebeu e o dono.
   */
  async avisoVencimentoManual(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    endAt: Date;
  }) {
    return this.enviar({
      to: params.to,
      contexto: 'aviso de vencimento (manual)',
      subject: `Sua mensalidade ${params.planName} vence em 2 dias`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Sua mensalidade vence em 2 dias',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Sua mensalidade do plano <strong>${escapeHtml(params.planName)}</strong> vence em
             <strong>${dia(params.endAt)}</strong>.</p>
          <p>O acerto e feito direto na barbearia. Voce pode pagar na sua proxima visita
             ou combinar o pagamento com a gente.</p>`,
        callout: {
          tone: 'info',
          text: `Valor: <strong>${money(params.amount)}</strong>. Vencimento em ${dia(params.endAt)}.`,
        },
      }),
    });
  }

  /**
   * Venceu e o dono ainda nao confirmou o recebimento.
   *
   * Tom de lembrete, nao de corte: o dono pode simplesmente ainda nao ter dado
   * baixa. Quem sabe se o dinheiro entrou e ele, e o e-mail nao pode afirmar
   * que o cliente esta devendo.
   */
  async avisoMensalidadeEmAberto(params: {
    to: string;
    customerName: string;
    companyName: string;
    planName: string;
    amount: number;
    endAt: Date;
    diasEmAtraso: number;
  }) {
    const desde =
      params.diasEmAtraso <= 0
        ? 'hoje'
        : params.diasEmAtraso === 1
          ? 'ontem'
          : `ha ${params.diasEmAtraso} dias`;

    return this.enviar({
      to: params.to,
      contexto: 'mensalidade em aberto (manual)',
      subject: `Sua mensalidade ${params.planName} esta em aberto`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Sua mensalidade esta em aberto',
        body: `
          <p>Ola, ${escapeHtml(params.customerName)}!</p>
          <p>Sua mensalidade do plano <strong>${escapeHtml(params.planName)}</strong> venceu
             ${desde} (${dia(params.endAt)}) e ainda consta em aberto por aqui.</p>
          <p>Se voce ja acertou com a barbearia, pode ignorar este aviso: assim que a baixa
             for dada, sua mensalidade volta ao normal.</p>`,
        callout: {
          tone: 'warn',
          text: `Valor em aberto: <strong>${money(params.amount)}</strong>. Fale com a barbearia para acertar.`,
        },
      }),
    });
  }

  /**
   * Resumo para o DONO, nao para o cliente.
   *
   * Todos os outros e-mails daqui falam com o cliente final. Este e o unico
   * que fala com quem opera a barbearia: e a lista do que ele precisa cobrar
   * e dar baixa, que na cobranca manual so ele consegue resolver.
   */
  async resumoMensalidadesParaDono(params: {
    to: string;
    companyName: string;
    vencendo: Array<{ customerName: string; planName: string; amount: number; endAt: Date }>;
    emAberto: Array<{
      customerName: string;
      planName: string;
      amount: number;
      endAt: Date;
      diasEmAtraso: number;
    }>;
  }) {
    const linha = (texto: string, detalhe: string) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;">${texto}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;text-align:right;white-space:nowrap;">${detalhe}</td>
      </tr>`;

    const bloco = (titulo: string, linhas: string[]) =>
      linhas.length === 0
        ? ''
        : `<h2 style="margin:22px 0 6px;font-size:15px;color:#18181B;">${titulo}</h2>
           <table style="width:100%;border-collapse:collapse;font-size:14px;">${linhas.join('')}</table>`;

    const linhasVencendo = params.vencendo.map((item) =>
      linha(
        `${escapeHtml(item.customerName)} <span style="color:#71717A;">- ${escapeHtml(item.planName)}</span>`,
        `${money(item.amount)} <span style="color:#71717A;">- ${dia(item.endAt)}</span>`
      )
    );

    const linhasEmAberto = params.emAberto.map((item) =>
      linha(
        `${escapeHtml(item.customerName)} <span style="color:#71717A;">- ${escapeHtml(item.planName)}</span>`,
        `${money(item.amount)} <span style="color:#B91C1C;">- ${
          item.diasEmAtraso <= 0 ? 'vence hoje' : `ha ${item.diasEmAtraso}d`
        }</span>`
      )
    );

    const totalEmAberto = params.emAberto.reduce((soma, item) => soma + Number(item.amount || 0), 0);

    return this.enviar({
      to: params.to,
      contexto: 'resumo de mensalidades para o dono',
      subject: `${params.vencendo.length + params.emAberto.length} mensalidades precisam da sua atencao`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Mensalidades a receber',
        body: `
          <p>Resumo do dia. Confirme o recebimento na tela de <strong>Assinaturas</strong> para
             cada cliente que ja acertou com voce.</p>
          ${bloco(`Vencem em breve (${params.vencendo.length})`, linhasVencendo)}
          ${bloco(`Em aberto, aguardando sua confirmacao (${params.emAberto.length})`, linhasEmAberto)}`,
        callout:
          params.emAberto.length > 0
            ? {
                tone: 'warn',
                text: `Total em aberto: <strong>${money(totalEmAberto)}</strong> em ${params.emAberto.length} mensalidade(s).`,
              }
            : undefined,
      }),
    });
  }

  /**
   * Entrou agendamento pelo link publico.
   *
   * Ate aqui ninguem era avisado: o cliente marcava e o dono so descobria
   * abrindo a agenda. Vale para o barbeiro escolhido e para o dono.
   */
  async novoAgendamento(params: {
    to: string;
    companyName: string;
    customerName: string;
    customerPhone?: string | null;
    serviceName: string;
    professionalName: string;
    scheduledAt: Date;
    origem: 'link publico' | 'portal do cliente';
  }) {
    const quando = params.scheduledAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const telefone = String(params.customerPhone || '').trim();

    return this.enviar({
      to: params.to,
      contexto: 'novo agendamento',
      subject: `Novo agendamento: ${params.customerName} - ${quando}`,
      html: montarLayout({
        companyName: params.companyName,
        title: 'Novo agendamento',
        body: `
          <p>Um cliente acabou de marcar pelo ${escapeHtml(params.origem)}.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #E4E4E7;color:#71717A;">Cliente</td>
                <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;text-align:right;">${escapeHtml(params.customerName)}</td></tr>
            ${telefone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #E4E4E7;color:#71717A;">Telefone</td>
                <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;text-align:right;">${escapeHtml(telefone)}</td></tr>` : ''}
            <tr><td style="padding:8px 0;border-bottom:1px solid #E4E4E7;color:#71717A;">Servico</td>
                <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;text-align:right;">${escapeHtml(params.serviceName)}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #E4E4E7;color:#71717A;">Profissional</td>
                <td style="padding:8px 0;border-bottom:1px solid #E4E4E7;text-align:right;">${escapeHtml(params.professionalName)}</td></tr>
          </table>`,
        callout: { tone: 'info', text: `Horario marcado: <strong>${quando}</strong>.` },
      }),
    });
  }
}

export const notificationService = new NotificationService();

/**
 * Avisos de agendamento para dono, barbeiro e cliente.
 *
 * Duas pecas:
 * - `avisarCriacao`: o cliente acabou de marcar (link publico ou portal).
 *   Equipe recebe "novo agendamento", cliente recebe a confirmacao.
 * - `executarLembretes`: roda no job de minuto em minuto e manda a regua
 *   D-1, 1h e 15min para os tres.
 *
 * O canal principal e o push (notificacao no app): chega na hora e nao tem
 * cota. E-mail sai uma unica vez por agendamento, so para o dono, no momento
 * em que o cliente marca — o plano do Resend nao comporta e-mail por
 * lembrete para tres pessoas. Nada aqui pode derrubar quem chamou: tudo e
 * best-effort e nunca lanca para fora.
 *
 * Idempotencia: antes de enviar, o aviso e registrado em
 * appointment_notifications, cujo UNIQUE (agendamento, etapa, horario) so
 * deixa uma insercao passar. Quem nao conseguiu inserir nao envia. O custo e
 * que um envio que falhe depois de reservado nao e repetido — preferivel a
 * mandar o mesmo lembrete tres vezes.
 */
import { prisma } from '../db';
import { notificationService } from './notification.service';
import { pushService } from './push.service';

type LembreteEtapa = 'd1' | '1h' | '15m';
type Etapa = 'criado' | LembreteEtapa;

/** Da mais antecipada para a mais proxima. */
const LEMBRETES: Array<{ etapa: LembreteEtapa; antecedenciaMs: number }> = [
  { etapa: 'd1', antecedenciaMs: 24 * 60 * 60 * 1000 },
  { etapa: '1h', antecedenciaMs: 60 * 60 * 1000 },
  { etapa: '15m', antecedenciaMs: 15 * 60 * 1000 },
];

const PUSH_TITULO: Record<LembreteEtapa, string> = {
  d1: 'Amanha',
  '1h': 'Daqui a 1 hora',
  '15m': 'Daqui a 15 minutos',
};

/** Agendamento nesses status nao recebe lembrete. */
const STATUS_ENCERRADOS = ['cancelado', 'cancelled', 'no_show', 'no-show', 'concluido'];

const SELECT_AGENDAMENTO = {
  id: true,
  companyId: true,
  customerName: true,
  serviceName: true,
  professionalId: true,
  professionalName: true,
  scheduledAt: true,
  status: true,
  createdAt: true,
  company: { select: { name: true } },
  customer: {
    select: {
      name: true,
      phone: true,
      account: { select: { id: true, isActive: true } },
    },
  },
} as const;

type Agendamento = {
  id: string;
  companyId: string;
  customerName: string | null;
  serviceName: string;
  professionalId: string | null;
  professionalName: string | null;
  scheduledAt: Date;
  status: string;
  createdAt: Date;
  company: { name: string };
  customer: {
    name: string;
    phone: string | null;
    account: { id: string; isActive: boolean } | null;
  } | null;
};

type Destinatarios = {
  equipeUserIds: string[];
  donoEmails: string[];
  clienteAccountId: string | null;
};

const emailValido = (value: unknown) => {
  const limpo = String(value || '').trim();
  return limpo.includes('@') ? limpo : null;
};

const horario = (value: Date) =>
  value.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Qual lembrete e devido agora, se algum.
 *
 * So o mais proximo do horario conta: se o servidor ficou fora e voltou a
 * 40 minutos do corte, vai o de 1h, nao o D-1 e o de 1h juntos.
 *
 * E so vale se a etapa comecou DEPOIS de o agendamento existir. Quem marca
 * para daqui a 3 horas acabou de receber a confirmacao; um "lembrete de
 * amanha" logo em seguida seria ruido. A regua dele comeca no de 1h.
 */
export function etapaDevida(
  agendamento: { scheduledAt: Date; createdAt: Date },
  agora: Date
): LembreteEtapa | null {
  const horarioMs = agendamento.scheduledAt.getTime();
  if (agora.getTime() >= horarioMs) return null;

  for (let i = LEMBRETES.length - 1; i >= 0; i -= 1) {
    const { etapa, antecedenciaMs } = LEMBRETES[i];
    const disparo = horarioMs - antecedenciaMs;
    if (agora.getTime() >= disparo) {
      return agendamento.createdAt.getTime() <= disparo ? etapa : null;
    }
  }
  return null;
}

class AppointmentNotificationService {
  /**
   * O cliente marcou. Chamar depois do commit e sem await no fluxo do
   * agendamento: o horario ja esta gravado, aviso fora do ar nao vira erro.
   */
  async avisarCriacao(appointmentId: string, origem: 'link publico' | 'portal do cliente') {
    try {
      const agendamento = await this.carregar(appointmentId);
      if (!agendamento) return;
      if (!(await this.reservar(agendamento, 'criado'))) return;

      const destinatarios = await this.destinatarios(agendamento);
      const quando = horario(agendamento.scheduledAt);
      const cliente = agendamento.customerName || agendamento.customer?.name || 'Cliente';
      const profissional = agendamento.professionalName || 'A definir';

      await Promise.allSettled([
        pushService.enviarParaUsuarios(destinatarios.equipeUserIds, {
          title: 'Novo agendamento',
          body: `${cliente} - ${agendamento.serviceName} - ${quando}`,
          url: '/empresa/agendamentos',
          // Sem tag fixa: dois agendamentos diferentes sao dois avisos.
          tag: `agendamento-${agendamento.id}`,
        }),
        ...destinatarios.donoEmails.map((to) =>
          notificationService.novoAgendamento({
            to,
            companyName: agendamento.company.name,
            customerName: cliente,
            customerPhone: agendamento.customer?.phone || null,
            serviceName: agendamento.serviceName,
            professionalName: profissional,
            scheduledAt: agendamento.scheduledAt,
            origem,
          })
        ),
        destinatarios.clienteAccountId
          ? pushService.enviarParaClientes([destinatarios.clienteAccountId], {
              title: 'Agendamento confirmado',
              body: `${agendamento.serviceName} com ${profissional} - ${quando}`,
              url: '/cliente/dashboard',
              tag: `agendamento-${agendamento.id}`,
            })
          : Promise.resolve(),
      ]);
    } catch (error: any) {
      console.warn(`[agendamento] falha ao avisar criacao de ${appointmentId}:`, error?.message);
    }
  }

  /** Um ciclo do job de lembretes. */
  async executarLembretes(agora = new Date()) {
    const resultado = { lembretes: 0, erros: 0 };
    const maiorAntecedencia = LEMBRETES[0].antecedenciaMs;

    // Tudo que acontece nas proximas 24h, em todas as barbearias. E pouco:
    // o volume de um dia de agenda, relido a cada minuto por indice.
    const candidatos: Agendamento[] = await (prisma as any).appointment.findMany({
      where: {
        scheduledAt: { gt: agora, lte: new Date(agora.getTime() + maiorAntecedencia) },
        status: { notIn: STATUS_ENCERRADOS },
      },
      select: SELECT_AGENDAMENTO,
    });
    if (candidatos.length === 0) return resultado;

    // Filtro barato antes da reserva: a maioria ja recebeu a etapa devida.
    const jaEnviados = await (prisma as any).appointmentNotification.findMany({
      where: { appointmentId: { in: candidatos.map((item) => item.id) } },
      select: { appointmentId: true, stage: true, scheduledAt: true },
    });
    const enviados = new Set(
      jaEnviados.map(
        (item: any) => `${item.appointmentId}|${item.stage}|${new Date(item.scheduledAt).getTime()}`
      )
    );

    for (const agendamento of candidatos) {
      const etapa = etapaDevida(agendamento, agora);
      if (!etapa) continue;
      if (enviados.has(`${agendamento.id}|${etapa}|${agendamento.scheduledAt.getTime()}`)) continue;

      try {
        if (!(await this.reservar(agendamento, etapa))) continue;
        await this.enviarLembrete(agendamento, etapa);
        resultado.lembretes += 1;
      } catch (error: any) {
        resultado.erros += 1;
        console.warn(`[lembrete] ${etapa} de ${agendamento.id} falhou:`, error?.message);
      }
    }

    return resultado;
  }

  private async enviarLembrete(agendamento: Agendamento, etapa: LembreteEtapa) {
    const destinatarios = await this.destinatarios(agendamento);
    const quando = horario(agendamento.scheduledAt);
    const cliente = agendamento.customerName || agendamento.customer?.name || 'Cliente';
    const profissional = agendamento.professionalName || 'A definir';
    // A mesma tag por agendamento: o lembrete de 15min substitui o de 1h na
    // bandeja em vez de empilhar tres avisos do mesmo corte.
    const tag = `lembrete-${agendamento.id}`;

    await Promise.allSettled([
      pushService.enviarParaUsuarios(destinatarios.equipeUserIds, {
        title: `${PUSH_TITULO[etapa]}: ${cliente}`,
        body: `${agendamento.serviceName} com ${profissional} - ${quando}`,
        url: '/empresa/agendamentos',
        tag,
      }),
      destinatarios.clienteAccountId
        ? pushService.enviarParaClientes([destinatarios.clienteAccountId], {
            title: `${PUSH_TITULO[etapa]}: seu horario`,
            body: `${agendamento.serviceName} com ${profissional} - ${quando}`,
            url: '/cliente/dashboard',
            tag,
          })
        : Promise.resolve(),
    ]);
  }

  private carregar(appointmentId: string): Promise<Agendamento | null> {
    return (prisma as any).appointment.findUnique({
      where: { id: appointmentId },
      select: SELECT_AGENDAMENTO,
    });
  }

  /** Grava o aviso antes de enviar. `false` = outro ciclo ja enviou. */
  private async reservar(agendamento: Agendamento, etapa: Etapa) {
    try {
      await (prisma as any).appointmentNotification.create({
        data: {
          appointmentId: agendamento.id,
          companyId: agendamento.companyId,
          stage: etapa,
          scheduledAt: agendamento.scheduledAt,
        },
        select: { id: true },
      });
      return true;
    } catch (error: any) {
      if (error?.code === 'P2002') return false;
      throw error;
    }
  }

  /**
   * Push: dono(s) e o barbeiro do horario, sem repetir quem e as duas coisas,
   * e o cliente pela conta do portal. E-mail: so o(s) dono(s).
   */
  private async destinatarios(agendamento: Agendamento): Promise<Destinatarios> {
    const equipe = await prisma.userRole.findMany({
      where: {
        companyId: agendamento.companyId,
        user: { isActive: true },
        OR: [
          { role: 'DONO_EMPRESA' },
          ...(agendamento.professionalId ? [{ userId: agendamento.professionalId }] : []),
        ],
      },
      select: { userId: true, role: true, user: { select: { email: true } } },
    });

    const conta = agendamento.customer?.account?.isActive ? agendamento.customer.account : null;

    return {
      equipeUserIds: Array.from(new Set(equipe.map((item) => item.userId))),
      donoEmails: Array.from(
        new Set(
          equipe
            .filter((item) => item.role === 'DONO_EMPRESA')
            .map((item) => emailValido(item.user?.email))
            .filter(Boolean) as string[]
        )
      ),
      clienteAccountId: conta?.id || null,
    };
  }
}

export const appointmentNotificationService = new AppointmentNotificationService();

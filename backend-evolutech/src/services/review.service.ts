/**
 * Avaliacao anonima do atendimento — estilo Uber/99.
 *
 * O cliente da 1 a 5 estrelas (e um comentario opcional) para cada
 * agendamento concluido. Quem ve o que:
 *
 * - Dono: ranking da equipe e cada avaliacao com o nome do cliente, para
 *   conseguir chamar quem saiu insatisfeito.
 * - Barbeiro: so a propria nota e os comentarios, sem cliente, servico, dia
 *   ou hora — qualquer um desses entrega quem foi.
 * - Link publico: media de cada barbeiro, so depois de MIN_AVALIACOES_PUBLICAS
 *   notas, para uma avaliacao isolada nao definir a reputacao de ninguem.
 *
 * O anonimato e garantido aqui, na leitura. A tela nunca recebe o que o
 * perfil nao pode ver.
 */
import { prisma } from '../db';
import { AuthenticatedCustomer, AuthenticatedUser } from '../types';

export class ReviewError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ReviewError';
    this.statusCode = statusCode;
  }
}

/** Depois disso o cliente ja nao lembra do corte direito. */
export const PRAZO_AVALIACAO_DIAS = 30;
const PRAZO_AVALIACAO_MS = PRAZO_AVALIACAO_DIAS * 24 * 60 * 60 * 1000;
export const MIN_AVALIACOES_PUBLICAS = 3;
const MAX_COMENTARIO = 500;
const STATUS_CONCLUIDO = new Set(['concluido', 'completed', 'done']);

export type NotaProfissional = { media: number; total: number };

const arredondar = (valor: number) => Math.round(valor * 10) / 10;

/** Se este agendamento ainda aceita avaliacao. Usado tambem na lista do portal. */
export const podeAvaliar = (appointment: {
  status?: string | null;
  professionalId?: string | null;
  scheduledAt: Date;
  review?: unknown;
}) =>
  STATUS_CONCLUIDO.has(String(appointment.status || '').toLowerCase()) &&
  Boolean(appointment.professionalId) &&
  !appointment.review &&
  Date.now() - new Date(appointment.scheduledAt).getTime() <= PRAZO_AVALIACAO_MS;

export class ReviewService {
  // ---------------------------------------------------------------------
  // Cliente
  // ---------------------------------------------------------------------

  async avaliar(auth: AuthenticatedCustomer, appointmentId: string, body: { rating?: unknown; comment?: unknown }) {
    const id = String(appointmentId || '').trim();
    if (!id) throw new ReviewError('appointmentId obrigatorio', 400);

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewError('Nota deve ser de 1 a 5 estrelas', 400);
    }
    const comment = String(body.comment ?? '').trim().slice(0, MAX_COMENTARIO) || null;

    // Escopo pelo id do cadastro, como no resto do portal: nunca pelo nome.
    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: auth.companyId, customerId: auth.customerId },
      select: {
        id: true,
        status: true,
        professionalId: true,
        scheduledAt: true,
        review: { select: { id: true } },
      },
    });
    if (!appointment) throw new ReviewError('Agendamento nao encontrado', 404);
    if (appointment.review) throw new ReviewError('Este atendimento ja foi avaliado', 409);
    if (!podeAvaliar(appointment)) {
      throw new ReviewError('So da para avaliar atendimento concluido nos ultimos 30 dias', 400);
    }

    try {
      const created = await prisma.appointmentReview.create({
        data: {
          companyId: auth.companyId,
          appointmentId: appointment.id,
          professionalId: appointment.professionalId,
          customerId: auth.customerId,
          rating,
          comment,
        },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
      return { id: created.id, rating: created.rating, comment: created.comment, created_at: created.createdAt };
    } catch (error: any) {
      // Dois toques no "Enviar" ao mesmo tempo: o UNIQUE segura o segundo.
      if (error?.code === 'P2002') throw new ReviewError('Este atendimento ja foi avaliado', 409);
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Link publico e escolha do barbeiro
  // ---------------------------------------------------------------------

  /** Media por barbeiro para mostrar ao cliente. Quem tem poucas notas fica de fora. */
  async notasPublicas(companyId: string): Promise<Map<string, NotaProfissional>> {
    const notas = new Map<string, NotaProfissional>();
    let grupos;
    try {
      grupos = await prisma.appointmentReview.groupBy({
        by: ['professionalId'],
        where: { companyId, professionalId: { not: null } },
        _avg: { rating: true },
        _count: { _all: true },
      });
    } catch (error: any) {
      // Estrela e enfeite: se a consulta falhar (ex.: migration ainda nao
      // aplicada), o link de agendamento continua funcionando sem nota.
      console.warn('[reviews] notas publicas indisponiveis:', error?.message || error);
      return notas;
    }
    for (const grupo of grupos) {
      if (!grupo.professionalId || grupo._count._all < MIN_AVALIACOES_PUBLICAS) continue;
      notas.set(grupo.professionalId, {
        media: arredondar(Number(grupo._avg.rating || 0)),
        total: grupo._count._all,
      });
    }
    return notas;
  }

  // ---------------------------------------------------------------------
  // Equipe
  // ---------------------------------------------------------------------

  async resumo(user: AuthenticatedUser) {
    if (!user.companyId) throw new ReviewError('Usuario sem empresa vinculada', 403);
    if (user.role === 'DONO_EMPRESA') return this.resumoDoDono(user.companyId);
    if (user.role === 'FUNCIONARIO_EMPRESA') return this.resumoDoBarbeiro(user.companyId, user.id);
    throw new ReviewError('Sem acesso as avaliacoes', 403);
  }

  private distribuicao(ratings: number[]) {
    const contagem: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const nota of ratings) contagem[String(nota)] = (contagem[String(nota)] || 0) + 1;
    return contagem;
  }

  private async resumoDoDono(companyId: string) {
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [equipe, geral, ultimos30, recentes] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          companyId,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: { userId: true, user: { select: { fullName: true, avatarUrl: true } } },
      }),
      prisma.appointmentReview.groupBy({
        by: ['professionalId'],
        where: { companyId, professionalId: { not: null } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.appointmentReview.groupBy({
        by: ['professionalId'],
        where: { companyId, professionalId: { not: null }, createdAt: { gte: trintaDiasAtras } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.appointmentReview.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          professionalId: true,
          customerId: true,
          appointment: { select: { serviceName: true, scheduledAt: true, professionalName: true, customerName: true } },
        },
      }),
    ]);

    const nomes = new Map(equipe.map((item) => [item.userId, item.user.fullName]));
    const porGeral = new Map(geral.map((g) => [g.professionalId, g]));
    const por30 = new Map(ultimos30.map((g) => [g.professionalId, g]));

    const clienteIds = Array.from(new Set(recentes.map((r) => r.customerId).filter(Boolean))) as string[];
    const clientes = clienteIds.length
      ? await prisma.customer.findMany({
          where: { companyId, id: { in: clienteIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));

    const ranking = equipe
      .map((item) => {
        const g = porGeral.get(item.userId);
        const m = por30.get(item.userId);
        return {
          professional_id: item.userId,
          name: item.user.fullName,
          avatar_url: item.user.avatarUrl || null,
          media: g ? arredondar(Number(g._avg.rating || 0)) : null,
          total: g?._count._all || 0,
          media_30d: m ? arredondar(Number(m._avg.rating || 0)) : null,
          total_30d: m?._count._all || 0,
        };
      })
      // Quem tem nota vem antes; entre eles, maior media e depois mais avaliacoes.
      .sort((a, b) => {
        if (a.media === null && b.media === null) return a.name.localeCompare(b.name);
        if (a.media === null) return 1;
        if (b.media === null) return -1;
        return b.media - a.media || b.total - a.total;
      });

    const totalGeral = geral.reduce((soma, g) => soma + g._count._all, 0);
    const somaGeral = geral.reduce((soma, g) => soma + Number(g._avg.rating || 0) * g._count._all, 0);
    const todasNotas = await prisma.appointmentReview.groupBy({
      by: ['rating'],
      where: { companyId },
      _count: { _all: true },
    });

    return {
      perfil: 'dono' as const,
      media: totalGeral ? arredondar(somaGeral / totalGeral) : null,
      total: totalGeral,
      distribuicao: Object.fromEntries(
        ['1', '2', '3', '4', '5'].map((n) => [
          n,
          todasNotas.find((t) => String(t.rating) === n)?._count._all || 0,
        ]),
      ),
      ranking,
      recentes: recentes.map((r) => {
        const cliente = r.customerId ? clientePorId.get(r.customerId) : undefined;
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.createdAt,
          professional_id: r.professionalId,
          professional_name:
            (r.professionalId && nomes.get(r.professionalId)) || r.appointment.professionalName || null,
          customer_name: cliente?.name || r.appointment.customerName || null,
          customer_phone: cliente?.phone || null,
          service_name: r.appointment.serviceName,
          scheduled_at: r.appointment.scheduledAt,
        };
      }),
    };
  }

  private async resumoDoBarbeiro(companyId: string, professionalId: string) {
    const minhas = await prisma.appointmentReview.findMany({
      where: { companyId, professionalId },
      orderBy: { createdAt: 'desc' },
      // Nada de cliente, servico, dia ou hora: so nota e comentario.
      select: { rating: true, comment: true },
    });

    const total = minhas.length;
    const soma = minhas.reduce((acc, r) => acc + r.rating, 0);

    return {
      perfil: 'barbeiro' as const,
      media: total ? arredondar(soma / total) : null,
      total,
      distribuicao: this.distribuicao(minhas.map((r) => r.rating)),
      // So os comentarios, sem ordem por data, para o ultimo cliente atendido
      // nao ser identificado por ser "o comentario que apareceu agora".
      comentarios: minhas
        .filter((r) => r.comment)
        .slice(0, 50)
        .map((r) => ({ rating: r.rating, comment: r.comment as string }))
        .sort((a, b) => b.rating - a.rating || a.comment.localeCompare(b.comment)),
    };
  }
}

export const reviewService = new ReviewService();

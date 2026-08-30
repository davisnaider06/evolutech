/**
 * Regua de cobranca das mensalidades.
 *
 * Roda periodicamente e trabalha sempre em cima da data de vencimento de cada
 * assinatura, que e individual: quem assinou dia 10 vence dia 10, quem assinou
 * dia 25 vence dia 25.
 *
 *   D-2  avisa o cliente por e-mail.
 *        - PIX:    "pague ate o dia X ou seu plano sera cancelado"
 *        - cartao: "vamos cobrar no seu cartao no dia X"
 *
 *   D+0  fecha o ciclo:
 *        - manual: NAO cancela e NAO cobra nada. Marca a mensalidade como
 *                  "overdue" e espera o dono confirmar se recebeu. Barbearia
 *                  que nao conecta conta bancaria vive nesse caminho: quem
 *                  sabe se o dinheiro entrou e o dono, nao o sistema.
 *        - cartao: cobra no cartao salvo. Autorizou -> renova por mais um
 *                  ciclo e avisa. Recusou -> NAO cancela na hora: o plano
 *                  segue ativo por alguns dias e o sistema tenta de novo,
 *                  avisando o cliente a cada falha. So cancela depois de
 *                  esgotar as tentativas (padrao: 3 tentativas em 5 dias).
 *        - PIX:    pagou -> encerra o ciclo; nao pagou -> cancela e avisa.
 *
 * O envio de aviso e idempotente (`renewalNoticeSentAt`), entao rodar o job
 * varias vezes ao dia nao incomoda o cliente.
 */
import { prisma } from '../db';
import { notificationService } from './notification.service';
import { PaymentService } from './payment.service';
import { CompanyService } from './company.service';

const DIAS_DE_AVISO = Number(process.env.SUBSCRIPTION_NOTICE_DAYS || 2);

/**
 * Quantos dias esperar entre uma tentativa de cobranca e a proxima.
 * O padrao "2,3" significa: cobra no vencimento, tenta de novo 2 dias
 * depois e mais 3 dias depois — 3 tentativas em 5 dias de tolerancia.
 */
const INTERVALOS_DE_TENTATIVA = String(process.env.SUBSCRIPTION_RETRY_DAYS || '2,3')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v > 0);

const MAX_TENTATIVAS = INTERVALOS_DE_TENTATIVA.length + 1;

const ehCartao = (metodo: unknown) =>
  ['credito', 'debito', 'cartao'].includes(String(metodo || '').toLowerCase());

/** Metodos que dizem explicitamente "o acerto e no balcao". */
const METODOS_MANUAIS = ['manual', 'dinheiro', 'balcao', 'especie'];

const ehManualExplicito = (metodo: unknown) =>
  METODOS_MANUAIS.includes(String(metodo || '').toLowerCase());

/** Dias inteiros entre uma data e agora, nunca negativo. */
const diasDesde = (data: Date | string | null | undefined) => {
  if (!data) return 0;
  const inicio = new Date(data).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((Date.now() - inicio) / 86400000));
};

export interface ExecucaoRegua {
  avisos_enviados: number;
  renovadas: number;
  canceladas: number;
  /** Mensalidades manuais que venceram e aguardam o dono confirmar. */
  em_aberto: number;
  /** Empresas que receberam o resumo do dia. */
  resumos_enviados: number;
  erros: number;
  detalhes: string[];
}

export class SubscriptionBillingService {
  private paymentService = new PaymentService();
  private companyService = new CompanyService();

  /** Empresas que tem gateway ativo, respondido uma vez por passada da regua. */
  private cacheGateway = new Map<string, boolean>();

  private async empresaTemGateway(companyId: string) {
    const cacheado = this.cacheGateway.get(companyId);
    if (cacheado !== undefined) return cacheado;

    const gateway = await (prisma as any).paymentGateway.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
    });
    const tem = Boolean(gateway);
    this.cacheGateway.set(companyId, tem);
    return tem;
  }

  /**
   * Como esta mensalidade e cobrada.
   *
   * A regra do meio e a que resolve o caso real: barbearia sem gateway nao
   * tem como receber PIX confirmado por webhook, entao "pix" ali significa,
   * na pratica, dinheiro no balcao. Tratar como automatico era o que fazia a
   * assinatura ser cancelada sozinha todo mes.
   */
  private async modoDeCobranca(item: any): Promise<'manual' | 'cartao' | 'pix'> {
    if (ehManualExplicito(item.paymentMethod)) return 'manual';
    if (ehCartao(item.paymentMethod)) return 'cartao';
    return (await this.empresaTemGateway(item.companyId)) ? 'pix' : 'manual';
  }

  /** Ativas que vencem daqui a N dias e ainda nao receberam o aviso. */
  private async buscarParaAvisar() {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + DIAS_DE_AVISO);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setHours(23, 59, 59, 999);

    return (prisma as any).customerSubscription.findMany({
      where: {
        status: 'active',
        endAt: { gte: inicio, lte: fim },
        renewalNoticeSentAt: null,
      },
      include: {
        customer: { select: { name: true, email: true } },
        company: { select: { name: true, status: true } },
        plan: { select: { name: true } },
      },
    });
  }

  /** Assinaturas que passaram da data de vencimento. */
  private async buscarVencidas() {
    return (prisma as any).customerSubscription.findMany({
      where: {
        status: { in: ['active', 'pending', 'overdue'] },
        endAt: { lt: new Date() },
      },
      include: {
        customer: { select: { name: true, email: true } },
        company: { select: { name: true, status: true } },
        plan: {
          select: { name: true, isActive: true, isUnlimited: true, includedServices: true, interval: true },
        },
        order: { select: { status: true } },
      },
    });
  }

  /** Envia o aviso de D-2 para quem ainda nao recebeu. */
  async enviarAvisosDeVencimento() {
    const pendentes = await this.buscarParaAvisar();
    let enviados = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const item of pendentes) {
      if (item.company?.status !== 'active') continue;

      const dados = {
        to: item.customer?.email || '',
        customerName: item.customer?.name || 'cliente',
        companyName: item.company?.name || 'Barbearia',
        planName: item.plan?.name || 'Plano',
        amount: Number(item.amount || 0),
        endAt: item.endAt,
      };

      try {
        const modo = await this.modoDeCobranca(item);
        const resultado =
          modo === 'cartao'
            ? await notificationService.avisoVencimentoCartao(dados)
            : modo === 'manual'
              ? await notificationService.avisoVencimentoManual(dados)
              : await notificationService.avisoVencimentoPix(dados);

        // Marca como avisado mesmo quando o envio e pulado (cliente sem
        // e-mail): senao o job tentaria de novo todo dia, para sempre.
        await (prisma as any).customerSubscription.update({
          where: { id: item.id },
          data: { renewalNoticeSentAt: new Date() },
        });

        if (resultado.sent) {
          enviados += 1;
          detalhes.push(`aviso enviado: ${dados.customerName} (${dados.planName})`);
        } else {
          detalhes.push(
            `aviso ignorado: ${dados.customerName} - ${resultado.skipped || resultado.error}`
          );
        }
      } catch (error: any) {
        erros += 1;
        detalhes.push(`falha ao avisar ${dados.customerName}: ${error?.message}`);
      }
    }

    return { enviados, erros, detalhes };
  }

  /** Fecha o ciclo de quem chegou no vencimento. */
  async processarVencimentos() {
    const vencidas = await this.buscarVencidas();
    let renovadas = 0;
    let canceladas = 0;
    let emAberto = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const item of vencidas) {
      const nome = item.customer?.name || 'cliente';
      const plano = item.plan?.name || 'Plano';
      const empresaAtiva = item.company?.status === 'active';
      const planoAtivo = item.plan?.isActive !== false;

      try {
        // Renovacao desligada ou plano desativado: encerra sem cobrar.
        if (!item.autoRenew || !planoAtivo) {
          await this.encerrar(item.id, 'expired');
          canceladas += 1;
          detalhes.push(`encerrada sem renovar: ${nome} - ${plano}`);
          continue;
        }

        const modo = await this.modoDeCobranca(item);

        // Cobranca manual: o sistema nao decide nada sozinho.
        //
        // Antes esta assinatura caia no caminho do PIX, onde "order.status
        // !== paid" — que sem gateway nunca vira 'paid' — significava
        // cancelar. Resultado: toda mensalidade de barbearia sem gateway era
        // cancelada no vencimento, com e-mail de cancelamento para o cliente.
        // Agora ela fica em aberto, esperando o dono dar baixa.
        if (modo === 'manual') {
          if (item.status === 'overdue') {
            detalhes.push(`em aberto aguardando o dono: ${nome} - ${plano}`);
            continue;
          }

          await (prisma as any).customerSubscription.update({
            where: { id: item.id },
            data: { status: 'overdue', overdueSince: new Date() },
          });
          emAberto += 1;
          detalhes.push(`marcada em aberto: ${nome} - ${plano}`);

          if (empresaAtiva) {
            await notificationService.avisoMensalidadeEmAberto({
              to: item.customer?.email || '',
              customerName: nome,
              companyName: item.company?.name || 'Barbearia',
              planName: plano,
              amount: Number(item.amount || 0),
              endAt: item.endAt,
              diasEmAtraso: diasDesde(item.endAt),
            });
          }
          continue;
        }

        if (modo === 'cartao') {
          // Ja falhou antes e ainda nao chegou a hora de tentar de novo:
          // o cliente segue com o plano ativo, esperando dentro do prazo.
          if (item.graceUntil && !this.chegouAHoraDeTentar(item)) {
            detalhes.push(
              `aguardando nova tentativa: ${nome} (tentativa ${item.paymentAttempts} de ${MAX_TENTATIVAS})`
            );
            continue;
          }

          const resultado = await this.cobrarProximoCiclo(item);
          if (resultado.ok) {
            renovadas += 1;
            detalhes.push(`renovada no cartao: ${nome} - ${plano}`);
            continue;
          }

          const tentativa = Number(item.paymentAttempts || 0) + 1;
          const acabaramAsTentativas = tentativa >= MAX_TENTATIVAS;

          if (acabaramAsTentativas) {
            await this.encerrar(item.id, 'canceled');
            canceladas += 1;
            detalhes.push(
              `cancelada apos ${tentativa} tentativas: ${nome} - ${resultado.motivo}`
            );
            if (empresaAtiva) {
              await notificationService.assinaturaCancelada({
                to: item.customer?.email || '',
                customerName: nome,
                companyName: item.company?.name || 'Barbearia',
                planName: plano,
                motivo: 'falha_cartao',
              });
            }
            continue;
          }

          // Ainda ha tentativas: mantem o plano ativo e avisa o cliente.
          const { proxima, prazoFinal } = this.calcularProximaTentativa(item, tentativa);
          await (prisma as any).customerSubscription.update({
            where: { id: item.id },
            data: {
              paymentAttempts: tentativa,
              lastPaymentAttemptAt: new Date(),
              graceUntil: prazoFinal,
            },
          });
          detalhes.push(
            `cobranca falhou (${tentativa}/${MAX_TENTATIVAS}), nova tentativa em ` +
              `${proxima.toLocaleDateString('pt-BR')}: ${nome} - ${resultado.motivo}`
          );
          if (empresaAtiva) {
            await notificationService.falhaNaCobranca({
              to: item.customer?.email || '',
              customerName: nome,
              companyName: item.company?.name || 'Barbearia',
              planName: plano,
              amount: Number(item.amount || 0),
              tentativa,
              totalTentativas: MAX_TENTATIVAS,
              proximaTentativa: proxima,
              prazoFinal,
            });
          }
          continue;
        }

        // PIX: vale o que foi avisado dois dias antes.
        if (item.order?.status === 'paid') {
          await this.encerrar(item.id, 'expired');
          canceladas += 1;
          detalhes.push(`ciclo encerrado, pix pago: ${nome} - ${plano}`);
        } else {
          await this.encerrar(item.id, 'canceled');
          canceladas += 1;
          detalhes.push(`cancelada, pix nao pago: ${nome} - ${plano}`);
          if (empresaAtiva) {
            await notificationService.assinaturaCancelada({
              to: item.customer?.email || '',
              customerName: nome,
              companyName: item.company?.name || 'Barbearia',
              planName: plano,
              motivo: 'sem_pagamento',
            });
          }
        }
      } catch (error: any) {
        erros += 1;
        detalhes.push(`falha ao processar ${nome}: ${error?.message}`);
      }
    }

    return { renovadas, canceladas, emAberto, erros, detalhes };
  }

  /**
   * true quando ja passou o intervalo desde a ultima tentativa.
   * Evita cobrar o cartao varias vezes no mesmo dia so porque o job
   * roda de 6 em 6 horas.
   */
  private chegouAHoraDeTentar(item: any) {
    const ultima = item.lastPaymentAttemptAt ? new Date(item.lastPaymentAttemptAt) : null;
    if (!ultima) return true;

    const tentativasFeitas = Number(item.paymentAttempts || 0);
    const intervalo = INTERVALOS_DE_TENTATIVA[tentativasFeitas - 1] ?? INTERVALOS_DE_TENTATIVA[0] ?? 2;
    const proxima = new Date(ultima);
    proxima.setDate(proxima.getDate() + intervalo);
    return new Date() >= proxima;
  }

  /** Quando sera a proxima tentativa e ate quando vai a tolerancia. */
  private calcularProximaTentativa(item: any, tentativaAtual: number) {
    const intervalo = INTERVALOS_DE_TENTATIVA[tentativaAtual - 1] ?? 2;
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + intervalo);

    // O prazo final e a soma de todos os intervalos, contada do vencimento.
    const prazoFinal = new Date(item.endAt);
    prazoFinal.setDate(
      prazoFinal.getDate() + INTERVALOS_DE_TENTATIVA.reduce((soma, dias) => soma + dias, 0)
    );
    return { proxima, prazoFinal };
  }

  private async encerrar(subscriptionId: string, status: 'expired' | 'canceled') {
    await (prisma as any).customerSubscription.update({
      where: { id: subscriptionId },
      data: { status },
    });
  }

  /**
   * Cobra o proximo ciclo no cartao salvo e, dando certo, cria a assinatura
   * do periodo seguinte ja ativa.
   *
   * O pedido nasce pendente e so vira pago quando o gateway autoriza. Nunca
   * marcamos um pedido como pago sem cobranca real — que era exatamente o
   * defeito da renovacao automatica antiga.
   */
  private async cobrarProximoCiclo(item: any): Promise<{ ok: boolean; motivo?: string }> {
    const valor = Number(item.amount || 0);
    if (valor <= 0) return { ok: false, motivo: 'valor da mensalidade invalido' };

    const pedido = await prisma.order.create({
      data: {
        companyId: item.companyId,
        customerName: item.customer?.name || null,
        total: valor,
        status: 'pending_gateway',
      },
    });

    const cobranca = await this.paymentService.cobrarNoCartaoSalvo({
      companyId: item.companyId,
      customerId: item.customerId,
      orderId: pedido.id,
      amount: valor,
      descricao: `Renovacao ${item.plan?.name || 'mensalidade'}`,
    });

    if (!cobranca.ok) {
      await prisma.order.update({ where: { id: pedido.id }, data: { status: 'failed' } });
      return { ok: false, motivo: cobranca.motivo };
    }

    await prisma.order.update({ where: { id: pedido.id }, data: { status: 'paid' } });

    const inicio = new Date(item.endAt);
    inicio.setMilliseconds(inicio.getMilliseconds() + 1);
    const fim = this.proximoVencimento(inicio, item.plan?.interval || 'monthly');

    await this.encerrar(item.id, 'expired');

    const renovada = await (prisma as any).customerSubscription.create({
      data: {
        companyId: item.companyId,
        customerId: item.customerId,
        planId: item.planId,
        professionalId: item.professionalId || null,
        status: 'active',
        startAt: inicio,
        endAt: fim,
        remainingServices: item.plan?.isUnlimited
          ? null
          : Math.max(0, Number(item.plan?.includedServices || 0)),
        autoRenew: true,
        amount: valor,
        orderId: pedido.id,
        paymentMethod: item.paymentMethod,
        notes: 'Renovacao automatica no cartao',
        // Ciclo novo comeca sem historico de falha.
        paymentAttempts: 0,
        lastPaymentAttemptAt: null,
        graceUntil: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: item.companyId,
        action: 'SUBSCRIPTION_RENEWED_CARD',
        resource: 'customer_subscriptions',
        details: {
          assinatura_anterior: item.id,
          assinatura_nova: renovada.id,
          pedido: pedido.id,
          valor,
        },
      },
    });

    if (item.company?.status === 'active') {
      await notificationService.assinaturaAtivada({
        to: item.customer?.email || '',
        customerName: item.customer?.name || 'cliente',
        companyName: item.company?.name || 'Barbearia',
        planName: item.plan?.name || 'Plano',
        amount: valor,
        endAt: fim,
        isUnlimited: Boolean(item.plan?.isUnlimited),
        remainingServices: renovada.remainingServices ?? null,
      });
    }

    return { ok: true };
  }

  /**
   * Proximo vencimento, travando no ultimo dia do mes.
   * Sem isso, quem assina dia 31 de janeiro venceria dia 3 de marco,
   * porque o JavaScript empurra a data quando o mes nao tem aquele dia.
   */
  private proximoVencimento(inicio: Date, intervalo: string) {
    const fim = new Date(inicio);
    const diaOriginal = fim.getDate();
    if (intervalo === 'yearly') fim.setFullYear(fim.getFullYear() + 1);
    else if (intervalo === 'quarterly') fim.setMonth(fim.getMonth() + 3);
    else fim.setMonth(fim.getMonth() + 1);
    if (fim.getDate() !== diaOriginal) fim.setDate(0);
    fim.setMilliseconds(fim.getMilliseconds() - 1);
    return fim;
  }

  /**
   * Manda para cada dono a lista do que ele precisa cobrar e dar baixa.
   *
   * E o unico aviso da regua que fala com o dono. Todos os outros falam com o
   * cliente final — e na cobranca manual isso nao basta: o cliente nao tem
   * como se dar baixa sozinho, entao sem esta lista a mensalidade em aberto
   * fica invisivel ate alguem abrir a tela de Assinaturas.
   *
   * Vai por e-mail e por WhatsApp. Uma vez por dia, guardado por
   * billingDigestSentAt: o job roda de 6 em 6 horas e o dono nao precisa da
   * mesma lista quatro vezes.
   */
  async enviarResumoParaDonos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const limiteAviso = new Date();
    limiteAviso.setDate(limiteAviso.getDate() + DIAS_DE_AVISO);
    limiteAviso.setHours(23, 59, 59, 999);

    const empresas = await (prisma as any).company.findMany({
      where: {
        status: 'active',
        OR: [{ billingDigestSentAt: null }, { billingDigestSentAt: { lt: hoje } }],
      },
      select: { id: true, name: true, notificationPhone: true },
    });

    let enviados = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const empresa of empresas) {
      try {
        const [vencendo, emAberto] = await Promise.all([
          (prisma as any).customerSubscription.findMany({
            where: {
              companyId: empresa.id,
              status: 'active',
              endAt: { gte: new Date(), lte: limiteAviso },
            },
            include: { customer: { select: { name: true } }, plan: { select: { name: true } } },
            orderBy: { endAt: 'asc' },
          }),
          (prisma as any).customerSubscription.findMany({
            where: { companyId: empresa.id, status: 'overdue' },
            include: { customer: { select: { name: true } }, plan: { select: { name: true } } },
            orderBy: { overdueSince: 'asc' },
          }),
        ]);

        // Nada a cobrar: nao existe motivo para uma mensagem dizendo isso.
        if (vencendo.length === 0 && emAberto.length === 0) continue;

        const mapear = (item: any) => ({
          customerName: item.customer?.name || 'cliente',
          planName: item.plan?.name || 'Plano',
          amount: Number(item.amount || 0),
          endAt: item.endAt,
        });

        const listaVencendo = vencendo.map(mapear);
        const listaEmAberto = emAberto.map((item: any) => ({
          ...mapear(item),
          diasEmAtraso: diasDesde(item.overdueSince || item.endAt),
        }));

        // E-mail vai para o dono da empresa (o DONO_EMPRESA cadastrado).
        const dono = await prisma.userRole.findFirst({
          where: { companyId: empresa.id, role: 'DONO_EMPRESA', user: { isActive: true } },
          select: { user: { select: { email: true } } },
          orderBy: { createdAt: 'asc' },
        });

        if (dono?.user?.email) {
          await notificationService.resumoMensalidadesParaDono({
            to: dono.user.email,
            companyName: empresa.name,
            vencendo: listaVencendo,
            emAberto: listaEmAberto,
          });
        }

        if (empresa.notificationPhone) {
          await this.enviarResumoPorWhatsApp(empresa, listaVencendo, listaEmAberto);
        }

        await (prisma as any).company.update({
          where: { id: empresa.id },
          data: { billingDigestSentAt: new Date() },
        });

        enviados += 1;
        detalhes.push(
          `resumo enviado a ${empresa.name}: ${listaVencendo.length} vencendo, ` +
            `${listaEmAberto.length} em aberto`
        );
      } catch (error: any) {
        erros += 1;
        detalhes.push(`falha no resumo de ${empresa.name}: ${error?.message}`);
      }
    }

    return { enviados, erros, detalhes };
  }

  /** Mesma lista do e-mail, no formato curto que o WhatsApp comporta. */
  private async enviarResumoPorWhatsApp(
    empresa: { id: string; name: string; notificationPhone: string | null },
    vencendo: Array<{ customerName: string; planName: string; amount: number; endAt: Date }>,
    emAberto: Array<{ customerName: string; amount: number; diasEmAtraso: number }>
  ) {
    const dinheiro = (valor: number) =>
      Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const partes: string[] = [`*${empresa.name}* - mensalidades a receber`];

    if (vencendo.length > 0) {
      partes.push(
        `\n*Vencem em ate ${DIAS_DE_AVISO} dias (${vencendo.length}):*\n` +
          vencendo
            .slice(0, 15)
            .map(
              (item) =>
                `- ${item.customerName} - ${dinheiro(item.amount)} - ${new Date(
                  item.endAt
                ).toLocaleDateString('pt-BR')}`
            )
            .join('\n')
      );
    }

    if (emAberto.length > 0) {
      const total = emAberto.reduce((soma, item) => soma + Number(item.amount || 0), 0);
      partes.push(
        `\n*Em aberto, aguardando voce (${emAberto.length}):*\n` +
          emAberto
            .slice(0, 15)
            .map(
              (item) =>
                `- ${item.customerName} - ${dinheiro(item.amount)}` +
                (item.diasEmAtraso > 0 ? ` - ha ${item.diasEmAtraso}d` : ' - vence hoje')
            )
            .join('\n') +
          `\n\nTotal em aberto: *${dinheiro(total)}*`
      );
    }

    partes.push('\nConfirme os recebimentos em Assinaturas.');

    try {
      await this.companyService.sendWhatsApp(
        {
          id: 'subscription-billing-system',
          email: 'billing-system@evolutech.local',
          fullName: 'Regua de Mensalidades',
          role: 'SUPER_ADMIN_EVOLUTECH',
          companyId: empresa.id,
          companyName: empresa.name,
        },
        {
          phone: empresa.notificationPhone || '',
          message: partes.join('\n'),
          company_id: empresa.id,
        }
      );
    } catch (error: any) {
      // WhatsApp fora do ar nao pode impedir o e-mail nem travar a regua.
      console.warn(`[subscription-billing] whatsapp do resumo falhou (${empresa.name}):`, error?.message);
    }
  }

  /** Passada completa da regua. E o que o job periodico chama. */
  async executar(): Promise<ExecucaoRegua> {
    this.cacheGateway.clear();

    const avisos = await this.enviarAvisosDeVencimento();
    const vencimentos = await this.processarVencimentos();
    // Depois dos dois, para a lista ja sair com o que acabou de vencer.
    const resumos = await this.enviarResumoParaDonos();

    return {
      avisos_enviados: avisos.enviados,
      renovadas: vencimentos.renovadas,
      canceladas: vencimentos.canceladas,
      em_aberto: vencimentos.emAberto,
      resumos_enviados: resumos.enviados,
      erros: avisos.erros + vencimentos.erros + resumos.erros,
      detalhes: [...avisos.detalhes, ...vencimentos.detalhes, ...resumos.detalhes],
    };
  }
}

export const subscriptionBillingService = new SubscriptionBillingService();

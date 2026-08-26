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

export interface ExecucaoRegua {
  avisos_enviados: number;
  renovadas: number;
  canceladas: number;
  erros: number;
  detalhes: string[];
}

export class SubscriptionBillingService {
  private paymentService = new PaymentService();

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
        status: { in: ['active', 'pending'] },
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
        const resultado = ehCartao(item.paymentMethod)
          ? await notificationService.avisoVencimentoCartao(dados)
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

        if (ehCartao(item.paymentMethod)) {
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

    return { renovadas, canceladas, erros, detalhes };
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

  /** Passada completa da regua. E o que o job periodico chama. */
  async executar(): Promise<ExecucaoRegua> {
    const avisos = await this.enviarAvisosDeVencimento();
    const vencimentos = await this.processarVencimentos();

    return {
      avisos_enviados: avisos.enviados,
      renovadas: vencimentos.renovadas,
      canceladas: vencimentos.canceladas,
      erros: avisos.erros + vencimentos.erros,
      detalhes: [...avisos.detalhes, ...vencimentos.detalhes],
    };
  }
}

export const subscriptionBillingService = new SubscriptionBillingService();

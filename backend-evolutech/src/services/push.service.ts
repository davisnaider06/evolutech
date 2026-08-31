/**
 * Notificacao push para os aparelhos da equipe.
 *
 * Complementa o e-mail, que o dono da barbearia nao le durante o expediente.
 * O push chega no celular na hora, que e onde ele esta.
 *
 * Como o e-mail, o envio degrada em silencio: sem as chaves VAPID o servico
 * apenas registra e devolve, sem derrubar quem chamou. Push e aviso, nunca
 * pode ser o motivo de um agendamento falhar.
 *
 * LIMITE DO IPHONE, que vale repetir porque nao e obvio: no iOS o push so
 * funciona quando o site foi adicionado a tela de inicio e aberto por ali.
 * Em aba do Safari nao existe, e nao ha o que o servidor possa fazer a
 * respeito — quem trata isso e a tela que pede a permissao.
 */
import webpush from 'web-push';
import { prisma } from '../db';

export type PushPayload = {
  title: string;
  body: string;
  /** Para onde levar quando a pessoa toca no aviso. */
  url?: string;
  /** Avisos com a mesma tag se substituem, em vez de empilhar. */
  tag?: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

class PushService {
  private configurado = false;

  /**
   * As chaves so sao lidas no primeiro envio.
   *
   * Ler no import quebraria os testes e qualquer script que carregue o modulo
   * sem as variaveis, que e justamente o cenario em que push nao importa.
   */
  private garantirVapid(): boolean {
    if (this.configurado) return true;

    const publica = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    const privada = String(process.env.VAPID_PRIVATE_KEY || '').trim();
    const assunto = String(process.env.VAPID_SUBJECT || 'mailto:contato@evolutech.digital').trim();

    if (!publica || !privada) return false;

    webpush.setVapidDetails(assunto, publica, privada);
    this.configurado = true;
    return true;
  }

  /** A chave publica que o navegador precisa para se inscrever. */
  get chavePublica(): string | null {
    const publica = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    return publica || null;
  }

  /**
   * Registra o aparelho.
   *
   * Upsert pelo endpoint: reinstalar o app gera endpoint novo (linha nova),
   * mas reabrir o mesmo app devolve o mesmo endpoint — e ai so atualizamos as
   * chaves e o `last_seen_at`, sem duplicar.
   */
  async salvarInscricao(params: {
    userId: string;
    companyId?: string | null;
    subscription: PushSubscriptionInput;
    userAgent?: string | null;
  }) {
    const endpoint = String(params.subscription?.endpoint || '').trim();
    const p256dh = String(params.subscription?.keys?.p256dh || '').trim();
    const auth = String(params.subscription?.keys?.auth || '').trim();

    if (!endpoint || !p256dh || !auth) {
      throw new Error('Inscricao invalida: endpoint, p256dh e auth sao obrigatorios');
    }

    return (prisma as any).pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: params.userId,
        companyId: params.companyId || null,
        endpoint,
        p256dh,
        auth,
        userAgent: params.userAgent ? String(params.userAgent).slice(0, 400) : null,
      },
      update: {
        userId: params.userId,
        companyId: params.companyId || null,
        p256dh,
        auth,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
  }

  async removerInscricao(endpoint: string) {
    const limpo = String(endpoint || '').trim();
    if (!limpo) return { removidas: 0 };
    const r = await (prisma as any).pushSubscription.deleteMany({ where: { endpoint: limpo } });
    return { removidas: r.count };
  }

  /**
   * Envia para todos os aparelhos das pessoas informadas.
   *
   * Nunca lanca: devolve o resumo e registra o que deu errado. Quem chama
   * esta no meio de um agendamento e nao pode quebrar por causa de um aviso.
   */
  async enviarParaUsuarios(userIds: string[], payload: PushPayload) {
    const alvos = Array.from(new Set(userIds.filter(Boolean)));
    if (alvos.length === 0) return { enviados: 0, falhas: 0, removidas: 0 };

    if (!this.garantirVapid()) {
      console.info('[push] ignorado: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY nao configuradas');
      return { enviados: 0, falhas: 0, removidas: 0, skipped: 'sem VAPID' };
    }

    const inscricoes = await (prisma as any).pushSubscription.findMany({
      where: { userId: { in: alvos } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (inscricoes.length === 0) return { enviados: 0, falhas: 0, removidas: 0 };

    const corpo = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      tag: payload.tag || 'evolutech',
    });

    let enviados = 0;
    let falhas = 0;
    const mortas: string[] = [];

    await Promise.all(
      inscricoes.map(async (inscricao: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: inscricao.endpoint,
              keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
            },
            corpo
          );
          enviados += 1;
        } catch (error: any) {
          const status = Number(error?.statusCode || 0);
          // 404/410: o navegador descartou a inscricao (app desinstalado,
          // dados limpos). Nao existe evento para escutar isso — a faxina
          // acontece aqui, no primeiro envio que falha.
          if (status === 404 || status === 410) {
            mortas.push(inscricao.id);
          } else {
            falhas += 1;
            console.warn(`[push] falha ${status || '?'} em ${inscricao.endpoint.slice(0, 60)}...`);
          }
        }
      })
    );

    if (mortas.length > 0) {
      await (prisma as any).pushSubscription.deleteMany({ where: { id: { in: mortas } } });
    }

    return { enviados, falhas, removidas: mortas.length };
  }

  /** Atalho: avisa o dono e, quando houver, o barbeiro envolvido. */
  async enviarParaEquipe(companyId: string, payload: PushPayload, extraUserIds: string[] = []) {
    const donos = await prisma.userRole.findMany({
      where: { companyId, role: 'DONO_EMPRESA' },
      select: { userId: true },
    });
    return this.enviarParaUsuarios(
      [...donos.map((item) => item.userId), ...extraUserIds],
      payload
    );
  }
}

export const pushService = new PushService();

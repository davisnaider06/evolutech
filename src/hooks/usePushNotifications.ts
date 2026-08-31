/**
 * Liga e desliga o push neste aparelho.
 *
 * O caso dificil aqui e o iPhone, e ele merece explicacao porque a interface
 * precisa contar a verdade para o usuario:
 *
 * - No iOS, push existe so a partir do 16.4 e SO quando o site foi adicionado
 *   a tela de inicio e aberto por ali. Em aba do Safari o `PushManager` nem
 *   aparece — nao ha permissao a pedir, nao ha o que negociar.
 * - Por isso `estado` distingue 'sem-suporte' de 'precisa-instalar': a
 *   primeira e um beco sem saida, a segunda tem solucao e a tela deve ensinar
 *   o caminho (Compartilhar > Adicionar a Tela de Inicio).
 *
 * A permissao tambem precisa sair de um toque do usuario. Por isso nada aqui
 * pede permissao sozinho no carregamento: quem chama `ativar` e um botao.
 */
import { useCallback, useEffect, useState } from 'react';
import { companyService } from '@/services/company';

export type EstadoPush =
  /** Navegador nao tem Push API e nao ha caminho. */
  | 'sem-suporte'
  /** iPhone em aba do Safari: instalar na tela de inicio resolve. */
  | 'precisa-instalar'
  /** Da para ligar, ainda nao ligou. */
  | 'disponivel'
  /** Ligado neste aparelho. */
  | 'ativo'
  /** Usuario negou. So ele reverte, nas configuracoes do navegador. */
  | 'negado'
  | 'carregando';

const ehIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS moderno se anuncia como Mac; o toque desempata.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Aberto pela tela de inicio, e nao numa aba do navegador. */
export const estaInstalado = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true);

const suportaPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** A chave VAPID vem em base64url e a API exige Uint8Array. */
function base64ParaUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(normalizado);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) saida[i] = bruto.charCodeAt(i);
  return saida;
}

export const usePushNotifications = () => {
  const [estado, setEstado] = useState<EstadoPush>('carregando');
  const [ocupado, setOcupado] = useState(false);

  const avaliar = useCallback(async () => {
    if (!suportaPush()) {
      // No iPhone fora da tela de inicio a falta de suporte tem conserto.
      setEstado(ehIOS() && !estaInstalado() ? 'precisa-instalar' : 'sem-suporte');
      return;
    }

    if (Notification.permission === 'denied') {
      setEstado('negado');
      return;
    }

    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      setEstado(inscricao ? 'ativo' : 'disponivel');
    } catch (_erro) {
      setEstado('disponivel');
    }
  }, []);

  useEffect(() => {
    avaliar();
  }, [avaliar]);

  const ativar = useCallback(async () => {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'negado' : 'disponivel');
        return { ok: false, motivo: 'permissao-negada' as const };
      }

      const { public_key: chave } = await companyService.getPushPublicKey();
      const registro = await navigator.serviceWorker.ready;

      // Uma inscricao por aparelho: se ja existir, reaproveita em vez de
      // criar outra, senao o mesmo celular receberia o aviso duas vezes.
      const existente = await registro.pushManager.getSubscription();
      const inscricao =
        existente ||
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaUint8Array(chave),
        }));

      await companyService.subscribePush(inscricao.toJSON());
      setEstado('ativo');
      return { ok: true as const };
    } catch (erro: any) {
      return { ok: false as const, motivo: String(erro?.message || 'falhou') };
    } finally {
      setOcupado(false);
    }
  }, []);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      if (inscricao) {
        // Servidor primeiro: se cair a rede depois do unsubscribe local, o
        // backend ficaria mandando push para um endpoint que nao existe mais.
        await companyService.unsubscribePush(inscricao.endpoint).catch(() => undefined);
        await inscricao.unsubscribe();
      }
      setEstado('disponivel');
      return { ok: true as const };
    } catch (erro: any) {
      return { ok: false as const, motivo: String(erro?.message || 'falhou') };
    } finally {
      setOcupado(false);
    }
  }, []);

  const testar = useCallback(() => companyService.sendPushTest(), []);

  return { estado, ocupado, ativar, desativar, testar, reavaliar: avaliar, ehIOS: ehIOS() };
};

/**
 * Cartao que liga o push neste aparelho.
 *
 * Ele existe porque push nao e uma coisa que se ativa no servidor: cada
 * celular precisa se inscrever, com um toque, uma vez. E porque o iPhone tem
 * um pre-requisito que ninguem adivinha sozinho — o app precisa estar na tela
 * de inicio. Quando esse e o caso, o cartao ensina o caminho em vez de so
 * dizer que nao da.
 *
 * Some da tela quando ja esta ligado e o usuario nao esta mexendo nisso: o
 * lugar de desligar e Configuracoes, nao a tela de trabalho.
 */
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Share, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const AtivarNotificacoes: React.FC<{ mostrarQuandoAtivo?: boolean }> = ({
  mostrarQuandoAtivo = false,
}) => {
  const { estado, ocupado, ativar, desativar, testar, ehIOS } = usePushNotifications();

  if (estado === 'carregando') return null;
  if (estado === 'ativo' && !mostrarQuandoAtivo) return null;
  // Navegador sem Push e sem saida: nao ha o que oferecer, e um cartao que so
  // informa impossibilidade e ruido na tela de trabalho.
  if (estado === 'sem-suporte' && !mostrarQuandoAtivo) return null;

  const handleAtivar = async () => {
    const resultado = await ativar();
    if (resultado.ok) {
      toast.success('Notificações ligadas neste aparelho');
      await testar().catch(() => undefined);
      return;
    }
    if (resultado.motivo === 'permissao-negada') {
      toast.error('Permissão negada. Libere nas configurações do navegador.');
      return;
    }
    toast.error('Não deu para ligar agora. Tente de novo.');
  };

  if (estado === 'precisa-instalar') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" />
            Instale o app para receber avisos
          </CardTitle>
          <CardDescription>
            No iPhone, notificação só funciona com o app na tela de início — pelo navegador
            não é possível.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            Toque em <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong> e
            depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
          <p className="mt-2">Abra o app pelo ícone e volte aqui para ligar os avisos.</p>
        </CardContent>
      </Card>
    );
  }

  if (estado === 'negado') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4" />
            Notificações bloqueadas
          </CardTitle>
          <CardDescription>
            Você negou a permissão neste aparelho. Só dá para reverter nas configurações do
            {ehIOS ? ' iPhone (Ajustes > Notificações)' : ' navegador'}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (estado === 'sem-suporte') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4" />
            Sem notificações neste aparelho
          </CardTitle>
          <CardDescription>
            Este navegador não tem suporte a push. As pendências continuam aparecendo ao abrir
            o app.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={estado === 'ativo' ? '' : 'border-primary/40 bg-primary/5'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          {estado === 'ativo' ? 'Notificações ligadas' : 'Receba avisos no celular'}
        </CardTitle>
        <CardDescription>
          {estado === 'ativo'
            ? 'Este aparelho recebe aviso de agendamento novo.'
            : 'Agendamento novo chega na hora, sem precisar abrir o app.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {estado === 'ativo' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => testar()} disabled={ocupado}>
              Enviar teste
            </Button>
            <Button variant="ghost" size="sm" onClick={desativar} disabled={ocupado}>
              Desligar neste aparelho
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleAtivar} disabled={ocupado}>
            {ocupado ? 'Ligando...' : 'Ligar notificações'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

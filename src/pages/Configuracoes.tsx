import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { companyService } from '@/services/company';
import { Shield, Save, RefreshCw, Bell, User } from 'lucide-react';

const Configuracoes: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const isOwner = user?.role === 'DONO_EMPRESA';

  // Perfil proprio. Vale para qualquer papel: o barbeiro corrige o proprio
  // nome sem depender do dono. Antes estes dois campos eram so leitura.
  const [perfil, setPerfil] = useState({ name: '', email: '' });
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Telefone que recebe o resumo diario de mensalidades a receber.
  // Sem ele o dono ainda recebe por e-mail e pelo painel de Assinaturas;
  // com ele, o resumo tambem chega no WhatsApp.
  const [notificationPhone, setNotificationPhone] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // O /auth/me pode chegar depois da primeira renderizacao; sem isto o
  // formulario nasceria vazio e um "Salvar" apagaria o nome no banco.
  useEffect(() => {
    setPerfil({ name: user?.name || '', email: user?.email || '' });
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (!isOwner) {
      setLoadingSettings(false);
      return;
    }
    let ativo = true;
    companyService
      .getMyCompanySettings()
      .then((dados: any) => {
        if (ativo) setNotificationPhone(dados?.notification_phone || '');
      })
      .catch(() => {
        // Falha aqui nao impede o resto da tela: o campo fica vazio.
      })
      .finally(() => {
        if (ativo) setLoadingSettings(false);
      });
    return () => {
      ativo = false;
    };
  }, [isOwner]);

  const perfilAlterado =
    perfil.name.trim() !== (user?.name || '') || perfil.email.trim() !== (user?.email || '');

  const handleSavePerfil = async () => {
    const nome = perfil.name.trim();
    const email = perfil.email.trim();

    if (nome.length < 2) {
      toast.error('Informe seu nome completo');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Informe um e-mail valido');
      return;
    }

    const trocouEmail = email.toLowerCase() !== (user?.email || '').toLowerCase();

    setSavingPerfil(true);
    try {
      const token = localStorage.getItem('evolutech_token');
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nome, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel salvar o perfil');
      }

      // Recarrega a sessao para o nome novo aparecer no menu na hora.
      await refreshUser();
      toast.success(
        trocouEmail
          ? 'Perfil salvo. A partir de agora entre com o novo e-mail.'
          : 'Perfil salvo'
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar o perfil');
    } finally {
      setSavingPerfil(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const salvo: any = await companyService.updateMyCompanySettings({
        notification_phone: notificationPhone.trim(),
      });
      setNotificationPhone(salvo?.notification_phone || '');
      toast.success(
        salvo?.notification_phone
          ? 'Telefone salvo. O resumo de mensalidades passa a chegar no WhatsApp.'
          : 'Telefone removido. O resumo continua por e-mail e no painel de Assinaturas.'
      );
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar o telefone');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!isOwner) {
      toast.error('Somente DONO_EMPRESA pode alterar senha nesta tela');
      return;
    }
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      toast.error('Preencha todos os campos de senha');
      return;
    }
    if (form.new_password.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error('A confirmacao da nova senha nao confere');
      return;
    }

    setSavingPassword(true);
    try {
      const token = localStorage.getItem('evolutech_token');
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: form.current_password,
          new_password: form.new_password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel alterar a senha');
      }

      setForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Senha alterada com sucesso');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Configuracoes</h1>
        <p className="text-muted-foreground">Gerencie suas configuracoes de conta.</p>
      </div>

      <div className="glass rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Meu perfil</h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Como seu nome aparece no sistema e para os clientes, e o e-mail que voce usa
          para entrar.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={perfil.name}
              onChange={(e) => setPerfil((old) => ({ ...old, name: e.target.value }))}
              placeholder="Seu nome completo"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={perfil.email}
              onChange={(e) => setPerfil((old) => ({ ...old, email: e.target.value }))}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Este e o e-mail de login. Se mudar, use o novo no proximo acesso.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSavePerfil}
            disabled={savingPerfil || !perfilAlterado}
            className="w-full gap-2 sm:w-auto"
          >
            {savingPerfil ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingPerfil ? 'Salvando...' : 'Salvar perfil'}
          </Button>
        </div>
      </div>

      {isOwner && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Avisos de mensalidade</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Todo dia o sistema manda a lista de quem vence em breve e de quem ja venceu e
            aguarda voce confirmar o recebimento. O resumo sempre chega no seu e-mail e no
            painel de Assinaturas; informe um WhatsApp para receber tambem por la.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="notification_phone">WhatsApp para o resumo</Label>
              <Input
                id="notification_phone"
                value={notificationPhone}
                onChange={(e) => setNotificationPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                disabled={loadingSettings}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para nao receber por WhatsApp.
              </p>
            </div>
            <Button onClick={handleSaveSettings} disabled={savingSettings || loadingSettings}>
              {savingSettings ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Seguranca</h2>
        </div>

        {!isOwner ? (
          <p className="text-sm text-muted-foreground">
            Alteracao de senha por esta tela disponivel apenas para DONO_EMPRESA.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={form.current_password}
                onChange={(e) => setForm((old) => ({ ...old, current_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={form.new_password}
                onChange={(e) => setForm((old) => ({ ...old, new_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm((old) => ({ ...old, confirm_password: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPassword} className="gap-2">
                {savingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingPassword ? 'Salvando...' : 'Alterar senha'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuracoes;

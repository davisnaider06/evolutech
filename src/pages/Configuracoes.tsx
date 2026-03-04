import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { Settings, Shield, Save, RefreshCw } from 'lucide-react';

const Configuracoes: React.FC = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'DONO_EMPRESA';
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

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

      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Perfil</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" defaultValue={user?.name} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user?.email} disabled />
          </div>
        </div>
      </div>

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

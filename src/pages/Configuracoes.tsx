import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  Mail,
  Save,
} from 'lucide-react';

const Configuracoes: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta e preferências
        </p>
      </div>

      {/* Profile Settings */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Perfil</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" defaultValue={user?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user?.email} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Notificações</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações por Email</p>
              <p className="text-sm text-muted-foreground">Receba atualizações importantes por email</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações Push</p>
              <p className="text-sm text-muted-foreground">Receba notificações no navegador</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Alertas de Segurança</p>
              <p className="text-sm text-muted-foreground">Seja notificado sobre atividades suspeitas</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Segurança</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Autenticação em Duas Etapas</p>
              <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
            </div>
            <Button variant="outline" size="sm">Configurar</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Alterar Senha</p>
              <p className="text-sm text-muted-foreground">Atualize sua senha regularmente</p>
            </div>
            <Button variant="outline" size="sm">Alterar</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sessões Ativas</p>
              <p className="text-sm text-muted-foreground">Gerencie seus dispositivos conectados</p>
            </div>
            <Button variant="outline" size="sm">Ver Sessões</Button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Aparência</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Tema Escuro</p>
              <p className="text-sm text-muted-foreground">Interface com cores escuras</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Animações</p>
              <p className="text-sm text-muted-foreground">Ativar animações da interface</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;

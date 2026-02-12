import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Building2,
  Shield,
  Eye,
  EyeOff,
  Settings,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface PaymentGateway {
  id: string;
  empresa_id: string;
  provedor: string;
  nome_exibicao: string;
  public_key: string | null;
  secret_key_encrypted: string | null;
  ambiente: string;
  is_active: boolean;
  webhook_url: string | null;
  configuracoes: unknown;
  created_at: string;
  updated_at: string;
  company?: {
    name: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
}

const PROVEDORES = [
  { value: 'stripe', label: 'Stripe', icon: '💳', description: 'Pagamentos internacionais e cartões' },
  { value: 'mercadopago', label: 'Mercado Pago', icon: '🟡', description: 'Líder na América Latina' },
  { value: 'pagseguro', label: 'PagSeguro', icon: '🟢', description: 'Gateway tradicional brasileiro' },
  { value: 'pagbank', label: 'PagBank', icon: '🔵', description: 'Banco digital + gateway' },
  { value: 'asaas', label: 'Asaas', icon: '⚫', description: 'Cobranças e assinaturas' },
  { value: 'pix', label: 'PIX Direto', icon: '💚', description: 'Pagamentos instantâneos' },
  { value: 'pagarme', label: 'Pagar.me', icon: '🟣', description: 'API moderna e flexível' },
  { value: 'cielo', label: 'Cielo', icon: '🔷', description: 'Maior adquirente do Brasil' },
  { value: 'rede', label: 'Rede (Itaú)', icon: '🟠', description: 'Gateway do Itaú Unibanco' },
  { value: 'getnet', label: 'Getnet (Santander)', icon: '🔴', description: 'Gateway do Santander' },
  { value: 'infinitepay', label: 'InfinitePay', icon: '🟢', description: 'Taxas competitivas' },
  { value: 'iugu', label: 'Iugu', icon: '🟡', description: 'Gestão financeira completa' },
  { value: 'juno', label: 'Juno', icon: '🟢', description: 'Boletos e cartões' },
  { value: 'efi', label: 'Efí (Gerencianet)', icon: '💙', description: 'PIX e boletos' },
  { value: 'paypal', label: 'PayPal', icon: '🅿️', description: 'Pagamentos globais' },
  { value: 'outro', label: 'Outro', icon: '⚙️', description: 'Gateway personalizado' },
];

const GatewaysPagamento: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { logAudit } = useAuditLog();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({
    empresa_id: '',
    provedor: 'stripe',
    nome_exibicao: '',
    public_key: '',
    secret_key: '',
    ambiente: 'sandbox',
    webhook_url: '',
  });

  const isSuperAdmin = hasPermission(['SUPER_ADMIN_EVOLUTECH']);

  useEffect(() => {
    fetchGateways();
    fetchCompanies();
  }, []);

  const fetchGateways = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGateways(data || []);
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast.error('Erro ao carregar gateways');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCreateGateway = async () => {
    if (!formData.empresa_id || !formData.nome_exibicao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('payment_gateways')
        .insert({
          empresa_id: formData.empresa_id,
          provedor: formData.provedor,
          nome_exibicao: formData.nome_exibicao,
          public_key: formData.public_key || null,
          secret_key_encrypted: formData.secret_key || null,
          ambiente: formData.ambiente,
          webhook_url: formData.webhook_url || null,
          is_active: false,
        });

      if (error) throw error;

      await logAudit({
        action: 'create',
        entityType: 'payment_gateway',
        companyId: formData.empresa_id,
        details: { provedor: formData.provedor },
      });

      toast.success('Gateway criado com sucesso!');
      setIsDialogOpen(false);
      setFormData({
        empresa_id: '',
        provedor: 'stripe',
        nome_exibicao: '',
        public_key: '',
        secret_key: '',
        ambiente: 'sandbox',
        webhook_url: '',
      });
      fetchGateways();
    } catch (error: any) {
      console.error('Error creating gateway:', error);
      if (error.code === '23505') {
        toast.error('Esta empresa já possui um gateway deste provedor');
      } else {
        toast.error('Erro ao criar gateway');
      }
    }
  };

  const handleToggleActive = async (gateway: PaymentGateway) => {
    if (!isSuperAdmin) {
      toast.error('Apenas Super Admin pode ativar/desativar gateways');
      return;
    }

    try {
      const { error } = await supabase
        .from('payment_gateways')
        .update({ is_active: !gateway.is_active })
        .eq('id', gateway.id);

      if (error) throw error;

      await logAudit({
        action: gateway.is_active ? 'deactivate' : 'activate',
        entityType: 'payment_gateway',
        entityId: gateway.id,
        companyId: gateway.empresa_id,
        details: { provedor: gateway.provedor },
      });

      toast.success(gateway.is_active ? 'Gateway desativado' : 'Gateway ativado');
      fetchGateways();
    } catch (error) {
      console.error('Error toggling gateway:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDeleteGateway = async (gateway: PaymentGateway) => {
    if (!isSuperAdmin) {
      toast.error('Apenas Super Admin pode excluir gateways');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este gateway?')) return;

    try {
      const { error } = await supabase
        .from('payment_gateways')
        .delete()
        .eq('id', gateway.id);

      if (error) throw error;

      await logAudit({
        action: 'delete',
        entityType: 'payment_gateway',
        entityId: gateway.id,
        companyId: gateway.empresa_id,
        details: { provedor: gateway.provedor },
      });

      toast.success('Gateway excluído');
      fetchGateways();
    } catch (error) {
      console.error('Error deleting gateway:', error);
      toast.error('Erro ao excluir gateway');
    }
  };

  const filteredGateways = gateways.filter(g => 
    g.nome_exibicao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.provedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProvedorInfo = (provedor: string) => 
    PROVEDORES.find(p => p.value === provedor) || PROVEDORES[5];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary" />
            Gateways de Pagamento
          </h1>
          <p className="text-muted-foreground">
            Configure os gateways de pagamento por empresa
          </p>
        </div>
        
        {isSuperAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="glow" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Gateway
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Configurar Gateway de Pagamento</DialogTitle>
                <DialogDescription>
                  Configure as credenciais do gateway para uma empresa
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Select
                    value={formData.empresa_id}
                    onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Provedor *</Label>
                  <Select
                    value={formData.provedor}
                    onValueChange={(value) => setFormData({ ...formData, provedor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVEDORES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.icon} {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome de Exibição *</Label>
                  <Input
                    value={formData.nome_exibicao}
                    onChange={(e) => setFormData({ ...formData, nome_exibicao: e.target.value })}
                    placeholder="Ex: Stripe - Empresa XYZ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Public Key</Label>
                    <Input
                      value={formData.public_key}
                      onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                      placeholder="pk_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secret Key</Label>
                    <Input
                      type="password"
                      value={formData.secret_key}
                      onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                      placeholder="sk_..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select
                    value={formData.ambiente}
                    onValueChange={(value) => setFormData({ ...formData, ambiente: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">🧪 Sandbox (Testes)</SelectItem>
                      <SelectItem value="producao">🚀 Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateGateway}>
                  Criar Gateway
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar gateways..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Security Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-4">
          <Shield className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            As chaves secretas são armazenadas de forma criptografada. 
            Apenas Super Admins podem visualizar e gerenciar credenciais.
          </p>
        </CardContent>
      </Card>

      {/* Gateways Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredGateways.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum gateway configurado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGateways.map((gateway) => {
            const provedor = getProvedorInfo(gateway.provedor);
            const showSecret = showSecrets[gateway.id];

            return (
              <Card key={gateway.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 ${gateway.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provedor.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{gateway.nome_exibicao}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {gateway.company?.name || 'Empresa'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={gateway.is_active ? 'default' : 'secondary'}>
                      {gateway.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{provedor.label}</Badge>
                    <Badge variant={gateway.ambiente === 'producao' ? 'default' : 'secondary'}>
                      {gateway.ambiente === 'producao' ? '🚀 Produção' : '🧪 Sandbox'}
                    </Badge>
                  </div>

                  {isSuperAdmin && gateway.public_key && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Public Key:</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                        {gateway.public_key}
                      </code>
                    </div>
                  )}

                  {isSuperAdmin && gateway.secret_key_encrypted && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Secret Key:</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowSecrets({ ...showSecrets, [gateway.id]: !showSecret })}
                        >
                          {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                        {showSecret ? gateway.secret_key_encrypted : '••••••••••••'}
                      </code>
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={gateway.is_active}
                          onCheckedChange={() => handleToggleActive(gateway)}
                        />
                        <span className="text-sm">
                          {gateway.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteGateway(gateway)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GatewaysPagamento;

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Users,
  Building2,
  Blocks,
  Package,
  CreditCard,
  Shield,
  Loader2,
  Play,
  FileCheck,
} from 'lucide-react';

interface VerificationResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'pending';
  message: string;
  details?: string;
}

interface VerificationCategory {
  name: string;
  icon: React.ReactNode;
  checks: VerificationResult[];
}

const SystemVerification: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<VerificationCategory[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runVerification = async () => {
    setIsRunning(true);
    setProgress(0);
    const results: VerificationCategory[] = [];

    try {
      // 1. Database Connection Check
      setProgress(10);
      const dbChecks: VerificationResult[] = [];
      
      const { error: dbError } = await supabase.from('companies').select('count').limit(1);
      dbChecks.push({
        name: 'Conexão com Banco de Dados',
        status: dbError ? 'error' : 'success',
        message: dbError ? 'Falha na conexão' : 'Conexão estabelecida',
        details: dbError?.message,
      });

      results.push({
        name: 'Banco de Dados',
        icon: <Database className="h-5 w-5" />,
        checks: dbChecks,
      });

      // 2. Companies Check
      setProgress(25);
      const companyChecks: VerificationResult[] = [];
      
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, status, sistema_base_id');
      
      companyChecks.push({
        name: 'Empresas Cadastradas',
        status: companiesError ? 'error' : 'success',
        message: companiesError ? 'Erro ao buscar empresas' : `${companies?.length || 0} empresas encontradas`,
      });

      const activeCompanies = companies?.filter(c => c.status === 'active') || [];
      companyChecks.push({
        name: 'Empresas Ativas',
        status: activeCompanies.length > 0 ? 'success' : 'warning',
        message: `${activeCompanies.length} empresas ativas`,
      });

      const companiesWithTemplate = companies?.filter(c => c.sistema_base_id) || [];
      companyChecks.push({
        name: 'Templates Vinculados',
        status: companiesWithTemplate.length === companies?.length ? 'success' : 'warning',
        message: `${companiesWithTemplate.length}/${companies?.length || 0} com template`,
        details: companiesWithTemplate.length < (companies?.length || 0) 
          ? 'Algumas empresas não possuem template vinculado' 
          : undefined,
      });

      results.push({
        name: 'Empresas',
        icon: <Building2 className="h-5 w-5" />,
        checks: companyChecks,
      });

      // 3. Users & Roles Check
      setProgress(40);
      const userChecks: VerificationResult[] = [];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, company_id, is_active');
      
      userChecks.push({
        name: 'Usuários Cadastrados',
        status: profilesError ? 'error' : 'success',
        message: profilesError ? 'Erro ao buscar usuários' : `${profiles?.length || 0} usuários`,
      });

      const { data: roles } = await supabase.from('user_roles').select('role, user_id');
      const superAdmins = roles?.filter(r => r.role === 'super_admin_evolutech') || [];
      
      userChecks.push({
        name: 'Super Admins',
        status: superAdmins.length > 0 ? 'success' : 'error',
        message: `${superAdmins.length} super admin(s)`,
        details: superAdmins.length === 0 ? 'CRÍTICO: Nenhum super admin encontrado!' : undefined,
      });

      const usersWithCompany = profiles?.filter(p => p.company_id) || [];
      userChecks.push({
        name: 'Usuários com Empresa',
        status: 'success',
        message: `${usersWithCompany.length} usuários vinculados a empresas`,
      });

      results.push({
        name: 'Usuários e Permissões',
        icon: <Users className="h-5 w-5" />,
        checks: userChecks,
      });

      // 4. Templates & Modules Check
      setProgress(55);
      const templateChecks: VerificationResult[] = [];
      
      const { data: templates, error: templatesError } = await supabase
        .from('sistemas_base')
        .select('id, nome, status');
      
      templateChecks.push({
        name: 'Templates Disponíveis',
        status: templatesError ? 'error' : templates && templates.length > 0 ? 'success' : 'warning',
        message: templatesError ? 'Erro ao buscar templates' : `${templates?.length || 0} templates`,
      });

      const { data: modules } = await supabase.from('modulos').select('id, nome, status');
      const activeModules = modules?.filter(m => m.status === 'active') || [];
      
      templateChecks.push({
        name: 'Módulos Disponíveis',
        status: activeModules.length > 0 ? 'success' : 'warning',
        message: `${activeModules.length} módulos disponíveis para uso`,
      });

      const { data: templateModules } = await supabase
        .from('sistema_base_modulos')
        .select('sistema_base_id, modulo_id');
      
      templateChecks.push({
        name: 'Vinculações Template-Módulo',
        status: (templateModules?.length || 0) > 0 ? 'success' : 'warning',
        message: `${templateModules?.length || 0} vinculações configuradas`,
      });

      results.push({
        name: 'Templates e Módulos',
        icon: <Blocks className="h-5 w-5" />,
        checks: templateChecks,
      });

      // 5. Company Modules Sync Check
      setProgress(70);
      const syncChecks: VerificationResult[] = [];
      
      const { data: empresaModulos } = await supabase
        .from('empresa_modulos')
        .select('empresa_id, modulo_id, ativo');
      
      const companiesWithModules = [...new Set(empresaModulos?.map(em => em.empresa_id) || [])];
      
      syncChecks.push({
        name: 'Empresas com Módulos',
        status: companiesWithModules.length > 0 ? 'success' : 'warning',
        message: `${companiesWithModules.length} empresas têm módulos configurados`,
      });

      const activeEmpresaModulos = empresaModulos?.filter(em => em.ativo) || [];
      syncChecks.push({
        name: 'Módulos Ativos por Empresa',
        status: activeEmpresaModulos.length > 0 ? 'success' : 'warning',
        message: `${activeEmpresaModulos.length} módulos ativos no total`,
      });

      // Check if all companies have modules
      const companiesWithoutModules = (companies || []).filter(
        c => !companiesWithModules.includes(c.id)
      );
      syncChecks.push({
        name: 'Sincronização Completa',
        status: companiesWithoutModules.length === 0 ? 'success' : 'warning',
        message: companiesWithoutModules.length === 0 
          ? 'Todas as empresas têm módulos' 
          : `${companiesWithoutModules.length} empresa(s) sem módulos`,
        details: companiesWithoutModules.length > 0 
          ? companiesWithoutModules.map(c => c.name).join(', ')
          : undefined,
      });

      results.push({
        name: 'Sincronização de Módulos',
        icon: <Package className="h-5 w-5" />,
        checks: syncChecks,
      });

      // 6. Payment Gateways Check
      setProgress(85);
      const gatewayChecks: VerificationResult[] = [];
      
      const { data: gateways } = await supabase
        .from('payment_gateways')
        .select('id, provedor, is_active, ambiente');
      
      gatewayChecks.push({
        name: 'Gateways Configurados',
        status: (gateways?.length || 0) > 0 ? 'success' : 'warning',
        message: `${gateways?.length || 0} gateway(s) configurado(s)`,
      });

      const activeGateways = gateways?.filter(g => g.is_active) || [];
      const prodGateways = gateways?.filter(g => g.ambiente === 'producao') || [];
      
      gatewayChecks.push({
        name: 'Gateways Ativos',
        status: activeGateways.length > 0 ? 'success' : 'warning',
        message: `${activeGateways.length} ativo(s), ${prodGateways.length} em produção`,
      });

      results.push({
        name: 'Gateways de Pagamento',
        icon: <CreditCard className="h-5 w-5" />,
        checks: gatewayChecks,
      });

      // 7. Security & Auth Check
      setProgress(95);
      const securityChecks: VerificationResult[] = [];
      
      const { data: invitations } = await supabase
        .from('invitations')
        .select('id, status, expires_at');
      
      const pendingInvites = invitations?.filter(i => i.status === 'pending') || [];
      const expiredInvites = pendingInvites.filter(i => new Date(i.expires_at) < new Date());
      
      securityChecks.push({
        name: 'Convites Pendentes',
        status: expiredInvites.length > 0 ? 'warning' : 'success',
        message: `${pendingInvites.length} pendente(s), ${expiredInvites.length} expirado(s)`,
      });

      const { data: themes } = await supabase.from('company_themes').select('company_id');
      securityChecks.push({
        name: 'Temas White-Label',
        status: (themes?.length || 0) > 0 ? 'success' : 'warning',
        message: `${themes?.length || 0} tema(s) configurado(s)`,
      });

      results.push({
        name: 'Segurança e Configurações',
        icon: <Shield className="h-5 w-5" />,
        checks: securityChecks,
      });

      setProgress(100);
      setCategories(results);
      setLastRun(new Date());
      toast.success('Verificação concluída!');
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Erro durante a verificação');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTotalStats = () => {
    const allChecks = categories.flatMap(c => c.checks);
    return {
      total: allChecks.length,
      success: allChecks.filter(c => c.status === 'success').length,
      warning: allChecks.filter(c => c.status === 'warning').length,
      error: allChecks.filter(c => c.status === 'error').length,
    };
  };

  const stats = getTotalStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <FileCheck className="h-8 w-8 text-primary" />
            Verificação do Sistema
          </h1>
          <p className="text-muted-foreground">
            Diagnóstico completo de todas as funcionalidades
          </p>
        </div>
        
        <Button 
          variant="glow" 
          className="gap-2" 
          onClick={runVerification}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Executar Verificação
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {isRunning && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {categories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Verificações</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.success}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
                <p className="text-xs text-muted-foreground">Avisos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.error}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {categories.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {category.icon}
                  {category.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.checks.map((check, index) => (
                  <div key={index}>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(check.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{check.name}</p>
                          <Badge variant="outline" className={getStatusColor(check.status)}>
                            {check.status === 'success' ? 'OK' : check.status === 'warning' ? 'Aviso' : 'Erro'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{check.message}</p>
                        {check.details && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">{check.details}</p>
                        )}
                      </div>
                    </div>
                    {index < category.checks.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Clique em "Executar Verificação" para iniciar o diagnóstico do sistema
            </p>
          </CardContent>
        </Card>
      )}

      {/* Last Run Info */}
      {lastRun && (
        <p className="text-xs text-muted-foreground text-center">
          Última verificação: {lastRun.toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
};

export default SystemVerification;

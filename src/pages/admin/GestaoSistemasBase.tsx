import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Blocks, 
  Package, 
  Settings2, 
  Save,
  CheckCircle,
  Sparkles,
  Calendar,
  UtensilsCrossed,
  Briefcase,
  GraduationCap,
  Layers,
  AlertTriangle,
  Stethoscope,
  Scissors,
  Dumbbell,
  Car,
  Building2,
  Church,
  Heart,
  Scale,
  MessageSquare,
  Copy,
  Search,
  Library,
} from 'lucide-react';

interface SistemaBase {
  id: string;
  nome: string;
  descricao: string | null;
  nicho: string;
  versao: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface Modulo {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  is_core: boolean;
  preco_mensal: number;
  status: 'active' | 'inactive' | 'pending';
}

interface SistemaModulo {
  modulo_id: string;
  is_default: boolean;
}

// Tipos de sistema com configurações padrão - 25+ nichos
type TipoSistema = 
  | 'Clínicas Médicas' | 'Clínicas Odontológicas' | 'Psicólogos/Terapeutas'
  | 'Salões de Beleza' | 'Barbearias' | 'Estúdios de Estética'
  | 'Academias' | 'Personal Trainers'
  | 'Escolas' | 'Cursos Profissionalizantes' | 'Plataforma EAD'
  | 'Restaurantes' | 'Pizzarias' | 'Lanchonetes' | 'Delivery'
  | 'Oficinas Mecânicas' | 'Lava-Jato'
  | 'Imobiliárias' | 'Corretores Autônomos'
  | 'Igrejas' | 'Associações/ONGs'
  | 'Escritórios Contábeis' | 'Escritórios Advocacia'
  | 'Serviços Gerais' | 'Prestadores Autônomos'
  | 'Genérico';

interface TipoSistemaConfig {
  icon: React.ReactNode;
  descricao: string;
  coreModulos: string[];
  opcionaisModulos: string[];
  color: string;
  categoria: string;
}

const TIPOS_SISTEMA: Record<TipoSistema, TipoSistemaConfig> = {
  // SAÚDE
  'Clínicas Médicas': {
    icon: <Stethoscope className="h-5 w-5" />,
    descricao: 'Sistema completo para clínicas médicas com agendamentos, prontuário eletrônico e financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'pagamentos', 'relatorios_avancados'],
    color: 'bg-emerald-500',
    categoria: 'Saúde',
  },
  'Clínicas Odontológicas': {
    icon: <Stethoscope className="h-5 w-5" />,
    descricao: 'Gestão de consultórios odontológicos com odontograma, tratamentos e agendamentos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'pagamentos', 'estoque'],
    color: 'bg-emerald-500',
    categoria: 'Saúde',
  },
  'Psicólogos/Terapeutas': {
    icon: <Heart className="h-5 w-5" />,
    descricao: 'Gestão de consultórios de saúde mental com prontuário, sessões e evolução do paciente.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-pink-500',
    categoria: 'Saúde',
  },
  // BELEZA
  'Salões de Beleza': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'Agendamentos, controle de profissionais, comissões e fidelização de clientes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-pink-400',
    categoria: 'Beleza',
  },
  'Barbearias': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'Gestão de barbearias com agendamentos online, filas e pagamentos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'pagamentos'],
    color: 'bg-slate-600',
    categoria: 'Beleza',
  },
  'Estúdios de Estética': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'Controle de procedimentos, pacotes e acompanhamento de tratamentos estéticos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-purple-400',
    categoria: 'Beleza',
  },
  // FITNESS
  'Academias': {
    icon: <Dumbbell className="h-5 w-5" />,
    descricao: 'Gestão completa de academia com matrículas, treinos, check-in e mensalidades.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca', 'treinos'],
    opcionaisModulos: ['assinaturas', 'avaliacao_fisica', 'pagamentos', 'financeiro'],
    color: 'bg-orange-500',
    categoria: 'Fitness',
  },
  'Personal Trainers': {
    icon: <Dumbbell className="h-5 w-5" />,
    descricao: 'Gestão de alunos, treinos personalizados, agendamentos e evolução.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'treinos'],
    opcionaisModulos: ['avaliacao_fisica', 'assinaturas', 'pagamentos'],
    color: 'bg-orange-600',
    categoria: 'Fitness',
  },
  // EDUCAÇÃO
  'Escolas': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'Gestão escolar com matrículas, turmas, frequência e comunicação com pais.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca'],
    opcionaisModulos: ['financeiro', 'documentos', 'relatorios_avancados'],
    color: 'bg-blue-500',
    categoria: 'Educação',
  },
  'Cursos Profissionalizantes': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'Gestão de cursos livres com turmas, certificados e controle financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca'],
    opcionaisModulos: ['certificados', 'financeiro', 'pagamentos'],
    color: 'bg-blue-600',
    categoria: 'Educação',
  },
  'Plataforma EAD': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'Plataforma de cursos online com vídeos, materiais, provas e certificados.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cursos_online'],
    opcionaisModulos: ['certificados', 'assinaturas', 'pagamentos'],
    color: 'bg-indigo-500',
    categoria: 'Educação',
  },
  // FOOD SERVICE
  'Restaurantes': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Gestão completa de restaurante com mesas, comandas, cardápio e caixa.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas'],
    opcionaisModulos: ['reservas', 'estoque', 'financeiro', 'delivery'],
    color: 'bg-amber-500',
    categoria: 'Food Service',
  },
  'Pizzarias': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Gestão de pizzaria com pedidos, delivery e controle de produção.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas', 'delivery'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-red-500',
    categoria: 'Food Service',
  },
  'Lanchonetes': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Sistema simples para lanchonetes com pedidos rápidos e controle de caixa.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-yellow-500',
    categoria: 'Food Service',
  },
  'Delivery': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Plataforma de delivery com app, rastreamento e gestão de entregadores.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'delivery'],
    opcionaisModulos: ['pagamentos', 'financeiro'],
    color: 'bg-green-500',
    categoria: 'Food Service',
  },
  // AUTOMOTIVO
  'Oficinas Mecânicas': {
    icon: <Car className="h-5 w-5" />,
    descricao: 'Gestão de oficina com OS, peças, orçamentos e controle de serviços.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-slate-500',
    categoria: 'Automotivo',
  },
  'Lava-Jato': {
    icon: <Car className="h-5 w-5" />,
    descricao: 'Controle de serviços de lavagem, pacotes e fidelização.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico'],
    opcionaisModulos: ['assinaturas', 'financeiro'],
    color: 'bg-cyan-500',
    categoria: 'Automotivo',
  },
  // IMOBILIÁRIO
  'Imobiliárias': {
    icon: <Building2 className="h-5 w-5" />,
    descricao: 'Gestão de imóveis, contratos, visitas e CRM de clientes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'imoveis', 'agendamentos'],
    opcionaisModulos: ['documentos', 'financeiro'],
    color: 'bg-violet-500',
    categoria: 'Imobiliário',
  },
  'Corretores Autônomos': {
    icon: <Building2 className="h-5 w-5" />,
    descricao: 'CRM imobiliário simples para corretores independentes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'imoveis', 'agendamentos'],
    opcionaisModulos: [],
    color: 'bg-violet-400',
    categoria: 'Imobiliário',
  },
  // RELIGIOSO / TERCEIRO SETOR
  'Igrejas': {
    icon: <Church className="h-5 w-5" />,
    descricao: 'Gestão de membros, dízimos, eventos e comunicação da comunidade.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'membros'],
    opcionaisModulos: ['dizimos', 'agendamentos', 'documentos'],
    color: 'bg-indigo-500',
    categoria: 'Religioso',
  },
  'Associações/ONGs': {
    icon: <Heart className="h-5 w-5" />,
    descricao: 'Controle de associados, contribuições, projetos e transparência.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'membros'],
    opcionaisModulos: ['assinaturas', 'financeiro', 'documentos', 'relatorios_avancados'],
    color: 'bg-teal-500',
    categoria: 'Terceiro Setor',
  },
  // SERVIÇOS PROFISSIONAIS
  'Escritórios Contábeis': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'Gestão de clientes, documentos, prazos e integração fiscal.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'documentos', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'relatorios_avancados'],
    color: 'bg-cyan-600',
    categoria: 'Serviços',
  },
  'Escritórios Advocacia': {
    icon: <Scale className="h-5 w-5" />,
    descricao: 'Gestão de processos, prazos, clientes e controle de honorários.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'processos', 'documentos'],
    opcionaisModulos: ['agendamentos', 'financeiro'],
    color: 'bg-rose-600',
    categoria: 'Jurídico',
  },
  'Serviços Gerais': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'Gestão de ordens de serviço, equipes e agendamentos de visitas.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico', 'agendamentos'],
    opcionaisModulos: ['financeiro'],
    color: 'bg-gray-500',
    categoria: 'Serviços',
  },
  'Prestadores Autônomos': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'Sistema simples para profissionais autônomos com agenda e financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'ordens_servico'],
    opcionaisModulos: ['financeiro', 'pagamentos'],
    color: 'bg-gray-600',
    categoria: 'Serviços',
  },
  // GENÉRICO
  'Genérico': {
    icon: <Layers className="h-5 w-5" />,
    descricao: 'Sistema base flexível para qualquer tipo de negócio. Personalize conforme sua necessidade.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes'],
    opcionaisModulos: [],
    color: 'bg-gray-500',
    categoria: 'Outros',
  },
};

// Group templates by category
const CATEGORIAS = [
  { nome: 'Saúde', icon: <Stethoscope className="h-4 w-4" />, color: 'bg-emerald-500' },
  { nome: 'Beleza', icon: <Scissors className="h-4 w-4" />, color: 'bg-pink-500' },
  { nome: 'Fitness', icon: <Dumbbell className="h-4 w-4" />, color: 'bg-orange-500' },
  { nome: 'Educação', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-blue-500' },
  { nome: 'Food Service', icon: <UtensilsCrossed className="h-4 w-4" />, color: 'bg-amber-500' },
  { nome: 'Automotivo', icon: <Car className="h-4 w-4" />, color: 'bg-slate-500' },
  { nome: 'Imobiliário', icon: <Building2 className="h-4 w-4" />, color: 'bg-violet-500' },
  { nome: 'Religioso', icon: <Church className="h-4 w-4" />, color: 'bg-indigo-500' },
  { nome: 'Terceiro Setor', icon: <Heart className="h-4 w-4" />, color: 'bg-teal-500' },
  { nome: 'Serviços', icon: <Briefcase className="h-4 w-4" />, color: 'bg-cyan-500' },
  { nome: 'Jurídico', icon: <Scale className="h-4 w-4" />, color: 'bg-rose-500' },
  { nome: 'Outros', icon: <Layers className="h-4 w-4" />, color: 'bg-gray-500' },
];

export default function GestaoSistemasBase() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [sistemas, setSistemas] = useState<SistemaBase[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSistema, setSelectedSistema] = useState<SistemaBase | null>(null);
  const [sistemaModulos, setSistemaModulos] = useState<SistemaModulo[]>([]);
  const [activeTab, setActiveTab] = useState('tipo');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoSistema | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    nicho: '',
    versao: '1.0.0',
    status: 'active' as 'active' | 'inactive' | 'pending',
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchSistemas();
    fetchModulos();
  }, []);

  const fetchSistemas = async () => {
    const { data, error } = await supabase
      .from('sistemas_base')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar sistemas', variant: 'destructive' });
    } else {
      setSistemas(data || []);
    }
    setLoading(false);
  };

  const fetchModulos = async () => {
    const { data } = await supabase
      .from('modulos')
      .select('*')
      .eq('status', 'active')
      .order('is_core', { ascending: false })
      .order('nome');
    setModulos(data || []);
  };

  const fetchSistemaModulos = async (sistemaId: string) => {
    const { data } = await supabase
      .from('sistema_base_modulos')
      .select('modulo_id, is_default')
      .eq('sistema_base_id', sistemaId);
    
    setSistemaModulos(data || []);
  };

  // Apply template when tipo is selected
  const applyTemplate = useCallback((tipo: TipoSistema) => {
    const config = TIPOS_SISTEMA[tipo];
    
    // Set description
    setFormData(prev => ({
      ...prev,
      nicho: tipo,
      descricao: config.descricao,
    }));

    // Set modules
    const newModulos: SistemaModulo[] = [];
    
    // Add core modules as default (obrigatório)
    config.coreModulos.forEach(codigo => {
      const modulo = modulos.find(m => m.codigo === codigo);
      if (modulo) {
        newModulos.push({ modulo_id: modulo.id, is_default: true });
      }
    });

    // Add optional modules as non-default
    const opcionais = tipo === 'Genérico' 
      ? modulos.filter(m => !config.coreModulos.includes(m.codigo))
      : modulos.filter(m => config.opcionaisModulos.includes(m.codigo));

    opcionais.forEach(modulo => {
      newModulos.push({ modulo_id: modulo.id, is_default: false });
    });

    setSistemaModulos(newModulos);
    setSelectedTipo(tipo);
  }, [modulos]);

  const openEditSistema = async (sistema: SistemaBase) => {
    setSelectedSistema(sistema);
    setFormData({
      nome: sistema.nome,
      descricao: sistema.descricao || '',
      nicho: sistema.nicho,
      versao: sistema.versao,
      status: sistema.status,
    });
    
    // Try to match existing nicho to tipo
    const matchedTipo = Object.keys(TIPOS_SISTEMA).find(
      t => t.toLowerCase() === sistema.nicho.toLowerCase()
    ) as TipoSistema | undefined;
    setSelectedTipo(matchedTipo || null);
    
    await fetchSistemaModulos(sistema.id);
    setActiveTab('info');
    setIsDialogOpen(true);
  };

  const openNewSistema = () => {
    setSelectedSistema(null);
    setFormData({
      nome: '',
      descricao: '',
      nicho: '',
      versao: '1.0.0',
      status: 'active',
    });
    setSistemaModulos([]);
    setSelectedTipo(null);
    setActiveTab('tipo');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.nicho) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let sistemaId = selectedSistema?.id;

      if (selectedSistema) {
        const { error } = await supabase
          .from('sistemas_base')
          .update(formData)
          .eq('id', selectedSistema.id);

        if (error) throw error;
        
        await logAudit({ 
          action: 'update', 
          entityType: 'sistemas_base', 
          entityId: selectedSistema.id, 
          details: formData 
        });
      } else {
        const { data, error } = await supabase
          .from('sistemas_base')
          .insert(formData)
          .select()
          .single();

        if (error) throw error;
        
        sistemaId = data.id;
        await logAudit({ 
          action: 'create', 
          entityType: 'sistemas_base', 
          entityId: data.id, 
          details: formData 
        });
      }

      // Save modules
      if (sistemaId) {
        await supabase
          .from('sistema_base_modulos')
          .delete()
          .eq('sistema_base_id', sistemaId);

        if (sistemaModulos.length > 0) {
          const inserts = sistemaModulos.map(sm => ({
            sistema_base_id: sistemaId,
            modulo_id: sm.modulo_id,
            is_default: sm.is_default,
          }));

          await supabase.from('sistema_base_modulos').insert(inserts);
        }

        await logAudit({ 
          action: 'update', 
          entityType: 'sistema_base_modulos', 
          entityId: sistemaId, 
          details: { modulos: sistemaModulos.map(sm => ({ modulo_id: sm.modulo_id, is_default: sm.is_default })) } 
        });
      }

      toast({ title: selectedSistema ? 'Sistema atualizado!' : 'Sistema criado!' });
      setIsDialogOpen(false);
      fetchSistemas();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sistema: SistemaBase) => {
    if (!isSuperAdmin) {
      toast({ title: 'Sem permissão', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('sistemas_base')
      .delete()
      .eq('id', sistema.id);

    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      await logAudit({ 
        action: 'delete', 
        entityType: 'sistemas_base', 
        entityId: sistema.id, 
        details: { nome: sistema.nome } 
      });
      toast({ title: 'Sistema excluído' });
      fetchSistemas();
    }
  };

  const toggleModulo = (moduloId: string) => {
    const modulo = modulos.find(m => m.id === moduloId);
    const isCore = selectedTipo && TIPOS_SISTEMA[selectedTipo]?.coreModulos.includes(modulo?.codigo || '');
    
    // Core modules cannot be removed
    if (isCore) {
      toast({ title: 'Módulos Core não podem ser removidos', variant: 'destructive' });
      return;
    }
    
    setSistemaModulos(prev => {
      const exists = prev.find(sm => sm.modulo_id === moduloId);
      if (exists) {
        return prev.filter(sm => sm.modulo_id !== moduloId);
      } else {
        return [...prev, { modulo_id: moduloId, is_default: false }];
      }
    });
  };

  const toggleModuloDefault = (moduloId: string) => {
    const modulo = modulos.find(m => m.id === moduloId);
    const isCore = selectedTipo && TIPOS_SISTEMA[selectedTipo]?.coreModulos.includes(modulo?.codigo || '');
    
    // Core modules are always default
    if (isCore) {
      toast({ title: 'Módulos Core são sempre obrigatórios', variant: 'destructive' });
      return;
    }
    
    setSistemaModulos(prev => 
      prev.map(sm => 
        sm.modulo_id === moduloId 
          ? { ...sm, is_default: !sm.is_default }
          : sm
      )
    );
  };

  const isModuloSelected = (moduloId: string) => 
    sistemaModulos.some(sm => sm.modulo_id === moduloId);

  const isModuloDefault = (moduloId: string) => 
    sistemaModulos.find(sm => sm.modulo_id === moduloId)?.is_default || false;

  const isModuloCore = (modulo: Modulo) => 
    selectedTipo && TIPOS_SISTEMA[selectedTipo]?.coreModulos.includes(modulo.codigo);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const coreCount = sistemaModulos.filter(sm => sm.is_default).length;
  const optionalCount = sistemaModulos.filter(sm => !sm.is_default).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Biblioteca de Templates</h1>
            <p className="text-muted-foreground">
              {sistemas.length} templates • {modulos.length} módulos • {Object.keys(TIPOS_SISTEMA).length - 1} nichos
            </p>
          </div>
        </div>
        <Button onClick={openNewSistema} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* WhatsApp Alert */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <MessageSquare className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-600">Automação WhatsApp</AlertTitle>
        <AlertDescription className="text-amber-700">
          A automação de WhatsApp será habilitada em versão futura. A estrutura de eventos, filas e logs já está preparada.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sistemas Ativos</p>
                <p className="text-2xl font-bold">
                  {sistemas.filter(s => s.status === 'active').length}
                </p>
              </div>
              <Blocks className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Módulos Disponíveis</p>
                <p className="text-2xl font-bold">
                  {modulos.filter(m => m.status === 'active').length}
                </p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nichos Cobertos</p>
                <p className="text-2xl font-bold">
                  {new Set(sistemas.map(s => s.nicho)).size}
                </p>
              </div>
              <Settings2 className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Systems Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : sistemas.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Blocks className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum sistema cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie seu primeiro sistema base para começar
              </p>
              <Button onClick={openNewSistema}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Sistema
              </Button>
            </CardContent>
          </Card>
        ) : (
          sistemas.map((sistema) => {
            const tipoConfig = TIPOS_SISTEMA[sistema.nicho as TipoSistema];
            return (
              <Card key={sistema.id} className="relative overflow-hidden group">
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  tipoConfig?.color || (sistema.status === 'active' ? 'bg-green-500' : 
                  sistema.status === 'inactive' ? 'bg-red-500' : 'bg-yellow-500')
                }`} />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tipoConfig?.color || 'bg-primary'} text-white`}>
                        {tipoConfig?.icon || <Blocks className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{sistema.nome}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {sistema.descricao || 'Sem descrição'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <Badge variant="outline">{sistema.nicho}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Versão</span>
                    <span className="font-mono">{sistema.versao}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={sistema.status === 'active' ? 'default' : 'secondary'}>
                      {sistema.status === 'active' ? 'Ativo' : 
                       sistema.status === 'inactive' ? 'Inativo' : 'Pendente'}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => openEditSistema(sistema)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    {isSuperAdmin && (
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => handleDelete(sistema)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Blocks className="h-5 w-5" />
              {selectedSistema ? `Editar: ${selectedSistema.nome}` : 'Novo Sistema Base'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tipo" className="gap-2" disabled={!!selectedSistema}>
                <Sparkles className="h-4 w-4" />
                Tipo
              </TabsTrigger>
              <TabsTrigger value="info" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Informações
              </TabsTrigger>
              <TabsTrigger value="modulos" className="gap-2">
                <Package className="h-4 w-4" />
                Módulos ({sistemaModulos.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Tipo de Sistema */}
            <TabsContent value="tipo" className="space-y-4 mt-4 flex-1 overflow-y-auto">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Escolha o tipo de sistema</h3>
                <p className="text-sm text-muted-foreground">
                  Selecione um tipo para carregar automaticamente os módulos ideais
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(TIPOS_SISTEMA) as TipoSistema[]).map((tipo) => {
                  const config = TIPOS_SISTEMA[tipo];
                  const isSelected = selectedTipo === tipo;
                  
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => applyTemplate(tipo)}
                      className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-lg' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${config.color} text-white`}>
                          {config.icon}
                        </div>
                        <div className="font-semibold">{tipo}</div>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-primary ml-auto" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {config.descricao}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {config.coreModulos.slice(0, 3).map(codigo => (
                          <Badge key={codigo} variant="secondary" className="text-xs">
                            {codigo}
                          </Badge>
                        ))}
                        {config.coreModulos.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{config.coreModulos.length - 3}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedTipo && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => setActiveTab('info')} className="gap-2">
                    Próximo: Informações
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tab: Informações */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Sistema *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Sistema para Clínicas"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nicho">Tipo / Nicho *</Label>
                  <Select
                    value={formData.nicho}
                    onValueChange={(v) => {
                      setFormData({ ...formData, nicho: v });
                      if (Object.keys(TIPOS_SISTEMA).includes(v)) {
                        applyTemplate(v as TipoSistema);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPOS_SISTEMA) as TipoSistema[]).map(tipo => (
                        <SelectItem key={tipo} value={tipo}>
                          <div className="flex items-center gap-2">
                            {TIPOS_SISTEMA[tipo].icon}
                            {tipo}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o propósito e funcionalidades principais do sistema..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="versao">Versão</Label>
                  <Input
                    id="versao"
                    placeholder="1.0.0"
                    value={formData.versao}
                    onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: 'active' | 'inactive' | 'pending') => 
                      setFormData({ ...formData, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                {!selectedSistema && (
                  <Button variant="outline" onClick={() => setActiveTab('tipo')} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Voltar: Tipo
                  </Button>
                )}
                <Button onClick={() => setActiveTab('modulos')} className="gap-2 ml-auto">
                  Próximo: Módulos
                  <Package className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Módulos */}
            <TabsContent value="modulos" className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Selecione os módulos. Módulos <strong>Core</strong> não podem ser desativados pelos clientes.
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">{coreCount} Core</Badge>
                  <Badge variant="outline">{optionalCount} Opcionais</Badge>
                </div>
              </div>

              {modulos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum módulo cadastrado. Crie módulos primeiro.
                </div>
              ) : (
                <div className="space-y-2">
                  {modulos.map((modulo) => {
                    const isSelected = isModuloSelected(modulo.id);
                    const isDefault = isModuloDefault(modulo.id);
                    const isCore = isModuloCore(modulo);
                    
                    return (
                      <div
                        key={modulo.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isSelected 
                            ? isCore
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-secondary/50 border-primary/50'
                            : 'hover:bg-secondary/30'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleModulo(modulo.id)}
                            disabled={isCore}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{modulo.nome}</span>
                              {isCore && (
                                <Badge className="text-xs bg-primary">Core</Badge>
                              )}
                              {modulo.is_core && !isCore && (
                                <Badge variant="outline" className="text-xs">Sistema Core</Badge>
                              )}
                              <Badge variant="secondary" className="text-xs font-mono">
                                {modulo.codigo}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {modulo.descricao || 'Sem descrição'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">
                            {modulo.preco_mensal > 0 ? formatCurrency(modulo.preco_mensal) : 'Grátis'}
                          </span>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`default-${modulo.id}`} className="text-xs text-muted-foreground">
                                Obrigatório
                              </Label>
                              <Switch
                                id={`default-${modulo.id}`}
                                checked={isDefault}
                                onCheckedChange={() => toggleModuloDefault(modulo.id)}
                                disabled={isCore}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sistemaModulos.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-secondary/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Resumo de Módulos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sistemaModulos.map(sm => {
                      const modulo = modulos.find(m => m.id === sm.modulo_id);
                      const isCore = modulo && isModuloCore(modulo);
                      return modulo ? (
                        <Badge 
                          key={sm.modulo_id} 
                          variant={isCore ? 'default' : sm.is_default ? 'secondary' : 'outline'}
                        >
                          {modulo.nome}
                          {(isCore || sm.is_default) && <CheckCircle className="h-3 w-3 ml-1" />}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {selectedTipo && (
                <div className="mt-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-700">Módulos Core</h4>
                      <p className="text-sm text-muted-foreground">
                        Os módulos marcados como <strong>Core</strong> para o tipo "{selectedTipo}" 
                        não podem ser desativados pelos clientes. Eles são essenciais para o funcionamento do sistema.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Sistema
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
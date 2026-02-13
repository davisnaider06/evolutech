import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
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

// Tipos de sistema com configuraÃ§Ãµes padrÃ£o - 25+ nichos
type TipoSistema = 
  | 'ClÃ­nicas MÃ©dicas' | 'ClÃ­nicas OdontolÃ³gicas' | 'PsicÃ³logos/Terapeutas'
  | 'SalÃµes de Beleza' | 'Barbearias' | 'EstÃºdios de EstÃ©tica'
  | 'Academias' | 'Personal Trainers'
  | 'Escolas' | 'Cursos Profissionalizantes' | 'Plataforma EAD'
  | 'Restaurantes' | 'Pizzarias' | 'Lanchonetes' | 'Delivery'
  | 'Oficinas MecÃ¢nicas' | 'Lava-Jato'
  | 'ImobiliÃ¡rias' | 'Corretores AutÃ´nomos'
  | 'Igrejas' | 'AssociaÃ§Ãµes/ONGs'
  | 'EscritÃ³rios ContÃ¡beis' | 'EscritÃ³rios Advocacia'
  | 'ServiÃ§os Gerais' | 'Prestadores AutÃ´nomos'
  | 'GenÃ©rico';

interface TipoSistemaConfig {
  icon: React.ReactNode;
  descricao: string;
  coreModulos: string[];
  opcionaisModulos: string[];
  color: string;
  categoria: string;
}

const TIPOS_SISTEMA: Record<TipoSistema, TipoSistemaConfig> = {
  // SAÃšDE
  'ClÃ­nicas MÃ©dicas': {
    icon: <Stethoscope className="h-5 w-5" />,
    descricao: 'Sistema completo para clÃ­nicas mÃ©dicas com agendamentos, prontuÃ¡rio eletrÃ´nico e financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'pagamentos', 'relatorios_avancados'],
    color: 'bg-emerald-500',
    categoria: 'SaÃºde',
  },
  'ClÃ­nicas OdontolÃ³gicas': {
    icon: <Stethoscope className="h-5 w-5" />,
    descricao: 'GestÃ£o de consultÃ³rios odontolÃ³gicos com odontograma, tratamentos e agendamentos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'pagamentos', 'estoque'],
    color: 'bg-emerald-500',
    categoria: 'SaÃºde',
  },
  'PsicÃ³logos/Terapeutas': {
    icon: <Heart className="h-5 w-5" />,
    descricao: 'GestÃ£o de consultÃ³rios de saÃºde mental com prontuÃ¡rio, sessÃµes e evoluÃ§Ã£o do paciente.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-pink-500',
    categoria: 'SaÃºde',
  },
  // BELEZA
  'SalÃµes de Beleza': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'Agendamentos, controle de profissionais, comissÃµes e fidelizaÃ§Ã£o de clientes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-pink-400',
    categoria: 'Beleza',
  },
  'Barbearias': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'GestÃ£o de barbearias com agendamentos online, filas e pagamentos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'pagamentos'],
    color: 'bg-slate-600',
    categoria: 'Beleza',
  },
  'EstÃºdios de EstÃ©tica': {
    icon: <Scissors className="h-5 w-5" />,
    descricao: 'Controle de procedimentos, pacotes e acompanhamento de tratamentos estÃ©ticos.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'prontuario'],
    opcionaisModulos: ['financeiro', 'assinaturas', 'pagamentos'],
    color: 'bg-purple-400',
    categoria: 'Beleza',
  },
  // FITNESS
  'Academias': {
    icon: <Dumbbell className="h-5 w-5" />,
    descricao: 'GestÃ£o completa de academia com matrÃ­culas, treinos, check-in e mensalidades.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca', 'treinos'],
    opcionaisModulos: ['assinaturas', 'avaliacao_fisica', 'pagamentos', 'financeiro'],
    color: 'bg-orange-500',
    categoria: 'Fitness',
  },
  'Personal Trainers': {
    icon: <Dumbbell className="h-5 w-5" />,
    descricao: 'GestÃ£o de alunos, treinos personalizados, agendamentos e evoluÃ§Ã£o.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'treinos'],
    opcionaisModulos: ['avaliacao_fisica', 'assinaturas', 'pagamentos'],
    color: 'bg-orange-600',
    categoria: 'Fitness',
  },
  // EDUCAÃ‡ÃƒO
  'Escolas': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'GestÃ£o escolar com matrÃ­culas, turmas, frequÃªncia e comunicaÃ§Ã£o com pais.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca'],
    opcionaisModulos: ['financeiro', 'documentos', 'relatorios_avancados'],
    color: 'bg-blue-500',
    categoria: 'EducaÃ§Ã£o',
  },
  'Cursos Profissionalizantes': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'GestÃ£o de cursos livres com turmas, certificados e controle financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'matriculas', 'presenca'],
    opcionaisModulos: ['certificados', 'financeiro', 'pagamentos'],
    color: 'bg-blue-600',
    categoria: 'EducaÃ§Ã£o',
  },
  'Plataforma EAD': {
    icon: <GraduationCap className="h-5 w-5" />,
    descricao: 'Plataforma de cursos online com vÃ­deos, materiais, provas e certificados.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cursos_online'],
    opcionaisModulos: ['certificados', 'assinaturas', 'pagamentos'],
    color: 'bg-indigo-500',
    categoria: 'EducaÃ§Ã£o',
  },
  // FOOD SERVICE
  'Restaurantes': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'GestÃ£o completa de restaurante com mesas, comandas, cardÃ¡pio e caixa.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas'],
    opcionaisModulos: ['reservas', 'estoque', 'financeiro', 'delivery'],
    color: 'bg-amber-500',
    categoria: 'Food Service',
  },
  'Pizzarias': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'GestÃ£o de pizzaria com pedidos, delivery e controle de produÃ§Ã£o.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas', 'delivery'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-red-500',
    categoria: 'Food Service',
  },
  'Lanchonetes': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Sistema simples para lanchonetes com pedidos rÃ¡pidos e controle de caixa.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'comandas'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-yellow-500',
    categoria: 'Food Service',
  },
  'Delivery': {
    icon: <UtensilsCrossed className="h-5 w-5" />,
    descricao: 'Plataforma de delivery com app, rastreamento e gestÃ£o de entregadores.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'cardapio', 'delivery'],
    opcionaisModulos: ['pagamentos', 'financeiro'],
    color: 'bg-green-500',
    categoria: 'Food Service',
  },
  // AUTOMOTIVO
  'Oficinas MecÃ¢nicas': {
    icon: <Car className="h-5 w-5" />,
    descricao: 'GestÃ£o de oficina com OS, peÃ§as, orÃ§amentos e controle de serviÃ§os.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico'],
    opcionaisModulos: ['estoque', 'financeiro'],
    color: 'bg-slate-500',
    categoria: 'Automotivo',
  },
  'Lava-Jato': {
    icon: <Car className="h-5 w-5" />,
    descricao: 'Controle de serviÃ§os de lavagem, pacotes e fidelizaÃ§Ã£o.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico'],
    opcionaisModulos: ['assinaturas', 'financeiro'],
    color: 'bg-cyan-500',
    categoria: 'Automotivo',
  },
  // IMOBILIÃRIO
  'ImobiliÃ¡rias': {
    icon: <Building2 className="h-5 w-5" />,
    descricao: 'GestÃ£o de imÃ³veis, contratos, visitas e CRM de clientes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'imoveis', 'agendamentos'],
    opcionaisModulos: ['documentos', 'financeiro'],
    color: 'bg-violet-500',
    categoria: 'ImobiliÃ¡rio',
  },
  'Corretores AutÃ´nomos': {
    icon: <Building2 className="h-5 w-5" />,
    descricao: 'CRM imobiliÃ¡rio simples para corretores independentes.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'imoveis', 'agendamentos'],
    opcionaisModulos: [],
    color: 'bg-violet-400',
    categoria: 'ImobiliÃ¡rio',
  },
  // RELIGIOSO / TERCEIRO SETOR
  'Igrejas': {
    icon: <Church className="h-5 w-5" />,
    descricao: 'GestÃ£o de membros, dÃ­zimos, eventos e comunicaÃ§Ã£o da comunidade.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'membros'],
    opcionaisModulos: ['dizimos', 'agendamentos', 'documentos'],
    color: 'bg-indigo-500',
    categoria: 'Religioso',
  },
  'AssociaÃ§Ãµes/ONGs': {
    icon: <Heart className="h-5 w-5" />,
    descricao: 'Controle de associados, contribuiÃ§Ãµes, projetos e transparÃªncia.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'membros'],
    opcionaisModulos: ['assinaturas', 'financeiro', 'documentos', 'relatorios_avancados'],
    color: 'bg-teal-500',
    categoria: 'Terceiro Setor',
  },
  // SERVIÃ‡OS PROFISSIONAIS
  'EscritÃ³rios ContÃ¡beis': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'GestÃ£o de clientes, documentos, prazos e integraÃ§Ã£o fiscal.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'documentos', 'agendamentos'],
    opcionaisModulos: ['financeiro', 'relatorios_avancados'],
    color: 'bg-cyan-600',
    categoria: 'ServiÃ§os',
  },
  'EscritÃ³rios Advocacia': {
    icon: <Scale className="h-5 w-5" />,
    descricao: 'GestÃ£o de processos, prazos, clientes e controle de honorÃ¡rios.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'processos', 'documentos'],
    opcionaisModulos: ['agendamentos', 'financeiro'],
    color: 'bg-rose-600',
    categoria: 'JurÃ­dico',
  },
  'ServiÃ§os Gerais': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'GestÃ£o de ordens de serviÃ§o, equipes e agendamentos de visitas.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'ordens_servico', 'agendamentos'],
    opcionaisModulos: ['financeiro'],
    color: 'bg-gray-500',
    categoria: 'ServiÃ§os',
  },
  'Prestadores AutÃ´nomos': {
    icon: <Briefcase className="h-5 w-5" />,
    descricao: 'Sistema simples para profissionais autÃ´nomos com agenda e financeiro.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes', 'agendamentos', 'ordens_servico'],
    opcionaisModulos: ['financeiro', 'pagamentos'],
    color: 'bg-gray-600',
    categoria: 'ServiÃ§os',
  },
  // GENÃ‰RICO
  'GenÃ©rico': {
    icon: <Layers className="h-5 w-5" />,
    descricao: 'Sistema base flexÃ­vel para qualquer tipo de negÃ³cio. Personalize conforme sua necessidade.',
    coreModulos: ['auth', 'users', 'dashboard', 'clientes'],
    opcionaisModulos: [],
    color: 'bg-gray-500',
    categoria: 'Outros',
  },
};

// Group templates by category
const CATEGORIAS = [
  { nome: 'SaÃºde', icon: <Stethoscope className="h-4 w-4" />, color: 'bg-emerald-500' },
  { nome: 'Beleza', icon: <Scissors className="h-4 w-4" />, color: 'bg-pink-500' },
  { nome: 'Fitness', icon: <Dumbbell className="h-4 w-4" />, color: 'bg-orange-500' },
  { nome: 'EducaÃ§Ã£o', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-blue-500' },
  { nome: 'Food Service', icon: <UtensilsCrossed className="h-4 w-4" />, color: 'bg-amber-500' },
  { nome: 'Automotivo', icon: <Car className="h-4 w-4" />, color: 'bg-slate-500' },
  { nome: 'ImobiliÃ¡rio', icon: <Building2 className="h-4 w-4" />, color: 'bg-violet-500' },
  { nome: 'Religioso', icon: <Church className="h-4 w-4" />, color: 'bg-indigo-500' },
  { nome: 'Terceiro Setor', icon: <Heart className="h-4 w-4" />, color: 'bg-teal-500' },
  { nome: 'ServiÃ§os', icon: <Briefcase className="h-4 w-4" />, color: 'bg-cyan-500' },
  { nome: 'JurÃ­dico', icon: <Scale className="h-4 w-4" />, color: 'bg-rose-500' },
  { nome: 'Outros', icon: <Layers className="h-4 w-4" />, color: 'bg-gray-500' },
];

export default function GestaoSistemasBase() {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
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
  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [getToken]);

  useEffect(() => {
    fetchSistemas();
    fetchModulos();
  }, []);

  const fetchSistemas = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/sistemas-base`, { headers });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }
      const data = await response.json();
      setSistemas(data || []);
    } catch (_error) {
      toast({ title: 'Erro ao carregar sistemas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchModulos = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/modulos`, { headers });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }
      const data = await response.json();
      const onlyActive = (data || []).filter((m: Modulo) => m.status === 'active');
      setModulos(onlyActive);
    } catch (_error) {
      toast({ title: 'Erro ao carregar mÃ³dulos', variant: 'destructive' });
      setModulos([]);
    }
  };

  const fetchSistemaModulos = async (sistemaId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/sistemas-base/${sistemaId}/modulos`, { headers });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }
      const data = await response.json();
      setSistemaModulos((data || []).map((m: any) => ({ modulo_id: m.modulo_id, is_default: !!m.is_default })));
    } catch (_error) {
      toast({ title: 'Erro ao carregar mÃ³dulos do sistema', variant: 'destructive' });
      setSistemaModulos([]);
    }
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
    
    // Add core modules as default (obrigatÃ³rio)
    config.coreModulos.forEach(codigo => {
      const modulo = modulos.find(m => m.codigo === codigo);
      if (modulo) {
        newModulos.push({ modulo_id: modulo.id, is_default: true });
      }
    });

    // Add optional modules as non-default
    const opcionais = tipo === 'GenÃ©rico' 
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
      toast({ title: 'Preencha os campos obrigatÃ³rios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let sistemaId = selectedSistema?.id;
      const headers = await getAuthHeaders();

      if (selectedSistema) {
        const response = await fetch(`${API_URL}/sistemas-base/${selectedSistema.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `Erro ${response.status}`);
        }
        
        await logAudit({ 
          action: 'update', 
          entityType: 'sistemas_base', 
          entityId: selectedSistema.id, 
          details: formData 
        });
      } else {
        const response = await fetch(`${API_URL}/sistemas-base`, {
          method: 'POST',
          headers,
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `Erro ${response.status}`);
        }
        const data = await response.json();
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
        const moduleIds = sistemaModulos.map((sm) => sm.modulo_id);
        const defaultModuleIds = sistemaModulos.filter((sm) => sm.is_default).map((sm) => sm.modulo_id);
        const modulesResponse = await fetch(`${API_URL}/sistemas-base/${sistemaId}/modulos`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ moduleIds, defaultModuleIds }),
        });
        if (!modulesResponse.ok) {
          const errorData = await modulesResponse.json().catch(() => ({}));
          throw new Error(errorData?.error || `Erro ${modulesResponse.status}`);
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
      toast({ title: 'Sem permissÃ£o', variant: 'destructive' });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/sistemas-base/${sistema.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      await logAudit({
        action: 'delete',
        entityType: 'sistemas_base',
        entityId: sistema.id,
        details: { nome: sistema.nome }
      });
      toast({ title: 'Sistema excluido' });
      fetchSistemas();
    } catch (_error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const toggleModulo = (moduloId: string) => {
    const modulo = modulos.find(m => m.id === moduloId);
    const isCore = selectedTipo && TIPOS_SISTEMA[selectedTipo]?.coreModulos.includes(modulo?.codigo || '');
    
    // Core modules cannot be removed
    if (isCore) {
      toast({ title: 'MÃ³dulos Core nÃ£o podem ser removidos', variant: 'destructive' });
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
      toast({ title: 'MÃ³dulos Core sÃ£o sempre obrigatÃ³rios', variant: 'destructive' });
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
              {sistemas.length} templates â€¢ {modulos.length} mÃ³dulos â€¢ {Object.keys(TIPOS_SISTEMA).length - 1} nichos
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
        <AlertTitle className="text-amber-600">AutomaÃ§Ã£o WhatsApp</AlertTitle>
        <AlertDescription className="text-amber-700">
          A automaÃ§Ã£o de WhatsApp serÃ¡ habilitada em versÃ£o futura. A estrutura de eventos, filas e logs jÃ¡ estÃ¡ preparada.
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
                <p className="text-sm text-muted-foreground">MÃ³dulos DisponÃ­veis</p>
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
                Crie seu primeiro sistema base para comeÃ§ar
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
                          {sistema.descricao || 'Sem descriÃ§Ã£o'}
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
                    <span className="text-muted-foreground">VersÃ£o</span>
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
                InformaÃ§Ãµes
              </TabsTrigger>
              <TabsTrigger value="modulos" className="gap-2">
                <Package className="h-4 w-4" />
                MÃ³dulos ({sistemaModulos.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Tipo de Sistema */}
            <TabsContent value="tipo" className="space-y-4 mt-4 flex-1 overflow-y-auto">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Escolha o tipo de sistema</h3>
                <p className="text-sm text-muted-foreground">
                  Selecione um tipo para carregar automaticamente os mÃ³dulos ideais
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
                    PrÃ³ximo: InformaÃ§Ãµes
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tab: InformaÃ§Ãµes */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Sistema *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Sistema para ClÃ­nicas"
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
                <Label htmlFor="descricao">DescriÃ§Ã£o</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o propÃ³sito e funcionalidades principais do sistema..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="versao">VersÃ£o</Label>
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
                  PrÃ³ximo: MÃ³dulos
                  <Package className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Tab: MÃ³dulos */}
            <TabsContent value="modulos" className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Selecione os mÃ³dulos. MÃ³dulos <strong>Core</strong> nÃ£o podem ser desativados pelos clientes.
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">{coreCount} Core</Badge>
                  <Badge variant="outline">{optionalCount} Opcionais</Badge>
                </div>
              </div>

              {modulos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum mÃ³dulo cadastrado. Crie mÃ³dulos primeiro.
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
                              {modulo.descricao || 'Sem descriÃ§Ã£o'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">
                            {modulo.preco_mensal > 0 ? formatCurrency(modulo.preco_mensal) : 'GrÃ¡tis'}
                          </span>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`default-${modulo.id}`} className="text-xs text-muted-foreground">
                                ObrigatÃ³rio
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
                    Resumo de MÃ³dulos
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
                      <h4 className="font-medium text-yellow-700">MÃ³dulos Core</h4>
                      <p className="text-sm text-muted-foreground">
                        Os mÃ³dulos marcados como <strong>Core</strong> para o tipo "{selectedTipo}" 
                        nÃ£o podem ser desativados pelos clientes. Eles sÃ£o essenciais para o funcionamento do sistema.
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


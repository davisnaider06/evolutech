import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, HeadphonesIcon, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  empresa_id: string;
  usuario_id: string;
  titulo: string;
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado';
  categoria: string | null;
  resposta: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string };
  companies?: { name: string };
}

const prioridadeColors = {
  baixa: 'bg-green-500/20 text-green-500',
  media: 'bg-yellow-500/20 text-yellow-500',
  alta: 'bg-orange-500/20 text-orange-500',
  urgente: 'bg-red-500/20 text-red-500',
};

const statusColors = {
  aberto: 'bg-blue-500/20 text-blue-500',
  em_andamento: 'bg-purple-500/20 text-purple-500',
  aguardando_cliente: 'bg-yellow-500/20 text-yellow-500',
  resolvido: 'bg-green-500/20 text-green-500',
  fechado: 'bg-gray-500/20 text-gray-500',
};

const statusLabels = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  aguardando_cliente: 'Aguardando Cliente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export default function Suporte() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as const,
    categoria: '',
  });
  const [resposta, setResposta] = useState('');

  const isEvolutech = user?.role === 'SUPER_ADMIN_EVOLUTECH' || user?.role === 'ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets_suporte')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar tickets', variant: 'destructive' });
    } else {
      setTickets((data || []) as unknown as Ticket[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('tickets_suporte')
      .insert({
        ...formData,
        empresa_id: user?.tenantId,
        usuario_id: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar ticket', variant: 'destructive' });
    } else {
      await logAudit({ action: 'create', entityType: 'tickets_suporte', entityId: data.id, details: formData });
      toast({ title: 'Ticket criado com sucesso' });
      fetchTickets();
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleResponder = async () => {
    if (!selectedTicket || !resposta) return;

    const { error } = await supabase
      .from('tickets_suporte')
      .update({
        resposta,
        status: 'resolvido',
      })
      .eq('id', selectedTicket.id);

    if (error) {
      toast({ title: 'Erro ao responder', variant: 'destructive' });
    } else {
      await logAudit({ action: 'update', entityType: 'tickets_suporte', entityId: selectedTicket.id, details: { resposta, status: 'resolvido' } });
      toast({ title: 'Resposta enviada' });
      fetchTickets();
      setSelectedTicket(null);
      setResposta('');
    }
  };

  const handleUpdateStatus = async (ticket: Ticket, newStatus: string) => {
    const { error } = await supabase
      .from('tickets_suporte')
      .update({ status: newStatus })
      .eq('id', ticket.id);

    if (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    } else {
      await logAudit({ action: 'update', entityType: 'tickets_suporte', entityId: ticket.id, details: { status: newStatus } });
      toast({ title: 'Status atualizado' });
      fetchTickets();
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      prioridade: 'media',
      categoria: '',
    });
  };

  const openTickets = tickets.filter(t => t.status !== 'fechado' && t.status !== 'resolvido').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">
            {isEvolutech ? 'Gerencie todos os tickets de suporte' : 'Abra e acompanhe seus tickets'}
          </p>
        </div>
        {!isEvolutech && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir Ticket de Suporte</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Título do problema"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Descreva o problema em detalhes..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  required
                  rows={4}
                />
                <Select
                  value={formData.prioridade}
                  onValueChange={(v: any) => setFormData({ ...formData, prioridade: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Categoria (opcional)"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                />
                <Button type="submit" className="w-full">Enviar Ticket</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Aberto</p>
                <p className="text-2xl font-bold">{openTickets}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold">
                  {tickets.filter(t => t.status === 'em_andamento').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold">
                  {tickets.filter(t => t.status === 'resolvido').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{tickets.length}</p>
              </div>
              <HeadphonesIcon className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum ticket encontrado
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:bg-secondary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{ticket.titulo}</h3>
                      <Badge className={prioridadeColors[ticket.prioridade]}>
                        {ticket.prioridade.charAt(0).toUpperCase() + ticket.prioridade.slice(1)}
                      </Badge>
                      <Badge className={statusColors[ticket.status]}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.descricao}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {isEvolutech && ticket.companies && (
                        <span>Empresa: {ticket.companies.name}</span>
                      )}
                      <span>Por: {ticket.profiles?.full_name || ticket.profiles?.email}</span>
                      <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    {ticket.resposta && (
                      <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <p className="text-sm font-medium text-green-500">Resposta:</p>
                        <p className="text-sm">{ticket.resposta}</p>
                      </div>
                    )}
                  </div>
                  {isEvolutech && ticket.status !== 'fechado' && (
                    <div className="flex flex-col gap-2">
                      <Select
                        value={ticket.status}
                        onValueChange={(v) => handleUpdateStatus(ticket, v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="aguardando_cliente">Aguardando</SelectItem>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                      {!ticket.resposta && (
                        <Button size="sm" onClick={() => setSelectedTicket(ticket)}>
                          Responder
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="font-medium">{selectedTicket?.titulo}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedTicket?.descricao}</p>
            </div>
            <Textarea
              placeholder="Digite sua resposta..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={4}
            />
            <Button onClick={handleResponder} className="w-full">
              Enviar Resposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { companyService } from '@/services/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from 'sonner';

type Ticket = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado';
  category?: string | null;
  response?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at?: string;
  company?: { id: string; name: string; slug: string } | null;
  created_by?: { id: string; name: string; email: string } | null;
  responded_by?: { id: string; name: string; email: string } | null;
};

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
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export default function Suporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [resposta, setResposta] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'media' as Ticket['priority'],
    category: '',
  });

  const isEvolutech = user?.role === 'SUPER_ADMIN_EVOLUTECH' || user?.role === 'ADMIN_EVOLUTECH';
  const isOwner = user?.role === 'DONO_EMPRESA';

  const stats = useMemo(
    () => ({
      open: tickets.filter((ticket) => !['fechado', 'resolvido'].includes(ticket.status)).length,
      inProgress: tickets.filter((ticket) => ticket.status === 'em_andamento').length,
      resolved: tickets.filter((ticket) => ticket.status === 'resolvido').length,
      total: tickets.length,
    }),
    [tickets]
  );

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = isEvolutech
        ? await adminService.listSupportTickets()
        : await companyService.listSupportTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, [isEvolutech]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'media',
      category: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await companyService.createSupportTicket(formData);
      toast.success('Ticket criado com sucesso');
      setIsDialogOpen(false);
      resetForm();
      await fetchTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar ticket');
    }
  };

  const handleResponder = async () => {
    if (!selectedTicket || !resposta.trim()) return;
    try {
      await adminService.respondSupportTicket(selectedTicket.id, resposta.trim());
      toast.success('Resposta enviada');
      setSelectedTicket(null);
      setResposta('');
      await fetchTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao responder ticket');
    }
  };

  const handleUpdateStatus = async (ticket: Ticket, newStatus: string) => {
    try {
      await adminService.updateSupportTicketStatus(ticket.id, newStatus);
      toast.success('Status atualizado');
      await fetchTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">
            {isEvolutech ? 'Gerencie os tickets enviados pelas empresas' : 'Abra e acompanhe seus tickets de suporte'}
          </p>
        </div>
        {isOwner && (
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
                <DialogDescription>
                  Descreva o problema para que o admin da Evolutech acompanhe e responda dentro do sistema.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Titulo do problema"
                  value={formData.title}
                  onChange={(e) => setFormData((old) => ({ ...old, title: e.target.value }))}
                  required
                />
                <Textarea
                  placeholder="Descreva o problema com o maximo de contexto util"
                  value={formData.description}
                  onChange={(e) => setFormData((old) => ({ ...old, description: e.target.value }))}
                  required
                  rows={5}
                />
                <Select
                  value={formData.priority}
                  onValueChange={(value: Ticket['priority']) => setFormData((old) => ({ ...old, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Categoria (opcional)"
                  value={formData.category}
                  onChange={(e) => setFormData((old) => ({ ...old, category: e.target.value }))}
                />
                <Button type="submit" className="w-full">Enviar Ticket</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em aberto</p>
                <p className="text-2xl font-bold">{stats.open}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em andamento</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
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
                <p className="text-2xl font-bold">{stats.resolved}</p>
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
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <HeadphonesIcon className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum ticket encontrado.
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:bg-secondary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{ticket.title}</h3>
                      <Badge className={prioridadeColors[ticket.priority]}>
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </Badge>
                      <Badge className={statusColors[ticket.status]}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{ticket.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {isEvolutech && ticket.company && <span>Empresa: {ticket.company.name}</span>}
                      <span>Por: {ticket.created_by?.name || ticket.created_by?.email || '-'}</span>
                      <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    {ticket.response && (
                      <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                        <p className="text-sm font-medium text-green-500">Resposta do suporte</p>
                        <p className="text-sm">{ticket.response}</p>
                      </div>
                    )}
                  </div>

                  {isEvolutech && ticket.status !== 'fechado' && (
                    <div className="flex flex-col gap-2">
                      <Select value={ticket.status} onValueChange={(value) => handleUpdateStatus(ticket, value)}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                      {!ticket.response && (
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

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Ticket</DialogTitle>
            <DialogDescription>
              Essa resposta ficará visível para o dono da empresa dentro do app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary p-3">
              <p className="font-medium">{selectedTicket?.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedTicket?.description}</p>
            </div>
            <Textarea
              placeholder="Digite a resposta do suporte"
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

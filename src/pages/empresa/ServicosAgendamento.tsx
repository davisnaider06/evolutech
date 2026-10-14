import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, Pencil, Scissors, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';

interface ServicoAgendamento {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

const formVazio = {
  name: '',
  durationMinutes: 30,
  price: 0,
  isActive: true,
};

const dinheiro = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ServicosAgendamento: React.FC = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'DONO_EMPRESA';

  const [servicos, setServicos] = useState<ServicoAgendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<ServicoAgendamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [paraExcluir, setParaExcluir] = useState<ServicoAgendamento | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await companyService.list('appointment_services', {
        page: 1,
        pageSize: 200,
      });
      const linhas = Array.isArray(resultado?.data) ? resultado.data : [];
      setServicos(
        linhas.map((item: any) => ({
          id: item.id,
          name: item.name,
          durationMinutes: Number(item.durationMinutes || 30),
          price: Number(item.price || 0),
          isActive: item.isActive !== false,
        }))
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar serviços');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  };

  const abrirEdicao = (servico: ServicoAgendamento) => {
    setEditando(servico);
    setForm({
      name: servico.name,
      durationMinutes: servico.durationMinutes,
      price: servico.price,
      isActive: servico.isActive,
    });
    setDialogAberto(true);
  };

  const salvar = async () => {
    const nome = form.name.trim();
    if (!nome) {
      toast.error('Informe o nome do serviço');
      return;
    }

    const dados = {
      name: nome,
      durationMinutes: Math.max(5, Number(form.durationMinutes || 30)),
      price: Math.max(0, Number(form.price || 0)),
      isActive: form.isActive,
    };

    setSalvando(true);
    try {
      if (editando) {
        await companyService.update('appointment_services', editando.id, dados);
        toast.success('Serviço atualizado');
      } else {
        await companyService.create('appointment_services', dados);
        toast.success('Serviço cadastrado');
      }
      setDialogAberto(false);
      carregar();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar serviço');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!paraExcluir) return;
    try {
      await companyService.remove('appointment_services', paraExcluir.id);
      toast.success('Serviço removido');
      carregar();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover serviço');
    } finally {
      setParaExcluir(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description="O que o cliente escolhe ao agendar: nome, duração e preço."
        buttonLabel="Novo serviço"
        onButtonClick={abrirNovo}
        showButton={isOwner}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4 text-primary" />
            Serviços do agendamento
          </CardTitle>
          <CardDescription>
            A duração e o que define de quanto em quanto tempo os horários são oferecidos
            no link público. Serviço desativado some da lista do cliente sem perder o
            histórico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando serviços...</p>
          ) : servicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum serviço cadastrado ainda.
              {isOwner ? ' Toque em "Novo serviço" para comecar.' : ''}
            </p>
          ) : (
            <div className="space-y-2">
              {servicos.map((servico) => (
                <div
                  key={servico.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{servico.name}</p>
                      <StatusBadge status={servico.isActive ? 'active' : 'inactive'} />
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {servico.durationMinutes} min · {dinheiro(servico.price)}
                    </p>
                  </div>

                  {isOwner && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 sm:flex-none"
                        onClick={() => abrirEdicao(servico)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => setParaExcluir(servico)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sm:hidden">Excluir</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        title={editando ? 'Editar serviço' : 'Novo serviço'}
        description="Estes dados aparecem para o cliente na hora de agendar."
        onSubmit={salvar}
        isSubmitting={salvando}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="servico-nome">Nome do serviço *</Label>
            <Input
              id="servico-nome"
              placeholder="Ex: Corte masculino"
              value={form.name}
              onChange={(e) => setForm((old) => ({ ...old, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="servico-duracao">Duração (min)</Label>
              <Input
                id="servico-duracao"
                type="number"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((old) => ({ ...old, durationMinutes: Number(e.target.value || 30) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servico-preco">Preço (R$)</Label>
              <Input
                id="servico-preco"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((old) => ({ ...old, price: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Disponível para agendamento</p>
              <p className="text-xs text-muted-foreground">
                Desligado, o cliente não vê este serviço no link público.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(marcado) => setForm((old) => ({ ...old, isActive: marcado }))}
            />
          </div>
        </div>
      </FormDialog>

      <AlertDialog open={!!paraExcluir} onOpenChange={(aberto) => !aberto && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{paraExcluir?.name}" da lista de agendamento. Se você so quer tira-lo
              do link público por um tempo, prefira desativar na edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServicosAgendamento;

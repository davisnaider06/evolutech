import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ListTodo, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type TaskStatus = 'todo' | 'doing' | 'done';

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

const statusLabel: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  doing: 'Em Andamento',
  done: 'Concluído',
};

const statusOrder: TaskStatus[] = ['todo', 'doing', 'done'];

const EmpresaApp: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await companyService.listMyTasks();
      setTasks(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const createTask = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error('Digite o título da tarefa');
      return;
    }

    setSubmitting(true);
    try {
      await companyService.createMyTask({
        title,
        description: form.description.trim() || undefined,
      });
      setForm({ title: '', description: '' });
      toast.success('Tarefa criada');
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar tarefa');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await companyService.deleteMyTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      toast.success('Tarefa removida');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover tarefa');
    }
  };

  const moveTask = async (taskId: string, targetStatus: TaskStatus, targetIndex?: number) => {
    try {
      await companyService.moveMyTask(taskId, { status: targetStatus, targetIndex });
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao mover tarefa');
    }
  };

  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const doingCount = tasks.filter((t) => t.status === 'doing').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const columns = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        items: tasks
          .filter((task) => task.status === status)
          .sort((a, b) => a.position - b.position),
      })),
    [tasks]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground">Dashboard pessoal de tarefas em formato Kanban</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Tarefas Pendentes" value={todoCount} change={{ value: 0, label: 'a fazer' }} icon={ListTodo} />
        <StatsCard title="Em Andamento" value={doingCount} change={{ value: 0, label: 'em execução' }} icon={LoaderCircle} />
        <StatsCard title="Concluídas" value={doneCount} change={{ value: 0, label: 'finalizadas' }} icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova tarefa</CardTitle>
          <CardDescription>Crie tarefas para organizar seu dia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Conferir pedidos de hoje"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Detalhes da tarefa"
              rows={3}
            />
          </div>
          <Button className="gap-2" onClick={createTask} disabled={submitting}>
            <Plus className="h-4 w-4" />
            {submitting ? 'Salvando...' : 'Adicionar tarefa'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <Card
            key={column.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (!draggedTaskId) return;
              const targetIndex = column.items.length;
              await moveTask(draggedTaskId, column.status, targetIndex);
              setDraggedTaskId(null);
            }}
          >
            <CardHeader>
              <CardTitle className="text-base">
                {statusLabel[column.status]} ({column.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-24">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : column.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem tarefas nesta coluna</p>
              ) : (
                column.items.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      await moveTask(draggedTaskId, column.status, idx);
                      setDraggedTaskId(null);
                    }}
                    className="rounded-lg border p-3 space-y-2 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{task.title}</p>
                      <Badge variant="outline">{statusLabel[task.status]}</Badge>
                    </div>
                    {task.description ? (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    ) : null}
                    <div className="flex items-center justify-end">
                      <Button size="sm" variant="destructive" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmpresaApp;

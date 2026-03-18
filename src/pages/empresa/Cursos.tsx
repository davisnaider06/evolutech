import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';
import * as XLSX from 'xlsx';

type ContentType = 'video' | 'pdf' | 'image' | 'audio' | 'link';

interface CourseItem {
  id: string;
  title: string;
  description?: string | null;
  content_type?: string;
  content_url?: string | null;
  cover_image_url?: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sales_count?: number;
  active_sales?: number;
  pending_sales?: number;
  revenue_confirmed?: number;
  revenue_pending?: number;
  last_sale_at?: string | null;
}

interface CourseOverviewResponse {
  summary: {
    total_courses: number;
    active_courses: number;
    total_sales: number;
    active_sales: number;
    pending_sales: number;
    confirmed_revenue: number;
    pending_revenue: number;
  };
  courses: CourseItem[];
  recent_sales: Array<{
    id: string;
    status: string;
    amount_paid: number;
    start_at: string;
    end_at?: string | null;
    created_at: string;
    customer?: {
      id: string;
      name: string;
      email?: string | null;
    } | null;
    course?: {
      id: string;
      title: string;
      price: number;
      is_active: boolean;
    } | null;
  }>;
}

const CONTENT_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'audio', label: 'Audio' },
  { value: 'link', label: 'Link externo' },
];

const MAX_SIZE_MB_BY_TYPE: Record<ContentType, number> = {
  video: 50,
  pdf: 20,
  image: 10,
  audio: 20,
  link: 0,
};

const toMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const sanitizeFileName = (value: string) =>
  String(value || 'arquivo')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');

const Cursos: React.FC = () => {
  const { company, user } = useAuth();
  const isOwner = user?.role === 'DONO_EMPRESA';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overview, setOverview] = useState<CourseOverviewResponse | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [form, setForm] = useState({
    title: '',
    description: '',
    contentType: 'video' as ContentType,
    contentUrl: '',
    coverImageUrl: '',
    price: 0,
    isActive: true,
  });

  const loadOverview = async () => {
    setLoading(true);
    try {
      if (isOwner) {
        const data = await companyService.getCoursesOverview({
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        });
        setOverview(data);
      } else {
        const result = await companyService.list('courses', {
          page: 1,
          pageSize: 500,
          orderBy: 'createdAt',
        });
        const courses = (result?.data || []).map((course: any) => ({
          id: course.id,
          title: course.title,
          description: course.description || null,
          content_type: course.contentType || 'video',
          content_url: course.contentUrl || null,
          cover_image_url: course.coverImageUrl || null,
          price: Number(course.price || 0),
          is_active: Boolean(course.isActive),
          created_at: course.createdAt,
          updated_at: course.updatedAt,
          sales_count: 0,
          active_sales: 0,
          pending_sales: 0,
          revenue_confirmed: 0,
          revenue_pending: 0,
          last_sale_at: null,
        }));

        setOverview({
          summary: {
            total_courses: courses.length,
            active_courses: courses.filter((course: CourseItem) => course.is_active).length,
            total_sales: 0,
            active_sales: 0,
            pending_sales: 0,
            confirmed_revenue: 0,
            pending_revenue: 0,
          },
          courses,
          recent_sales: [],
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar cursos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [filters.dateFrom, filters.dateTo, isOwner]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      contentType: 'video',
      contentUrl: '',
      coverImageUrl: '',
      price: 0,
      isActive: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (course: CourseItem) => {
    setEditingId(course.id);
    setForm({
      title: course.title || '',
      description: course.description || '',
      contentType: (course.content_type as ContentType) || 'video',
      contentUrl: course.content_url || '',
      coverImageUrl: course.cover_image_url || '',
      price: Number(course.price || 0),
      isActive: Boolean(course.is_active),
    });
    setDialogOpen(true);
  };

  const uploadAsset = async (file: File, folder: 'contents' | 'covers') => {
    const companyId = company?.id || user?.tenantId;
    if (!companyId) throw new Error('Empresa nao identificada para upload');

    const fileName = `courses/${companyId}/${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from('company-logos').upload(fileName, file, { upsert: true });
    if (error) throw new Error(error.message || 'Falha no upload');
    const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleContentFile = async (file: File) => {
    const contentType = form.contentType;
    if (contentType === 'link') {
      toast.error('Para link externo, informe a URL manualmente');
      return;
    }
    const limitMb = MAX_SIZE_MB_BY_TYPE[contentType];
    if (limitMb > 0 && file.size > limitMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande para ${contentType}. Limite de ${limitMb}MB`);
      return;
    }
    setUploadingContent(true);
    try {
      const url = await uploadAsset(file, 'contents');
      setForm((prev) => ({ ...prev, contentUrl: url }));
      toast.success('Conteudo enviado');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao enviar conteudo');
    } finally {
      setUploadingContent(false);
    }
  };

  const handleCoverFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Capa muito grande. Limite de 5MB');
      return;
    }
    setUploadingCover(true);
    try {
      const url = await uploadAsset(file, 'covers');
      setForm((prev) => ({ ...prev, coverImageUrl: url }));
      toast.success('Capa enviada');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao enviar capa');
    } finally {
      setUploadingCover(false);
    }
  };

  const saveCourse = async () => {
    if (!form.title.trim()) {
      toast.error('Informe o titulo do curso');
      return;
    }
    if (!form.contentUrl.trim()) {
      toast.error('Informe o conteudo principal do curso');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        contentType: form.contentType,
        contentUrl: form.contentUrl.trim(),
        coverImageUrl: form.coverImageUrl.trim() || null,
        price: Number(form.price || 0),
        isActive: form.isActive,
      };
      if (editingId) {
        await companyService.update('courses', editingId, payload);
        toast.success('Curso atualizado');
      } else {
        await companyService.create('courses', payload);
        toast.success('Curso criado');
      }
      setDialogOpen(false);
      resetForm();
      await loadOverview();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar curso');
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (courseId: string) => {
    if (!window.confirm('Deseja remover este curso?')) return;
    try {
      await companyService.remove('courses', courseId);
      toast.success('Curso removido');
      await loadOverview();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover curso');
    }
  };

  const exportRevenueExcel = () => {
    if (!overview) {
      toast.error('Nao ha dados para exportar');
      return;
    }
    if (!overview.courses.length && !overview.recent_sales.length) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const coursesRows = overview.courses.map((course) => ({
      curso: course.title,
      status: course.is_active ? 'Ativo' : 'Inativo',
      tipo_conteudo: course.content_type || 'video',
      preco: Number(course.price || 0),
      vendas_totais: Number(course.sales_count || 0),
      vendas_confirmadas: Number(course.active_sales || 0),
      vendas_pendentes: Number(course.pending_sales || 0),
      receita_confirmada: Number(course.revenue_confirmed || 0),
      receita_pendente: Number(course.revenue_pending || 0),
      ultima_venda: course.last_sale_at ? new Date(course.last_sale_at).toLocaleString('pt-BR') : '',
    }));

    const salesRows = overview.recent_sales.map((sale) => ({
      curso: sale.course?.title || 'Curso removido',
      cliente: sale.customer?.name || 'Cliente',
      email: sale.customer?.email || '',
      status: sale.status,
      valor: Number(sale.amount_paid || 0),
      criado_em: new Date(sale.created_at).toLocaleString('pt-BR'),
      inicio_acesso: sale.start_at ? new Date(sale.start_at).toLocaleString('pt-BR') : '',
      fim_acesso: sale.end_at ? new Date(sale.end_at).toLocaleString('pt-BR') : '',
    }));

    const summaryRows = [
      { indicador: 'Cursos cadastrados', valor: Number(overview.summary.total_courses || 0) },
      { indicador: 'Cursos ativos', valor: Number(overview.summary.active_courses || 0) },
      { indicador: 'Vendas totais', valor: Number(overview.summary.total_sales || 0) },
      { indicador: 'Vendas confirmadas', valor: Number(overview.summary.active_sales || 0) },
      { indicador: 'Vendas pendentes', valor: Number(overview.summary.pending_sales || 0) },
      { indicador: 'Receita confirmada', valor: Number(overview.summary.confirmed_revenue || 0) },
      { indicador: 'Receita pendente', valor: Number(overview.summary.pending_revenue || 0) },
      { indicador: 'Data inicial', valor: filters.dateFrom || '' },
      { indicador: 'Data final', valor: filters.dateTo || '' },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumo');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(coursesRows), 'Cursos');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesRows), 'Vendas');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `receita-cursos-${stamp}.xlsx`);
    toast.success('Relatorio exportado');
  };

  const renderPreview = (course: Pick<CourseItem, 'title' | 'content_type' | 'content_url' | 'cover_image_url'>) => {
    if (course.cover_image_url) {
      return <img src={course.cover_image_url} alt={course.title} className="h-36 w-full rounded border object-cover" />;
    }
    if (!course.content_url) {
      return <div className="h-36 w-full rounded border bg-muted/30" />;
    }
    if (course.content_type === 'video') {
      return <video src={course.content_url} className="h-36 w-full rounded border object-cover" controls />;
    }
    if (course.content_type === 'image') {
      return <img src={course.content_url} alt={course.title} className="h-36 w-full rounded border object-cover" />;
    }
    return (
      <div className="flex h-36 w-full items-center justify-center rounded border bg-muted/30 text-sm text-muted-foreground">
        Preview via link/arquivo
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursos"
        description={
          isOwner
            ? 'Gerencie seus cursos e acompanhe a receita gerada por eles.'
            : 'Cadastre, edite e visualize os cursos da empresa.'
        }
        buttonLabel="Novo curso"
        onButtonClick={openCreate}
      >
        {isOwner ? (
          <>
            <Button variant="outline" onClick={exportRevenueExcel}>
              Exportar receita
            </Button>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              className="w-auto"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              className="w-auto"
            />
          </>
        ) : null}
      </PageHeader>

      {isOwner ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cursos cadastrados</p><p className="text-2xl font-bold">{overview?.summary.total_courses || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cursos ativos</p><p className="text-2xl font-bold">{overview?.summary.active_courses || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receita confirmada</p><p className="text-2xl font-bold">{toMoney(overview?.summary.confirmed_revenue || 0)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receita pendente</p><p className="text-2xl font-bold">{toMoney(overview?.summary.pending_revenue || 0)}</p></CardContent></Card>
        </div>
      ) : null}

      <div className={`grid gap-6 ${isOwner ? 'xl:grid-cols-[2fr_1fr]' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle>Catalogo de cursos</CardTitle>
            <CardDescription>
              {isOwner
                ? 'Crie, edite, ative e acompanhe o desempenho de cada curso.'
                : 'Crie, edite, ative e visualize os cursos cadastrados.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando cursos...</p>
            ) : !overview?.courses.length ? (
              <p className="text-sm text-muted-foreground">Nenhum curso cadastrado ainda.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {overview.courses.map((course) => (
                  <div key={course.id} className="rounded-lg border p-3 space-y-3">
                    {renderPreview(course)}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{course.title}</p>
                        <p className="text-sm text-muted-foreground">{course.description || '-'}</p>
                      </div>
                      <Badge variant={course.is_active ? 'default' : 'secondary'}>
                        {course.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground">
                      <p>Preco: {toMoney(course.price)}</p>
                      {isOwner ? (
                        <>
                          <p>Vendas confirmadas: {course.active_sales || 0}</p>
                          <p>Vendas pendentes: {course.pending_sales || 0}</p>
                          <p>Receita confirmada: {toMoney(course.revenue_confirmed || 0)}</p>
                          <p>Ultima venda: {formatDateTime(course.last_sale_at)}</p>
                        </>
                      ) : (
                        <p>Status do curso: {course.is_active ? 'Ativo' : 'Inativo'}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(course)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeCourse(course.id)}>Excluir</Button>
                      {course.content_url ? (
                        <Button size="sm" variant="secondary" asChild>
                          <a href={course.content_url} target="_blank" rel="noreferrer">Abrir conteudo</a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isOwner ? (
          <Card>
            <CardHeader>
              <CardTitle>Receita dos cursos</CardTitle>
              <CardDescription>Entradas recentes para acompanhar o resultado do modulo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Resumo comercial</p>
                <p className="text-sm text-muted-foreground">Vendas totais: {overview?.summary.total_sales || 0}</p>
                <p className="text-sm text-muted-foreground">Confirmadas: {overview?.summary.active_sales || 0}</p>
                <p className="text-sm text-muted-foreground">Pendentes: {overview?.summary.pending_sales || 0}</p>
              </div>
              {!overview?.recent_sales.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma venda recente no periodo.</p>
              ) : (
                overview.recent_sales.map((sale) => (
                  <div key={sale.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{sale.course?.title || 'Curso removido'}</p>
                      <Badge variant="outline">{sale.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{sale.customer?.name || 'Cliente'}</p>
                    <p className="text-sm">{toMoney(sale.amount_paid)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(sale.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving && !uploadingContent && !uploadingCover) {
            setDialogOpen(open);
            if (!open) resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar curso' : 'Novo curso'}</DialogTitle>
            <DialogDescription>
              Cadastre o conteudo do curso e controle se ele pode ser vendido no portal do cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Titulo</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentType">Tipo de conteudo</Label>
              <select
                id="contentType"
                value={form.contentType}
                onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preco</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contentUrl">URL do conteudo</Label>
              <Input
                id="contentUrl"
                value={form.contentUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, contentUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contentFile">Arquivo principal</Label>
              <Input
                id="contentFile"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleContentFile(file);
                }}
                disabled={uploadingContent}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="coverImageUrl">URL da capa</Label>
              <Input
                id="coverImageUrl"
                value={form.coverImageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="coverFile">Upload da capa</Label>
              <Input
                id="coverFile"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverFile(file);
                }}
                disabled={uploadingCover}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              <Label htmlFor="isActive">Curso ativo para venda</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving || uploadingContent || uploadingCover}>
              Cancelar
            </Button>
            <Button onClick={saveCourse} disabled={saving || uploadingContent || uploadingCover}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar curso' : 'Criar curso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cursos;

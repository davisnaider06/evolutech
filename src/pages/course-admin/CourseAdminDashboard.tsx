import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCourseAdminAuth } from '@/contexts/CourseAdminAuthContext';
import { courseAdminService } from '@/services/course-admin';
import { CourseAdminCourse } from '@/types/course-admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type ContentType = 'video' | 'pdf' | 'image' | 'link' | 'audio';

const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
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

const formatCurrency = (value?: number | null) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const sanitizeFileName = (value: string) =>
  String(value || 'arquivo')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');

const CourseAdminDashboard: React.FC = () => {
  const { company, manager, logout } = useCourseAdminAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [courses, setCourses] = useState<CourseAdminCourse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content_type: 'video' as ContentType,
    content_url: '',
    cover_image_url: '',
    price: 0,
    is_active: true,
  });

  const ownedCourseIds = useMemo(() => new Set(courses.map((item) => item.id)), [courses]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseAdminService.listCourses();
      setCourses(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar cursos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setEditingCourseId(null);
    setForm({
      title: '',
      description: '',
      content_type: 'video',
      content_url: '',
      cover_image_url: '',
      price: 0,
      is_active: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (course: CourseAdminCourse) => {
    setEditingCourseId(course.id);
    setForm({
      title: course.title || '',
      description: course.description || '',
      content_type: (course.content_type as ContentType) || 'video',
      content_url: course.content_url || '',
      cover_image_url: course.cover_image_url || '',
      price: Number(course.price || 0),
      is_active: Boolean(course.is_active),
    });
    setDialogOpen(true);
  };

  const uploadAsset = async (file: File, folder: 'contents' | 'covers') => {
    if (!company?.id) {
      throw new Error('Empresa nao identificada para upload');
    }
    const safeFileName = sanitizeFileName(file.name);
    const fileName = `courses/${company.id}/${folder}/${Date.now()}-${safeFileName}`;

    const { error } = await supabase.storage.from('company-logos').upload(fileName, file, { upsert: true });
    if (error) {
      throw new Error(error.message || 'Falha no upload do arquivo');
    }

    const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const validateAndUploadContent = async (file: File) => {
    const type = form.content_type;
    if (type === 'link') {
      toast.error('Para conteudo do tipo link, informe a URL manualmente');
      return;
    }
    const maxMb = MAX_SIZE_MB_BY_TYPE[type];
    if (maxMb > 0 && file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande para ${type}. Limite de ${maxMb}MB`);
      return;
    }
    setUploadingContent(true);
    try {
      const url = await uploadAsset(file, 'contents');
      setForm((prev) => ({ ...prev, content_url: url }));
      toast.success('Arquivo principal enviado');
    } catch (error: any) {
      toast.error(error.message || 'Falha no upload do conteudo');
    } finally {
      setUploadingContent(false);
    }
  };

  const validateAndUploadCover = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Capa muito grande. Limite de 5MB');
      return;
    }
    setUploadingCover(true);
    try {
      const url = await uploadAsset(file, 'covers');
      setForm((prev) => ({ ...prev, cover_image_url: url }));
      toast.success('Capa enviada');
    } catch (error: any) {
      toast.error(error.message || 'Falha no upload da capa');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Informe o titulo do curso');
      return;
    }
    if (!form.content_url.trim()) {
      toast.error('Informe ou envie o conteudo principal do curso');
      return;
    }
    if (Number(form.price || 0) < 0) {
      toast.error('Preco invalido');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content_type: form.content_type,
        content_url: form.content_url.trim(),
        cover_image_url: form.cover_image_url.trim() || undefined,
        price: Number(form.price || 0),
        is_active: form.is_active,
      };
      if (editingCourseId) {
        await courseAdminService.updateCourse(editingCourseId, payload);
        toast.success('Curso atualizado');
      } else {
        await courseAdminService.createCourse(payload);
        toast.success('Curso criado');
      }
      setDialogOpen(false);
      resetForm();
      await loadCourses();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao salvar curso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!ownedCourseIds.has(courseId)) return;
    if (!window.confirm('Deseja remover este curso?')) return;
    try {
      await courseAdminService.deleteCourse(courseId);
      toast.success('Curso removido');
      await loadCourses();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao remover curso');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/cursos/login', { replace: true });
  };

  const renderPreview = (contentType: string, contentUrl?: string | null, coverUrl?: string | null) => {
    if (coverUrl) {
      return <img src={coverUrl} alt="Capa do curso" className="h-40 w-full rounded border object-cover" />;
    }
    if (!contentUrl) {
      return <div className="h-40 w-full rounded border bg-muted/30" />;
    }
    if (contentType === 'video') {
      return <video src={contentUrl} className="h-40 w-full rounded border object-cover" controls />;
    }
    if (contentType === 'image') {
      return <img src={contentUrl} alt="Conteudo do curso" className="h-40 w-full rounded border object-cover" />;
    }
    if (contentType === 'audio') {
      return (
        <div className="rounded border p-3">
          <audio src={contentUrl} controls className="w-full" />
        </div>
      );
    }
    return (
      <div className="flex h-40 items-center justify-center rounded border bg-muted/30 text-sm text-muted-foreground">
        Preview disponivel apos abrir o link
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-10 rounded-md border border-border bg-background p-1 object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold">Gestao de Cursos</h1>
              <p className="text-sm text-muted-foreground">
                {company?.name} - {manager?.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreate}>Novo curso</Button>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum curso cadastrado</CardTitle>
              <CardDescription>Crie o primeiro curso para aparecer no portal do cliente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={openCreate}>Cadastrar curso</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{course.title}</CardTitle>
                      <CardDescription>{course.description || '-'}</CardDescription>
                    </div>
                    <Badge variant={course.is_active ? 'default' : 'secondary'}>
                      {course.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderPreview(course.content_type, course.content_url, course.cover_image_url)}
                  <div className="text-sm text-muted-foreground">
                    <p>Tipo: {course.content_type}</p>
                    <p>Preco: {formatCurrency(course.price)}</p>
                    <p>Criado em: {formatDateTime(course.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(course)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(course.id)}>
                      Excluir
                    </Button>
                    {course.content_url ? (
                      <Button size="sm" variant="secondary" asChild>
                        <a href={course.content_url} target="_blank" rel="noreferrer">
                          Abrir conteudo
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
            <DialogTitle>{editingCourseId ? 'Editar curso' : 'Novo curso'}</DialogTitle>
            <DialogDescription>
              Defina o tipo de conteudo, envie o arquivo (ou informe URL), e configure preco e status.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Titulo</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex: Curso de degradê profissional"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Resumo do curso"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content_type">Tipo de conteudo</Label>
              <select
                id="content_type"
                value={form.content_type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, content_type: event.target.value as ContentType }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preco</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value || 0) }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="content_url">URL do conteudo</Label>
              <Input
                id="content_url"
                value={form.content_url}
                onChange={(event) => setForm((prev) => ({ ...prev, content_url: event.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Pode ser URL externa ou URL gerada no upload abaixo.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="content_file">Arquivo principal</Label>
              <Input
                id="content_file"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    validateAndUploadContent(file);
                  }
                }}
                disabled={uploadingContent}
              />
              <p className="text-xs text-muted-foreground">
                Limites: video 50MB, pdf 20MB, imagem 10MB, audio 20MB.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cover_image_url">URL da capa (opcional)</Label>
              <Input
                id="cover_image_url"
                value={form.cover_image_url}
                onChange={(event) => setForm((prev) => ({ ...prev, cover_image_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cover_file">Upload de capa (opcional)</Label>
              <Input
                id="cover_file"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    validateAndUploadCover(file);
                  }
                }}
                disabled={uploadingCover}
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Curso ativo para venda no portal do cliente</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (saving || uploadingContent || uploadingCover) return;
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving || uploadingContent || uploadingCover}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingContent || uploadingCover}>
              {saving ? 'Salvando...' : editingCourseId ? 'Atualizar curso' : 'Criar curso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseAdminDashboard;

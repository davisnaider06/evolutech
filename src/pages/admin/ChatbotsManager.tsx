import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import { 
  Bot, 
  Plus, 
  Link, 
  Copy, 
  ExternalLink,
  Sparkles,
  Webhook,
  Settings,
  Trash2,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface Chatbot {
  id: string;
  company_id: string;
  chatbot_type: 'ai' | 'external';
  name: string;
  is_active: boolean;
  slug: string | null;
  welcome_message: string | null;
  system_prompt: string | null;
  external_webhook_url: string | null;
  primary_color: string | null;
  company?: { name: string } | null;
  created_at: string;
}

const ChatbotsManager: React.FC = () => {
  const { logAudit } = useAuditLog();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    company_id: '',
    chatbot_type: 'ai' as 'ai' | 'external',
    name: 'Assistente Virtual',
    welcome_message: 'Olá! Como posso ajudar você hoje?',
    system_prompt: 'Você é um assistente virtual prestativo e profissional. Responda de forma clara e concisa.',
    external_webhook_url: '',
    primary_color: '#6366f1',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [chatbotsResult, companiesResult] = await Promise.all([
        supabase
          .from('company_chatbots')
          .select('*, company:companies(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('companies')
          .select('id, name')
          .eq('status', 'active')
          .order('name'),
      ]);

      if (chatbotsResult.error) throw chatbotsResult.error;
      if (companiesResult.error) throw companiesResult.error;

      setChatbots((chatbotsResult.data || []) as Chatbot[]);
      setCompanies(companiesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return '';
    
    const baseSlug = company.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
  };

  const handleCreate = async () => {
    if (!formData.company_id) {
      toast.error('Selecione uma empresa');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Informe o nome do chatbot');
      return;
    }

    setCreating(true);

    try {
      const slug = formData.chatbot_type === 'ai' ? generateSlug(formData.company_id) : null;

      const { data, error } = await supabase
        .from('company_chatbots')
        .insert({
          company_id: formData.company_id,
          chatbot_type: formData.chatbot_type,
          name: formData.name,
          slug,
          welcome_message: formData.welcome_message,
          system_prompt: formData.system_prompt,
          external_webhook_url: formData.chatbot_type === 'external' ? formData.external_webhook_url : null,
          primary_color: formData.primary_color,
          is_active: false,
        })
        .select('*, company:companies(name)')
        .single();

      if (error) throw error;

      await logAudit({
        action: 'create',
        entityType: 'chatbot',
        entityId: data.id,
        companyId: formData.company_id,
        details: { name: formData.name, type: formData.chatbot_type },
      });

      setChatbots(prev => [data as Chatbot, ...prev]);
      toast.success('Chatbot criado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating chatbot:', error);
      if (error.code === '23505') {
        toast.error('Esta empresa já possui um chatbot deste tipo');
      } else {
        toast.error('Erro ao criar chatbot');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (chatbot: Chatbot) => {
    try {
      const { error } = await supabase
        .from('company_chatbots')
        .update({ is_active: !chatbot.is_active })
        .eq('id', chatbot.id);

      if (error) throw error;

      await logAudit({
        action: chatbot.is_active ? 'deactivate' : 'activate',
        entityType: 'chatbot',
        entityId: chatbot.id,
        companyId: chatbot.company_id,
        details: { name: chatbot.name },
      });

      setChatbots(prev =>
        prev.map(c => (c.id === chatbot.id ? { ...c, is_active: !chatbot.is_active } : c))
      );

      toast.success(chatbot.is_active ? 'Chatbot desativado' : 'Chatbot ativado');
    } catch (error) {
      console.error('Error toggling chatbot:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (chatbot: Chatbot) => {
    if (!confirm(`Deseja realmente excluir o chatbot "${chatbot.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('company_chatbots')
        .delete()
        .eq('id', chatbot.id);

      if (error) throw error;

      await logAudit({
        action: 'delete',
        entityType: 'chatbot',
        entityId: chatbot.id,
        companyId: chatbot.company_id,
        details: { name: chatbot.name },
      });

      setChatbots(prev => prev.filter(c => c.id !== chatbot.id));
      toast.success('Chatbot excluído');
    } catch (error) {
      console.error('Error deleting chatbot:', error);
      toast.error('Erro ao excluir chatbot');
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/chat/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const resetForm = () => {
    setFormData({
      company_id: '',
      chatbot_type: 'ai',
      name: 'Assistente Virtual',
      welcome_message: 'Olá! Como posso ajudar você hoje?',
      system_prompt: 'Você é um assistente virtual prestativo e profissional. Responda de forma clara e concisa.',
      external_webhook_url: '',
      primary_color: '#6366f1',
    });
  };

  const aiChatbots = chatbots.filter(c => c.chatbot_type === 'ai');
  const externalChatbots = chatbots.filter(c => c.chatbot_type === 'external');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            Chatbots
          </h1>
          <p className="text-muted-foreground">
            Gerencie chatbots com IA ou integração externa para cada empresa
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="glow" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Chatbot
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Criar Chatbot</DialogTitle>
              <DialogDescription>
                Configure um novo chatbot para uma empresa
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
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
                <Label>Tipo de Chatbot</Label>
                <Tabs
                  value={formData.chatbot_type}
                  onValueChange={(v) => setFormData({ ...formData, chatbot_type: v as 'ai' | 'external' })}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ai" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      IA (ChatGPT)
                    </TabsTrigger>
                    <TabsTrigger value="external" className="gap-2">
                      <Webhook className="h-4 w-4" />
                      Integração Externa
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label>Nome do Chatbot</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Assistente de Vendas"
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Boas-Vindas</Label>
                <Textarea
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Olá! Como posso ajudar?"
                  rows={2}
                />
              </div>

              {formData.chatbot_type === 'ai' && (
                <div className="space-y-2">
                  <Label>Prompt do Sistema (Personalidade da IA)</Label>
                  <Textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="Você é um assistente virtual..."
                    rows={3}
                  />
                </div>
              )}

              {formData.chatbot_type === 'external' && (
                <div className="space-y-2">
                  <Label>URL do Webhook Externo *</Label>
                  <Input
                    value={formData.external_webhook_url}
                    onChange={(e) => setFormData({ ...formData, external_webhook_url: e.target.value })}
                    placeholder="https://api.seubot.com/webhook"
                  />
                  <p className="text-xs text-muted-foreground">
                    O webhook receberá POST com {"{"} message, sessionId {"}"} e deve retornar {"{"} reply {"}"}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Cor Principal</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#6366f1"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Chatbot'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chatbots.length}</p>
              <p className="text-sm text-muted-foreground">Total de Chatbots</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Sparkles className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{aiChatbots.length}</p>
              <p className="text-sm text-muted-foreground">Chatbots com IA</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chatbots.filter(c => c.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chatbots Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chatbots Configurados</CardTitle>
          <CardDescription>
            Lista de todos os chatbots por empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chatbots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum chatbot configurado</p>
              <p className="text-sm">Clique em "Novo Chatbot" para criar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatbots.map((chatbot) => (
                  <TableRow key={chatbot.id}>
                    <TableCell className="font-medium">{chatbot.name}</TableCell>
                    <TableCell>{chatbot.company?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={chatbot.chatbot_type === 'ai' ? 'default' : 'secondary'}>
                        {chatbot.chatbot_type === 'ai' ? (
                          <><Sparkles className="h-3 w-3 mr-1" /> IA</>
                        ) : (
                          <><Webhook className="h-3 w-3 mr-1" /> Externo</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={chatbot.is_active}
                        onCheckedChange={() => handleToggleActive(chatbot)}
                      />
                    </TableCell>
                    <TableCell>
                      {chatbot.slug ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(chatbot.slug!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <a
                            href={`/chat/${chatbot.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(chatbot)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatbotsManager;

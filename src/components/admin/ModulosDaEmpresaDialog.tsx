import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { adminService } from '@/services/admin';

type ModuloDaEmpresa = {
  modulo_id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  obrigatorio: boolean;
  ativo: boolean;
};

/**
 * O que fica ligado no perfil "Essencial": a agenda, os clientes dela e o
 * caixa (PDV para receber, Caixa para ver o dia). Equipe nao e modulo — o
 * dono sempre ve. Os obrigatorios do sistema base ficam ligados de qualquer
 * jeito.
 */
const ESSENCIAL = new Set(['agendamentos', 'appointments', 'clientes', 'customers', 'pdv', 'caixa', 'cash']);

const PERFIS = [
  {
    id: 'essencial',
    nome: 'Essencial',
    descricao: 'Agenda, clientes, equipe e caixa para receber. Menu curto, para quem quer o simples.',
    liga: (modulo: ModuloDaEmpresa) => modulo.obrigatorio || ESSENCIAL.has(modulo.codigo.toLowerCase()),
  },
  {
    id: 'completo',
    nome: 'Completo',
    descricao: 'Tudo o que o sistema base da empresa oferece.',
    liga: () => true,
  },
];

export function ModulosDaEmpresaDialog({
  empresa,
  onOpenChange,
}: {
  empresa: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [modulos, setModulos] = useState<ModuloDaEmpresa[]>([]);
  const [escolha, setEscolha] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    setCarregando(true);
    adminService
      .listarModulosDaEmpresa(empresa.id)
      .then((lista: ModuloDaEmpresa[]) => {
        setModulos(lista || []);
        setEscolha(Object.fromEntries((lista || []).map((m) => [m.modulo_id, m.ativo])));
      })
      .catch((error: any) => toast.error(error.message || 'Erro ao carregar módulos'))
      .finally(() => setCarregando(false));
  }, [empresa]);

  const perfilAtual = useMemo(
    () => PERFIS.find((perfil) => modulos.length > 0 && modulos.every((m) => escolha[m.modulo_id] === perfil.liga(m)))?.id,
    [modulos, escolha]
  );

  const alterados = modulos.filter((m) => escolha[m.modulo_id] !== m.ativo);

  const salvar = async () => {
    if (!empresa || alterados.length === 0) return;
    setSalvando(true);
    try {
      const lista = await adminService.salvarModulosDaEmpresa(
        empresa.id,
        alterados.map((m) => ({ modulo_id: m.modulo_id, ativo: escolha[m.modulo_id] }))
      );
      setModulos(lista || []);
      toast.success('Módulos salvos. A empresa vê o menu novo em até 1 minuto.');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar módulos');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!empresa} onOpenChange={(open) => !salvando && onOpenChange(open)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Módulos de {empresa?.name}</DialogTitle>
          <DialogDescription>
            O que o dono e a equipe enxergam no menu. Desligar não apaga nenhum dado: ao religar, tudo volta como estava.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="py-6 text-sm text-muted-foreground">Carregando módulos...</p>
        ) : modulos.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Esta empresa não tem sistema base. Escolha um em Editar para liberar módulos.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {PERFIS.map((perfil) => {
                const ativo = perfilAtual === perfil.id;
                return (
                  <button
                    key={perfil.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setEscolha(Object.fromEntries(modulos.map((m) => [m.modulo_id, perfil.liga(m)])))}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      ativo ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {perfil.nome}
                      {ativo && <span className="ml-2 text-xs font-normal text-primary">selecionado</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{perfil.descricao}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {modulos.map((modulo) => (
                <label
                  key={modulo.modulo_id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {modulo.nome}
                      {modulo.obrigatorio && <Badge variant="secondary" className="text-[10px]">sempre ligado</Badge>}
                    </span>
                    {modulo.descricao && (
                      <span className="block text-xs text-muted-foreground">{modulo.descricao}</span>
                    )}
                  </span>
                  <Switch
                    checked={!!escolha[modulo.modulo_id]}
                    disabled={modulo.obrigatorio || salvando}
                    onCheckedChange={(checked) => setEscolha((old) => ({ ...old, [modulo.modulo_id]: checked }))}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || alterados.length === 0}>
            {salvando ? 'Salvando...' : alterados.length ? `Salvar (${alterados.length})` : 'Nada para salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

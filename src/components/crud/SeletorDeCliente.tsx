import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { companyService } from '@/services/company';

export interface ClienteResumo {
  id: string;
  name: string;
  phone: string | null;
  preferredProfessionalId: string;
}

interface SeletorDeClienteProps {
  /** Id ou nome do cliente escolhido, conforme `compararPor`. Vazio = nenhum. */
  value: string;
  /** O que a tela guarda: o id (cadastro) ou o nome (filtros por texto). */
  compararPor?: 'id' | 'nome';
  /** Texto do botao quando ha valor; sem ele, usa o nome ou "Cliente selecionado". */
  rotuloSelecionado?: string;
  onChange: (cliente: ClienteResumo | null) => void;
  placeholder?: string;
  /** Primeira opcao da lista para limpar a escolha ("Todos", "Sem cadastro"). */
  opcaoVazia?: string;
  disabled?: boolean;
  className?: string;
}

const POR_PAGINA = 20;
const ATRASO_DA_BUSCA_MS = 300;

const rotuloDe = (cliente: ClienteResumo) => (cliente.phone ? `${cliente.name} - ${cliente.phone}` : cliente.name);

/**
 * Seletor de cliente com busca no servidor.
 *
 * Substitui o "carrega todos os clientes e filtra na tela": o backend devolve
 * no maximo 200 por pagina, e o cliente nº 201 em diante sumia dos seletores
 * da agenda, do PDV, de assinaturas e de fidelidade, sem aviso. Aqui a busca
 * vai ao servidor (nome ou telefone) e traz 20 por vez.
 */
export const SeletorDeCliente: React.FC<SeletorDeClienteProps> = ({
  value,
  compararPor = 'id',
  rotuloSelecionado,
  onChange,
  placeholder = 'Selecionar cliente',
  opcaoVazia,
  disabled = false,
  className,
}) => {
  const [aberto, setAberto] = React.useState(false);
  const [texto, setTexto] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [clientes, setClientes] = React.useState<ClienteResumo[]>([]);
  const [total, setTotal] = React.useState(0);
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState(false);
  const [escolhido, setEscolhido] = React.useState<ClienteResumo | null>(null);
  const buscaAtual = React.useRef(0);

  React.useEffect(() => {
    const espera = window.setTimeout(() => setBusca(texto.trim()), ATRASO_DA_BUSCA_MS);
    return () => window.clearTimeout(espera);
  }, [texto]);

  React.useEffect(() => {
    if (!aberto) return;
    const id = ++buscaAtual.current;
    setCarregando(true);
    setErro(false);
    companyService
      .list('customers', { page: 1, pageSize: POR_PAGINA, is_active: 'true', orderBy: 'name', search: busca || undefined })
      .then((resultado: any) => {
        if (id !== buscaAtual.current) return;
        const linhas = Array.isArray(resultado?.data) ? resultado.data : [];
        setClientes(
          linhas.map((item: any) => ({
            id: String(item.id),
            name: String(item.name || ''),
            phone: item.phone || null,
            preferredProfessionalId: String(item.preferred_professional_id || item.preferredProfessionalId || ''),
          })),
        );
        setTotal(Number(resultado?.total || linhas.length));
      })
      .catch(() => {
        if (id === buscaAtual.current) setErro(true);
      })
      .finally(() => {
        if (id === buscaAtual.current) setCarregando(false);
      });
  }, [aberto, busca]);

  // Valor limpo por fora (formulario resetado): esquece o rotulo guardado.
  React.useEffect(() => {
    if (!value) setEscolhido(null);
  }, [value]);

  const valorDe = (cliente: ClienteResumo) => (compararPor === 'id' ? cliente.id : cliente.name);
  const rotuloDoBotao = value
    ? rotuloSelecionado ||
      (escolhido && valorDe(escolhido) === value ? rotuloDe(escolhido) : compararPor === 'nome' ? value : 'Cliente selecionado')
    : opcaoVazia || placeholder;

  const escolher = (cliente: ClienteResumo | null) => {
    setEscolhido(cliente);
    onChange(cliente);
    setAberto(false);
    setTexto('');
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{rotuloDoBotao}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* shouldFilter={false}: quem filtra e o servidor. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou telefone..." value={texto} onValueChange={setTexto} />
          <CommandList>
            {carregando && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando clientes...
              </div>
            )}
            {!carregando && erro && (
              <div className="px-3 py-3 text-sm text-destructive">Não consegui buscar os clientes. Tente de novo.</div>
            )}
            {!carregando && !erro && <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>}
            <CommandGroup>
              {opcaoVazia && (
                <CommandItem value="__vazio__" onSelect={() => escolher(null)}>
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  {opcaoVazia}
                </CommandItem>
              )}
              {!carregando &&
                clientes.map((cliente) => (
                  <CommandItem key={cliente.id} value={cliente.id} onSelect={() => escolher(cliente)}>
                    <Check className={cn('mr-2 h-4 w-4', value === valorDe(cliente) ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{rotuloDe(cliente)}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            {!carregando && !erro && total > clientes.length && (
              <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
                Mostrando {clientes.length} de {total}. Digite para encontrar os outros.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

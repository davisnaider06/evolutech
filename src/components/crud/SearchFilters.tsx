import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';

const ATRASO_DA_BUSCA_MS = 300;

interface StatusOption {
  value: string;
  label: string;
}

interface SearchFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  onClear?: () => void;
  showClear?: boolean;
  children?: React.ReactNode;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  statusOptions,
  statusValue,
  onStatusChange,
  onClear,
  showClear = false,
  children,
}) => {
  // Debounce da busca: o campo mostra o que foi digitado na hora, mas a tela
  // so recebe o texto (e busca no servidor) depois de 300 ms sem digitar.
  // Antes cada tecla virava uma requisicao.
  const [texto, setTexto] = useState(searchValue);
  const ultimoEnviado = useRef(searchValue);
  const avisar = useRef(onSearchChange);
  avisar.current = onSearchChange;

  // Valor trocado por fora (ex.: botao Limpar) volta para o campo.
  useEffect(() => {
    if (searchValue !== ultimoEnviado.current) {
      ultimoEnviado.current = searchValue;
      setTexto(searchValue);
    }
  }, [searchValue]);

  useEffect(() => {
    if (texto === ultimoEnviado.current) return;
    const espera = window.setTimeout(() => {
      ultimoEnviado.current = texto;
      avisar.current(texto);
    }, ATRASO_DA_BUSCA_MS);
    return () => window.clearTimeout(espera);
  }, [texto]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {statusOptions && onStatusChange && (
        <Select value={statusValue || ''} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {children}

      {showClear && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
};
